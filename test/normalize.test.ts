import { describe, expect, it } from "vitest";
import summaryFixture from "./fixtures/espn-summary.json";
import { resolveCompetition } from "../src/config/competitions";
import {
  computedFinalScore,
  mapEventType,
  normalizeKeyEvents,
  refineEventType,
  scoresAgree,
} from "../src/providers/espn/normalize";
import { parseSummary } from "../src/providers/espn/summary";
import type { EspnKeyEvent } from "../src/providers/espn/types";

const NOW = new Date("2026-10-24T18:00:00Z");

const competition = resolveCompetition("eng.1", NOW);
if (!competition) throw new Error("fixture competition missing");

const ref = {
  competitionId: "eng.1",
  externalId: "401879256",
} as const;

const fixture = parseSummary(summaryFixture, ref, competition, NOW).detail;
if (!fixture) throw new Error("fixture should parse");
const match = fixture.match;

function keyEvent(overrides: Partial<EspnKeyEvent> = {}): EspnKeyEvent {
  return {
    id: "evt",
    type: { type: "goal", text: "Goal" },
    clock: { value: 600, displayValue: "10'" },
    participants: [{ athlete: { displayName: "Scorer" } }],
    ...overrides,
  };
}

describe("mapEventType", () => {
  const cases: Array<[string, string | null]> = [
    ["kickoff", "kickoff"],
    ["goal", "goal"],
    ["goal---header", "goal"],
    ["goal---volley", "goal"],
    ["own-goal", "own_goal"],
    ["penalty---scored", "penalty_goal"],
    ["penalty---missed", "penalty_missed"],
    ["yellow-card", "yellow_card"],
    ["red-card", "red_card"],
    ["substitution", "substitution"],
    ["halftime", "halftime"],
    ["start-2nd-half", "kickoff"],
    ["start-extra-time", "kickoff"],
    ["end-regular-time", "fulltime"],
    ["end-extra-time", "fulltime"],
    ["end-penalty-shootout", "fulltime"],
    ["penalty---saved", "penalty_missed"],
    ["penalty---shootout-scored", "penalty_goal"],
    ["var---goal-cancelled", "var"],
    ["start-delay", null],
    ["end-delay", null],
    ["something-unknown", null],
  ];

  it.each(cases)("maps %s to %s", (slug, expected) => {
    expect(mapEventType(slug)).toBe(expected);
  });

  it("treats missing slugs as unmappable", () => {
    expect(mapEventType(undefined)).toBeNull();
    expect(mapEventType("")).toBeNull();
  });
});

describe("refineEventType", () => {
  it("turns a red card with second-yellow prose into second_yellow", () => {
    expect(
      refineEventType(
        "red_card",
        "Second yellow card to Cole Palmer (Chelsea) for a bad foul.",
      ),
    ).toBe("second_yellow");
  });

  it("keeps a straight red card as red_card", () => {
    expect(
      refineEventType("red_card", "Cole Palmer (Chelsea) is shown the red card."),
    ).toBe("red_card");
  });

  it("leaves other event types untouched", () => {
    expect(refineEventType("goal", "Goal! Aston Villa 1, Manchester City 0.")).toBe(
      "goal",
    );
  });
});

describe("normalizeKeyEvents", () => {
  it("keeps neutral events off both sides", () => {
    const events = normalizeKeyEvents(
      [
        keyEvent({
          id: "k1",
          type: { type: "kickoff", text: "Kickoff" },
          clock: { value: 0, displayValue: "" },
          team: { id: "362" },
          participants: [],
        }),
      ],
      match,
      NOW,
    );

    expect(events[0]).toMatchObject({
      type: "kickoff",
      side: null,
      minute: 0,
      sequence: 0,
    });
  });

  it("maps headed goals and their assists", () => {
    const events = normalizeKeyEvents(
      [
        keyEvent({
          id: "g2",
          type: { type: "goal---header", text: "Goal - Header" },
          team: { id: "382" },
          clock: { value: 3120, displayValue: "52'" },
          participants: [
            { athlete: { displayName: "Erling Haaland" } },
            { athlete: { displayName: "Iliman Ndiaye" } },
          ],
        }),
      ],
      match,
      NOW,
    );

    expect(events[0]).toMatchObject({
      type: "goal",
      side: "away",
      player: "Erling Haaland",
      assist: "Iliman Ndiaye",
      id: "espn:401879256:g2",
      scoreAfter: { home: 0, away: 1 },
    });
  });

  it("attributes own goals to the benefiting side, not the player's side", () => {
    // ESPN credits the goal to Tottenham (away) while the player is Chelsea's.
    const events = normalizeKeyEvents(
      [
        keyEvent({
          id: "og1",
          type: { type: "own-goal", text: "Own Goal" },
          team: { id: "382" },
          participants: [{ athlete: { displayName: "Mike Penders" } }],
        }),
      ],
      match,
      NOW,
    );

    expect(events[0]).toMatchObject({
      type: "own_goal",
      side: "away",
      player: "Mike Penders",
      scoreAfter: { home: 0, away: 1 },
    });
  });

  it("scores penalties but not missed penalties", () => {
    const events = normalizeKeyEvents(
      [
        keyEvent({
          id: "p1",
          type: { type: "penalty---scored", text: "Penalty - Scored" },
          team: { id: "362" },
          participants: [{ athlete: { displayName: "Federico Redondo" } }],
        }),
        keyEvent({
          id: "p2",
          type: { type: "penalty---missed", text: "Penalty - Missed" },
          team: { id: "382" },
          participants: [{ athlete: { displayName: "Pathé Ciss" } }],
        }),
        keyEvent({
          id: "g3",
          type: { type: "goal", text: "Goal" },
          team: { id: "382" },
          participants: [{ athlete: { displayName: "Erling Haaland" } }],
        }),
      ],
      match,
      NOW,
    );

    expect(events.map((event) => event.type)).toEqual([
      "penalty_goal",
      "penalty_missed",
      "goal",
    ]);
    expect(events[0]?.scoreAfter).toEqual({ home: 1, away: 0 });
    expect(events[1]?.scoreAfter).toBeUndefined();
    expect(events[2]?.scoreAfter).toEqual({ home: 1, away: 1 });
  });

  it("drops unknown events but keeps provider ordering", () => {
    const events = normalizeKeyEvents(
      [
        keyEvent({ id: "delay", type: { type: "start-delay", text: "Start Delay" } }),
        keyEvent({ id: "g1", type: { type: "goal", text: "Goal" } }),
      ],
      match,
      NOW,
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.externalId).toBe("g1");
    expect(events[0]?.sequence).toBe(1);
  });

  it("does not invent assists for penalties", () => {
    const events = normalizeKeyEvents(
      [
        keyEvent({
          id: "p1",
          type: { type: "penalty---scored", text: "Penalty - Scored" },
          team: { id: "362" },
          participants: [
            { athlete: { displayName: "Federico Redondo" } },
            { athlete: { displayName: "Someone Else" } },
          ],
        }),
      ],
      match,
      NOW,
    );

    expect(events[0]?.player).toBe("Federico Redondo");
    expect(events[0]?.assist).toBeUndefined();
  });
});

describe("normalizeKeyEvents edge cases", () => {
  it("detects a second yellow from the event prose", () => {
    const events = normalizeKeyEvents(
      [
        keyEvent({
          id: "rc1",
          type: { type: "red-card", text: "Red Card" },
          text: "Second yellow card to Cole Palmer (Chelsea) for a bad foul.",
          team: { id: "362" },
          participants: [{ athlete: { displayName: "Cole Palmer" } }],
        }),
      ],
      match,
      NOW,
    );

    expect(events[0]).toMatchObject({
      type: "second_yellow",
      side: "home",
      player: "Cole Palmer",
    });
  });

  it("never lets shootout kicks change the match score", () => {
    const events = normalizeKeyEvents(
      [
        keyEvent({
          id: "et1",
          team: { id: "362" },
          clock: { value: 6300, displayValue: "105'" },
        }),
        keyEvent({
          id: "so1",
          type: { type: "penalty---shootout-scored", text: "Shootout" },
          team: { id: "362" },
          shootout: true,
          clock: { value: 7200, displayValue: "120'" },
        }),
        keyEvent({
          id: "so2",
          type: { type: "penalty---shootout-missed", text: "Shootout" },
          team: { id: "382" },
          shootout: true,
          clock: { value: 7200, displayValue: "120'" },
        }),
      ],
      match,
      NOW,
    );

    expect(events.map((event) => event.type)).toEqual([
      "goal",
      "penalty_goal",
      "penalty_missed",
    ]);
    expect(events[1]?.scoreAfter).toBeUndefined();
    expect(computedFinalScore(events)).toEqual({ home: 1, away: 0 });
  });

  it("deduplicates repeated provider ids", () => {
    const events = normalizeKeyEvents(
      [keyEvent({ id: "dup" }), keyEvent({ id: "dup" })],
      match,
      NOW,
    );

    expect(events).toHaveLength(1);
  });

  it("leaves goals with an unknown team unattributed", () => {
    const events = normalizeKeyEvents(
      [keyEvent({ id: "g1", team: { id: "999" } })],
      match,
      NOW,
    );

    expect(events[0]?.side).toBeNull();
    expect(events[0]?.scoreAfter).toBeUndefined();
    expect(computedFinalScore(events)).toEqual({ home: 0, away: 0 });
  });

  it("reports whether the feed accounts for the provider score", () => {
    expect(scoresAgree(fixture.events, match)).toBe(true);

    const withoutGoals = normalizeKeyEvents([], match, NOW);
    expect(scoresAgree(withoutGoals, match)).toBe(false);
  });
});
