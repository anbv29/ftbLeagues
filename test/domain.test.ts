import { describe, expect, it } from "vitest";
import {
  isCardEvent,
  isCompetitionId,
  isGoalEvent,
  isMatchEventType,
  isMatchStatus,
} from "../src/domain/guards";
import { makeEventId, makeMatchId, makeTeamId } from "../src/domain/ids";
import type { MatchEventType } from "../src/domain/types";

describe("competition guard", () => {
  it("accepts every supported competition", () => {
    for (const id of [
      "eng.1",
      "esp.1",
      "ita.1",
      "ger.1",
      "fra.1",
      "uefa.champions",
    ]) {
      expect(isCompetitionId(id)).toBe(true);
    }
  });

  it("rejects unknown or malformed ids", () => {
    expect(isCompetitionId("eng.2")).toBe(false);
    expect(isCompetitionId("ENG.1")).toBe(false);
    expect(isCompetitionId(null)).toBe(false);
    expect(isCompetitionId(1)).toBe(false);
  });
});

describe("match status guard", () => {
  it("accepts known statuses", () => {
    expect(isMatchStatus("live")).toBe(true);
    expect(isMatchStatus("halftime")).toBe(true);
    expect(isMatchStatus("finished")).toBe(true);
  });

  it("rejects provider spellings that were not mapped", () => {
    expect(isMatchStatus("Full Time")).toBe(false);
    expect(isMatchStatus("in")).toBe(false);
  });
});

describe("event type guard", () => {
  it("accepts known types", () => {
    expect(isMatchEventType("goal")).toBe(true);
    expect(isMatchEventType("own_goal")).toBe(true);
    expect(isMatchEventType("penalty_missed")).toBe(true);
  });

  it("rejects raw provider labels", () => {
    expect(isMatchEventType("Goal")).toBe(false);
    expect(isMatchEventType("Yellow Card")).toBe(false);
  });

  it("narrows unknown values for the compiler", () => {
    const value: unknown = "goal";
    if (!isMatchEventType(value)) throw new Error("expected guard to pass");
    const typed: MatchEventType = value;
    expect(typed).toBe("goal");
  });
});

describe("event groupings", () => {
  it("treats own goals and penalties as goals", () => {
    expect(isGoalEvent("goal")).toBe(true);
    expect(isGoalEvent("own_goal")).toBe(true);
    expect(isGoalEvent("penalty_goal")).toBe(true);
    expect(isGoalEvent("penalty_missed")).toBe(false);
  });

  it("groups all three card types", () => {
    expect(isCardEvent("yellow_card")).toBe(true);
    expect(isCardEvent("second_yellow")).toBe(true);
    expect(isCardEvent("red_card")).toBe(true);
    expect(isCardEvent("substitution")).toBe(false);
  });
});

describe("identifier helpers", () => {
  it("namespaces ids by provider", () => {
    expect(makeMatchId("espn", "401879256")).toBe("espn:401879256");
    expect(makeTeamId("espn", "359")).toBe("espn:359");
  });

  it("keeps event ids unique per match", () => {
    expect(makeEventId("espn:401879256", "12")).toBe("espn:401879256:12");
    expect(makeEventId("espn:401879256", "13")).not.toBe(
      makeEventId("espn:401879256", "12"),
    );
  });
});
