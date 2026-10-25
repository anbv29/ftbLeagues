import { describe, expect, it } from "vitest";
import type { Match, MatchEvent } from "../src/domain/types";
import {
  asPercentages,
  computeWinProbability,
  normalizeProbability,
} from "../src/engine/probability";

const NOW = "2026-10-25T18:00:00.000Z";

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
    updatedAt: NOW,
    ...overrides,
  };
}

function event(overrides: Partial<MatchEvent> = {}): MatchEvent {
  return {
    id: "event",
    matchId: "espn:401",
    externalId: "event",
    type: "yellow_card",
    minute: 60,
    addedTime: 0,
    sequence: 1,
    side: "home",
    createdAt: NOW,
    ...overrides,
  };
}

function total(probability: { home: number; draw: number; away: number }) {
  return probability.home + probability.draw + probability.away;
}

describe("computeWinProbability", () => {
  it("makes a finished match certain", () => {
    expect(
      computeWinProbability(match({ status: "finished", score: { home: 2, away: 1 } }), []),
    ).toEqual({ home: 1, draw: 0, away: 0 });
    expect(
      computeWinProbability(match({ status: "finished", score: { home: 1, away: 1 } }), []),
    ).toEqual({ home: 0, draw: 1, away: 0 });
    expect(
      computeWinProbability(match({ status: "finished", score: { home: 0, away: 3 } }), []),
    ).toEqual({ home: 0, draw: 0, away: 1 });
  });

  it("returns a pre-match prior for scheduled fixtures", () => {
    const probability = computeWinProbability(
      match({ status: "scheduled", score: { home: 0, away: 0 } }),
      [],
    );
    expect(probability).toEqual({ home: 0.45, draw: 0.27, away: 0.28 });
  });

  it("favours the leader late in the game", () => {
    const probability = computeWinProbability(match(), []);
    expect(total(probability)).toBeCloseTo(1, 2);
    expect(probability.home).toBeGreaterThan(0.75);
    expect(probability.home).toBeGreaterThan(probability.away);
  });

  it("expects a draw when the score is level and time is nearly up", () => {
    const probability = computeWinProbability(
      match({
        score: { home: 0, away: 0 },
        clock: { minute: 89, addedTime: 3, display: "89'+3'", running: true },
      }),
      [],
    );
    expect(probability.draw).toBeGreaterThan(0.75);
  });

  it("moves probability away from a side that loses a player", () => {
    const withoutCard = computeWinProbability(
      match({ score: { home: 1, away: 1 }, clock: { minute: 50, addedTime: 0, display: "50'", running: true } }),
      [],
    );
    const withHomeRed = computeWinProbability(
      match({ score: { home: 1, away: 1 }, clock: { minute: 50, addedTime: 0, display: "50'", running: true } }),
      [event({ type: "red_card", side: "home", minute: 49 })],
    );

    expect(withHomeRed.home).toBeLessThan(withoutCard.home);
    expect(withHomeRed.away).toBeGreaterThan(withoutCard.away);
  });

  it("counts a second yellow as a sending off", () => {
    const straightRed = computeWinProbability(
      match({ score: { home: 1, away: 1 } }),
      [event({ type: "red_card", side: "away" })],
    );
    const secondYellow = computeWinProbability(
      match({ score: { home: 1, away: 1 } }),
      [event({ type: "second_yellow", side: "away" })],
    );

    expect(secondYellow).toEqual(straightRed);
  });

  it("always returns a normalized distribution", () => {
    const probability = computeWinProbability(match(), []);
    expect(total(probability)).toBeCloseTo(1, 6);
    expect(probability.home).toBeGreaterThanOrEqual(0);
    expect(probability.draw).toBeGreaterThanOrEqual(0);
    expect(probability.away).toBeGreaterThanOrEqual(0);
  });
});

describe("normalizeProbability", () => {
  it("rescales and rounds to three decimals", () => {
    expect(normalizeProbability({ home: 2, draw: 1, away: 1 })).toEqual({
      home: 0.5,
      draw: 0.25,
      away: 0.25,
    });
  });

  it("falls back to the prior when everything is zero", () => {
    expect(normalizeProbability({ home: 0, draw: 0, away: 0 })).toEqual({
      home: 0.45,
      draw: 0.27,
      away: 0.28,
    });
  });
});

describe("asPercentages", () => {
  it("rounds to whole numbers that sum to 100", () => {
    const percentages = asPercentages({ home: 0.456, draw: 0.271, away: 0.273 });
    expect(percentages.home + percentages.draw + percentages.away).toBe(100);
    expect(percentages).toEqual({ home: 46, draw: 27, away: 27 });
  });
});
