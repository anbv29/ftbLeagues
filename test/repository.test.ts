import { describe, expect, it } from "vitest";
import type { Match, MatchEvent } from "../src/domain/types";
import { MemoryMatchRepository } from "../src/data/memory";
import type { EventRow, MatchRow } from "../src/data/repository";
import { rowToEvent, rowToMatch } from "../src/data/repository";

const NOW = "2026-10-25T18:00:00.000Z";

function matchRow(overrides: Partial<MatchRow> = {}): MatchRow {
  return {
    id: "espn:401",
    competition_id: "eng.1",
    external_id: "401",
    season: "2026-27",
    kickoff: "2026-10-25T16:30:00.000Z",
    status: "live",
    minute: 67,
    added_time: 0,
    clock_display: "67'",
    clock_running: 1,
    home_id: "espn:362",
    home_name: "Aston Villa",
    home_short: "AVL",
    home_crest: "https://example.com/avl.png",
    away_id: "espn:382",
    away_name: "Manchester City",
    away_short: "MNC",
    away_crest: null,
    home_score: 2,
    away_score: 1,
    venue: "Villa Park",
    prob_home: 0.64,
    prob_draw: 0.24,
    prob_away: 0.12,
    updated_at: NOW,
    ...overrides,
  };
}

function eventRow(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: "espn:401:99",
    match_id: "espn:401",
    external_id: "99",
    type: "goal",
    minute: 60,
    added_time: 0,
    sequence: 5,
    side: "home",
    player: "Nicolas Jackson",
    assist: "Ibrahim Mbaye",
    detail: "Goal! Aston Villa 2, Manchester City 1.",
    score_home: 2,
    score_away: 1,
    created_at: NOW,
    ...overrides,
  };
}

function match(overrides: Partial<Match> = {}): Match {
  return {
    id: "espn:401",
    competitionId: "eng.1",
    externalId: "401",
    season: "2026-27",
    kickoff: "2026-10-25T16:30:00.000Z",
    status: "live",
    clock: { minute: 67, addedTime: 0, display: "67'", running: true },
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
    score: { home: 2, away: 1 },
    venue: "Villa Park",
    updatedAt: NOW,
    ...overrides,
  };
}

function event(overrides: Partial<MatchEvent> = {}): MatchEvent {
  return {
    id: "espn:401:99",
    matchId: "espn:401",
    externalId: "99",
    type: "goal",
    minute: 60,
    addedTime: 0,
    sequence: 5,
    side: "home",
    player: "Nicolas Jackson",
    createdAt: NOW,
    ...overrides,
  };
}

describe("rowToMatch", () => {
  it("rebuilds the nested domain shape", () => {
    const parsed = rowToMatch(matchRow());

    expect(parsed.id).toBe("espn:401");
    expect(parsed.competitionId).toBe("eng.1");
    expect(parsed.clock).toEqual({
      minute: 67,
      addedTime: 0,
      display: "67'",
      running: true,
    });
    expect(parsed.home).toMatchObject({
      id: "espn:362",
      externalId: "362",
      name: "Aston Villa",
      shortName: "AVL",
    });
    expect(parsed.away.crest).toBeUndefined();
    expect(parsed.score).toEqual({ home: 2, away: 1 });
    expect(parsed.probability).toEqual({
      home: 0.64,
      draw: 0.24,
      away: 0.12,
    });
  });

  it("treats a missing probability as absent", () => {
    const parsed = rowToMatch(
      matchRow({ prob_home: null, prob_draw: null, prob_away: null }),
    );
    expect(parsed.probability).toBeNull();
  });

  it("coerces the clock running flag", () => {
    expect(rowToMatch(matchRow({ clock_running: 0 })).clock.running).toBe(false);
  });
});

describe("rowToEvent", () => {
  it("rebuilds optional fields and the score", () => {
    const parsed = rowToEvent(eventRow());

    expect(parsed).toMatchObject({
      type: "goal",
      minute: 60,
      side: "home",
      player: "Nicolas Jackson",
      assist: "Ibrahim Mbaye",
      scoreAfter: { home: 2, away: 1 },
    });
  });

  it("keeps neutral events side-less and score-less", () => {
    const parsed = rowToEvent(
      eventRow({
        type: "halftime",
        side: null,
        player: null,
        assist: null,
        detail: null,
        score_home: null,
        score_away: null,
      }),
    );

    expect(parsed.side).toBeNull();
    expect(parsed.player).toBeUndefined();
    expect(parsed.scoreAfter).toBeUndefined();
  });

  it("rejects an unknown side instead of trusting the database", () => {
    expect(rowToEvent(eventRow({ side: "bench" })).side).toBeNull();
  });
});

describe("MemoryMatchRepository", () => {
  it("stores matches and filters by date and competition", async () => {
    const repo = new MemoryMatchRepository();
    await repo.upsertMatches([
      match(),
      match({
        id: "espn:402",
        externalId: "402",
        competitionId: "esp.1",
        kickoff: "2026-10-26T19:00:00.000Z",
        updatedAt: NOW,
      }),
    ]);

    expect(await repo.getMatches({ date: "2026-10-25" })).toHaveLength(1);
    expect(
      await repo.getMatches({ date: "2026-10-26", competitionId: "esp.1" }),
    ).toHaveLength(1);
    expect(await repo.getMatches({ competitionId: "ita.1" })).toHaveLength(0);
  });

  it("inserts events idempotently", async () => {
    const repo = new MemoryMatchRepository();
    await repo.upsertMatches([match()]);

    expect(await repo.insertEvents([event()])).toHaveLength(1);
    expect(await repo.insertEvents([event()])).toHaveLength(0);
    expect(await repo.getEvents("espn:401")).toHaveLength(1);
  });

  it("preserves probability when a match is refreshed", async () => {
    const repo = new MemoryMatchRepository();
    await repo.upsertMatches([match()]);
    await repo.setProbability("espn:401", {
      home: 0.5,
      draw: 0.3,
      away: 0.2,
    });
    await repo.upsertMatches([match({ score: { home: 2, away: 2 } })]);

    const stored = await repo.getMatch("espn:401");
    expect(stored?.score).toEqual({ home: 2, away: 2 });
    expect(stored?.probability).toEqual({ home: 0.5, draw: 0.3, away: 0.2 });
  });

  it("stores room codes", async () => {
    const repo = new MemoryMatchRepository();
    await repo.createRoom("ABC123", "espn:401");
    await repo.createRoom("ABC123", "espn:999");

    expect(await repo.getRoom("ABC123")).toEqual({
      code: "ABC123",
      matchId: "espn:401",
    });
    expect(await repo.getRoom("NOPE")).toBeNull();
  });
});
