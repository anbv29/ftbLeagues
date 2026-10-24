/**
 * Runtime guards.
 *
 * Provider JSON is untrusted input. These narrow `unknown` to domain types at
 * the adapter boundary so a bad payload fails loudly in one place instead of
 * producing a half-valid match downstream.
 */

import type { CompetitionId, MatchEventType, MatchStatus } from "./types";

const COMPETITION_IDS = [
  "eng.1",
  "esp.1",
  "ita.1",
  "ger.1",
  "fra.1",
  "uefa.champions",
] as const satisfies readonly CompetitionId[];

const MATCH_STATUSES = [
  "scheduled",
  "live",
  "halftime",
  "finished",
  "postponed",
  "suspended",
  "abandoned",
] as const satisfies readonly MatchStatus[];

const MATCH_EVENT_TYPES = [
  "kickoff",
  "goal",
  "own_goal",
  "penalty_goal",
  "penalty_missed",
  "yellow_card",
  "second_yellow",
  "red_card",
  "substitution",
  "halftime",
  "fulltime",
  "var",
  "shot",
  "save",
  "corner",
] as const satisfies readonly MatchEventType[];

const GOAL_EVENT_TYPES = [
  "goal",
  "own_goal",
  "penalty_goal",
] as const satisfies readonly MatchEventType[];

const CARD_EVENT_TYPES = [
  "yellow_card",
  "second_yellow",
  "red_card",
] as const satisfies readonly MatchEventType[];

function isOneOf<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return (
    typeof value === "string" && (values as readonly string[]).includes(value)
  );
}

export function isCompetitionId(value: unknown): value is CompetitionId {
  return isOneOf(COMPETITION_IDS, value);
}

export function isMatchStatus(value: unknown): value is MatchStatus {
  return isOneOf(MATCH_STATUSES, value);
}

export function isMatchEventType(value: unknown): value is MatchEventType {
  return isOneOf(MATCH_EVENT_TYPES, value);
}

/** Goals that change the score, including own goals and penalties. */
export function isGoalEvent(type: MatchEventType): boolean {
  return GOAL_EVENT_TYPES.some((candidate) => candidate === type);
}

export function isCardEvent(type: MatchEventType): boolean {
  return CARD_EVENT_TYPES.some((candidate) => candidate === type);
}
