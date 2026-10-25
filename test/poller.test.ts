import { describe, expect, it } from "vitest";
import { MemoryMatchRepository } from "../src/data/memory";
import type {
  CompetitionId,
  Match,
  MatchDetail,
  MatchEvent,
  MatchStatus,
  Provider,
  WinProbability,
} from "../src/domain/types";
import {
  fixtureDates,
  pollOnce,
  type MatchUpdate,
} from "../src/engine/poller";

const NOW = new Date("2026-10-25T18:00:00.000Z");

function match(
  id: string,
  competitionId: CompetitionId,
  status: MatchStatus,
  overrides: Partial<Match> = {},
): Match {
  return {
    id: `espn:${id}`,
    competitionId,
    externalId: id,
    season: "2026-27",
    kickoff: "2026-10-25T16:30:00.000Z",
    status,
    clock: {
      minute: status === "scheduled" ? 0 : 67,
      addedTime: 0,
      display: status === "scheduled" ? "" : "67'",
      running: status === "live",
    },
    home: {
      id: "espn:362",
      externalId: "362",
      name: "Aston Villa",
      shortName: "AVL",
    },
    away: {
      id: "espn:382",
      externalId: "382",
      name: "Manchester City",
      shortName: "MNC",
    },
    score:
      status === "scheduled" ? { home: 0, away: 0 } : { home: 2, away: 1 },
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function event(
  id: string,
  type: MatchEvent["type"],
  overrides: Partial<MatchEvent> = {},
): MatchEvent {
  return {
    id: `espn:100:${id}`,
    matchId: "espn:100",
    externalId: id,
    type,
    minute: 60,
    addedTime: 0,
    sequence: 1,
    side: type === "fulltime" ? null : "home",
    createdAt: NOW.toISOString(),
    ...overrides,
  };
}

class FakeProvider implements Provider {
  readonly id = "fake";
  readonly capabilities = {
    liveScores: true,
    events: true,
    commentary: true,
    lineups: false,
    winProbability: false,
  };

  readonly scoreboards = new Map<string, Match[]>();
  readonly details = new Map<string, MatchDetail>();
  readonly failing = new Set<string>();
  readonly fixtureCalls: string[] = [];
  readonly detailCalls: string[] = [];

  async listMatches({
    competition,
    date,
  }: {
    competition: { id: string };
    date: string;
  }): Promise<Match[]> {
    this.fixtureCalls.push(`${competition.id}:${date}`);
    if (this.failing.has(competition.id)) {
      throw new Error(`upstream down for ${competition.id}`);
    }
    return this.scoreboards.get(competition.id) ?? [];
  }

  async getMatchDetail(ref: {
    competitionId: CompetitionId;
    externalId: string;
  }): Promise<MatchDetail | null> {
    this.detailCalls.push(ref.externalId);
    return this.details.get(ref.externalId) ?? null;
  }
}

describe("fixtureDates", () => {
  it("only polls today during the day", () => {
    expect(fixtureDates(NOW)).toEqual(["2026-10-25"]);
  });

  it("also checks yesterday after midnight UTC", () => {
    expect(fixtureDates(new Date("2026-10-26T01:15:00.000Z"))).toEqual([
      "2026-10-25",
      "2026-10-26",
    ]);
  });

  it("honours an explicit date", () => {
    expect(fixtureDates(NOW, "2026-10-20")).toEqual(["2026-10-20"]);
  });
});

describe("pollOnce", () => {
  function setup() {
    const provider = new FakeProvider();
    const repo = new MemoryMatchRepository();
    const updates: MatchUpdate[] = [];

    const live = match("100", "eng.1", "live");
    const scheduled = match("101", "eng.1", "scheduled", {
      id: "espn:101",
      externalId: "101",
      kickoff: "2026-10-25T20:00:00.000Z",
    });
    const spanish = match("200", "esp.1", "scheduled", {
      id: "espn:200",
      externalId: "200",
      kickoff: "2026-10-25T19:00:00.000Z",
    });

    provider.scoreboards.set("eng.1", [live, scheduled]);
    provider.scoreboards.set("esp.1", [spanish]);
    provider.details.set("100", {
      match: live,
      events: [
        event("1", "kickoff", { minute: 0, sequence: 0, side: null }),
        event("2", "goal", { minute: 6 }),
        event("3", "yellow_card", { minute: 32 }),
      ],
    });

    return { provider, repo, updates, live, scheduled, spanish };
  }

  it("stores every competition and details only live matches", async () => {
    const { provider, repo, updates, live, scheduled } = setup();

    const summary = await pollOnce({
      provider,
      repo,
      now: () => NOW,
      onUpdate: (update) => {
        updates.push(update);
      },
    });

    expect(summary.fixtures).toBe(3);
    expect(summary.detailed).toBe(1);
    expect(summary.events).toBe(3);
    expect(summary.failures).toEqual([]);

    expect(await repo.getMatches({ date: "2026-10-25" })).toHaveLength(3);
    expect(await repo.getEvents(live.id)).toHaveLength(3);
    expect((await repo.getMatch(live.id))?.probability).not.toBeNull();
    expect(await repo.getEvents(scheduled.id)).toHaveLength(0);

    expect(provider.detailCalls).toEqual(["100"]);
    expect(updates).toHaveLength(1);
    expect(updates[0]?.events.map((item) => item.type)).toEqual([
      "kickoff",
      "goal",
      "yellow_card",
    ]);
  });

  it("does not rewrite or rebroadcast events on the next pass", async () => {
    const { provider, repo, updates } = setup();

    await pollOnce({
      provider,
      repo,
      now: () => NOW,
      onUpdate: (update) => {
        updates.push(update);
      },
    });

    const second = await pollOnce({
      provider,
      repo,
      now: () => new Date("2026-10-25T18:01:00.000Z"),
      onUpdate: (update) => {
        updates.push(update);
      },
    });

    expect(second.events).toBe(0);
    expect(updates).toHaveLength(1);
    expect(provider.detailCalls).toEqual(["100", "100"]);
  });

  it("keeps going when one competition is down", async () => {
    const { provider, repo, spanish } = setup();
    provider.failing.add("eng.1");

    const summary = await pollOnce({
      provider,
      repo,
      now: () => NOW,
    });

    expect(summary.fixtures).toBe(1);
    expect(summary.failures).toEqual([
      { competitionId: "eng.1", message: "upstream down for eng.1" },
    ]);
    expect(await repo.getMatch(spanish.id)).not.toBeNull();
  });

  it("fetches the final summary on the transition to finished", async () => {
    const { provider, repo, updates, live } = setup();

    await pollOnce({
      provider,
      repo,
      now: () => NOW,
      onUpdate: (update) => {
        updates.push(update);
      },
    });
    expect(updates).toHaveLength(1);

    const finished = match("100", "eng.1", "finished", {
      score: { home: 2, away: 1 },
    });
    provider.scoreboards.set("eng.1", [finished]);
    provider.details.set("100", {
      match: finished,
      events: [
        event("1", "kickoff", { minute: 0, sequence: 0, side: null }),
        event("2", "goal", { minute: 6 }),
        event("3", "yellow_card", { minute: 32 }),
        event("9", "fulltime", {
          minute: 90,
          addedTime: 5,
          sequence: 9,
          side: null,
        }),
      ],
    });

    const second = await pollOnce({
      provider,
      repo,
      now: () => new Date("2026-10-25T18:55:00.000Z"),
      onUpdate: (update) => {
        updates.push(update);
      },
    });

    expect(second.detailed).toBe(1);
    expect(second.events).toBe(1);
    expect((await repo.getMatch(live.id))?.status).toBe("finished");
    expect((await repo.getEvents(live.id)).map((item) => item.type)).toEqual([
      "kickoff",
      "goal",
      "yellow_card",
      "fulltime",
    ]);
    expect(updates.at(-1)?.match.status).toBe("finished");
  });

  it("can backfill an old matchday", async () => {
    const { provider, repo } = setup();
    const old = match("300", "eng.1", "finished", {
      id: "espn:300",
      externalId: "300",
      kickoff: "2026-10-20T19:00:00.000Z",
      score: { home: 0, away: 0 },
    });
    provider.scoreboards.set("eng.1", [old]);
    provider.scoreboards.set("esp.1", []);

    const summary = await pollOnce(
      { provider, repo, now: () => NOW },
      { date: "2026-10-20", backfill: true },
    );

    expect(summary.fixtures).toBe(1);
    expect(summary.detailed).toBe(0); // no detail payload configured
    expect(await repo.getMatch(old.id)).not.toBeNull();
  });
});

describe("win probability integration", () => {
  it("stores a probability that sums to one", async () => {
    const provider = new FakeProvider();
    const repo = new MemoryMatchRepository();
    const live = match("100", "eng.1", "live");
    provider.scoreboards.set("eng.1", [live]);
    provider.details.set("100", {
      match: live,
      events: [event("1", "goal", { minute: 6 })],
    });

    await pollOnce({ provider, repo, now: () => NOW });

    const probability: WinProbability | null | undefined = (
      await repo.getMatch(live.id)
    )?.probability;
    expect(probability).not.toBeNull();
    expect(
      (probability?.home ?? 0) +
        (probability?.draw ?? 0) +
        (probability?.away ?? 0),
    ).toBeCloseTo(1, 6);
  });
});
