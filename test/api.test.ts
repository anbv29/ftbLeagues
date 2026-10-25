import { describe, expect, it } from "vitest";
import { handleApi } from "../src/api/router";
import { MemoryMatchRepository } from "../src/data/memory";
import type {
  CompetitionId,
  Match,
  MatchEvent,
  MatchStatus,
  Provider,
} from "../src/domain/types";
import type { Env } from "../src/env";

const NOW = new Date("2026-10-25T18:00:00.000Z");
const ENV = { DB: {} as D1Database } as Env;

function match(
  id: string,
  competitionId: CompetitionId,
  kickoff: string,
  status: MatchStatus,
  score: { home: number; away: number },
): Match {
  return {
    id: `espn:${id}`,
    competitionId,
    externalId: id,
    season: "2026-27",
    kickoff,
    status,
    clock: {
      minute: status === "scheduled" ? 0 : 90,
      addedTime: 0,
      display: status === "scheduled" ? "" : "90'",
      running: false,
    },
    home: {
      id: "espn:362",
      externalId: "362",
      name: "Aston Villa",
      shortName: "AVL",
      crest: "https://example.com/avl.png",
    },
    away: {
      id: "espn:382",
      externalId: "382",
      name: "Manchester City",
      shortName: "MNC",
    },
    score,
    updatedAt: NOW.toISOString(),
  };
}

function event(id: string): MatchEvent {
  return {
    id: `espn:401:${id}`,
    matchId: "espn:401",
    externalId: id,
    type: "goal",
    minute: 60,
    addedTime: 0,
    sequence: 1,
    side: "home",
    player: "Nicolas Jackson",
    createdAt: NOW.toISOString(),
  };
}

async function setup() {
  const repo = new MemoryMatchRepository();
  const live = match(
    "401",
    "eng.1",
    "2026-10-25T16:30:00.000Z",
    "live",
    { home: 1, away: 0 },
  );
  const other = match(
    "402",
    "esp.1",
    "2026-10-25T19:00:00.000Z",
    "scheduled",
    { home: 0, away: 0 },
  );

  await repo.upsertMatches([other, live]);
  await repo.insertEvents([event("1")]);
  await repo.setProbability(live.id, { home: 0.8, draw: 0.15, away: 0.05 });

  return { repo, live, other };
}

function get(
  path: string,
  init?: RequestInit,
): Request {
  return new Request(`https://ftbl.test${path}`, init);
}

async function call(path: string, init?: RequestInit) {
  const { repo } = await setup();
  const response = await handleApi(get(path, init), {
    env: ENV,
    repo,
    now: () => NOW,
  });
  return { response, repo };
}

describe("handleApi", () => {
  it("returns null outside /api so the caller can 404 or serve assets", async () => {
    const { repo } = await setup();
    const response = await handleApi(get("/health"), { env: ENV, repo });
    expect(response).toBeNull();
  });

  it("answers preflight requests", async () => {
    const { response } = await call("/api/matches", { method: "OPTIONS" });
    expect(response?.status).toBe(204);
    expect(response?.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("lists matches for a date, sorted by kickoff", async () => {
    const { response } = await call("/api/matches?date=2026-10-25");
    const body = (await response!.json()) as {
      count: number;
      matches: Array<{ id: string; probability: unknown }>;
    };

    expect(response?.status).toBe(200);
    expect(body.count).toBe(2);
    expect(body.matches[0]?.id).toBe("espn:401");
    expect(body.matches[0]?.probability).toEqual({
      home: 0.8,
      draw: 0.15,
      away: 0.05,
    });
  });

  it("filters by competition", async () => {
    const { response } = await call(
      "/api/matches?date=2026-10-25&competition=esp.1",
    );
    const body = (await response!.json()) as { matches: Array<{ id: string }> };
    expect(body.matches).toHaveLength(1);
    expect(body.matches[0]?.id).toBe("espn:402");
  });

  it("validates the date and competition", async () => {
    const invalidDate = await call("/api/matches?date=25-10-2026");
    expect(invalidDate.response?.status).toBe(400);

    const impossibleDate = await call("/api/matches?date=2026-02-31");
    expect(impossibleDate.response?.status).toBe(400);

    const invalidCompetition = await call(
      "/api/matches?date=2026-10-25&competition=eng.9",
    );
    expect(invalidCompetition.response?.status).toBe(400);
  });

  it("returns a match with its event feed", async () => {
    const { response } = await call("/api/matches/espn%3A401");
    const body = (await response!.json()) as {
      match: { id: string };
      events: Array<{ type: string }>;
      probability: { home: number };
    };

    expect(response?.status).toBe(200);
    expect(body.match.id).toBe("espn:401");
    expect(body.events).toHaveLength(1);
    expect(body.probability.home).toBe(0.8);
  });

  it("404s an unknown match", async () => {
    const { response } = await call("/api/matches/espn%3A999");
    expect(response?.status).toBe(404);
  });

  it("creates and resolves a share room", async () => {
    const { repo } = await setup();
    const created = await handleApi(
      get("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ matchId: "espn:401" }),
      }),
      { env: ENV, repo, now: () => NOW },
    );

    expect(created?.status).toBe(201);
    const body = (await created!.json()) as {
      room: { code: string; matchId: string };
    };
    expect(body.room.matchId).toBe("espn:401");
    expect(body.room.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    const joined = await handleApi(
      get(`/api/rooms/${body.room.code}`),
      { env: ENV, repo, now: () => NOW },
    );
    expect(joined?.status).toBe(200);
    const joinedBody = (await joined!.json()) as {
      room: { code: string };
      match: { id: string };
    };
    expect(joinedBody.room.code).toBe(body.room.code);
    expect(joinedBody.match.id).toBe("espn:401");
  });

  it("rejects malformed room requests", async () => {
    const { repo } = await setup();

    const noBody = await handleApi(
      get("/api/rooms", { method: "POST" }),
      { env: ENV, repo, now: () => NOW },
    );
    expect(noBody?.status).toBe(400);

    const unknownMatch = await handleApi(
      get("/api/rooms", {
        method: "POST",
        body: JSON.stringify({ matchId: "espn:999" }),
      }),
      { env: ENV, repo, now: () => NOW },
    );
    expect(unknownMatch?.status).toBe(404);

    const badCode = await handleApi(get("/api/rooms/NOPE"), {
      env: ENV,
      repo,
      now: () => NOW,
    });
    expect(badCode?.status).toBe(404);
  });

  it("lists competitions with the server clock", async () => {
    const { response } = await call("/api/competitions");
    const body = (await response!.json()) as {
      competitions: Array<{ id: string }>;
      serverTime: string;
    };
    expect(body.competitions).toHaveLength(6);
    expect(body.serverTime).toBe(NOW.toISOString());
  });

  it("adds and broadcasts a demo goal in local development", async () => {
    const { repo } = await setup();
    const demo: Match = {
      ...match(
        "900",
        "eng.1",
        "2026-10-25T16:30:00.000Z",
        "live",
        { home: 1, away: 0 },
      ),
      id: "demo:eng.1:ars-liv",
      externalId: "demo-ars-liv",
      clock: { minute: 67, addedTime: 0, display: "67'", running: true },
    };
    await repo.upsertMatches([demo]);

    let broadcasts = 0;
    const local = await handleApi(
      new Request(
        "http://127.0.0.1:8787/api/dev/demo-goal?matchId=demo%3Aeng.1%3Aars-liv&side=away&player=Salah",
        { method: "POST" },
      ),
      {
        env: ENV,
        repo,
        now: () => NOW,
        onUpdate: () => {
          broadcasts += 1;
        },
      },
    );

    expect(local?.status).toBe(200);
    const body = (await local!.json()) as {
      match: { score: { home: number; away: number } };
      event: { type: string; minute: number; player?: string };
    };
    expect(body.match.score).toEqual({ home: 1, away: 1 });
    expect(body.event).toMatchObject({
      type: "goal",
      minute: 68,
      player: "Salah",
    });
    expect(broadcasts).toBe(1);

    const stored = await repo.getMatch("demo:eng.1:ars-liv");
    expect(stored?.score).toEqual({ home: 1, away: 1 });
    const events = await repo.getEvents("demo:eng.1:ars-liv");
    expect(events.at(-1)?.externalId).toBe("demo-goal-1");

    const remote = await handleApi(
      get("/api/dev/demo-goal?matchId=demo%3Aeng.1%3Aars-liv", {
        method: "POST",
      }),
      { env: ENV, repo, now: () => NOW },
    );
    expect(remote?.status).toBe(404);

    const ordinaryMatch = await handleApi(
      new Request("http://127.0.0.1:8787/api/dev/demo-goal?matchId=espn%3A401", {
        method: "POST",
      }),
      { env: ENV, repo, now: () => NOW },
    );
    expect(ordinaryMatch?.status).toBe(400);
  });

  it("exposes a poll trigger only to local development", async () => {
    const { repo } = await setup();
    const provider: Provider = {
      id: "fake",
      capabilities: {
        liveScores: true,
        events: true,
        commentary: false,
        lineups: false,
        winProbability: false,
      },
      listMatches: async () => [],
      getMatchDetail: async () => null,
    };

    const remote = await handleApi(get("/api/dev/poll", { method: "POST" }), {
      env: ENV,
      repo,
      provider,
      now: () => NOW,
    });
    expect(remote?.status).toBe(404);

    const local = await handleApi(
      new Request("http://127.0.0.1:8787/api/dev/poll", { method: "POST" }),
      { env: ENV, repo, provider, now: () => NOW },
    );
    expect(local?.status).toBe(200);
    const body = (await local!.json()) as { summary: { fixtures: number } };
    expect(body.summary.fixtures).toBe(0);
  });
});
