/**
 * ESPN key event normalizer.
 *
 * Turns provider events into domain events. Mapping is intentionally
 * conservative: unknown event types are dropped rather than guessed, so the
 * feed never shows something it cannot name.
 */

import { parseClockDisplay } from "../../domain/clock";
import { makeEventId } from "../../domain/ids";
import type {
  Match,
  MatchEvent,
  MatchEventType,
  TeamSide,
} from "../../domain/types";
import { isGoalEvent } from "../../domain/guards";
import { idString } from "./shared";
import type { EspnKeyEvent } from "./types";

const EVENT_TYPES: Record<string, MatchEventType> = {
  kickoff: "kickoff",
  "start-2nd-half": "kickoff",
  "start-extra-time": "kickoff",
  goal: "goal",
  "own-goal": "own_goal",
  "penalty---scored": "penalty_goal",
  "penalty---missed": "penalty_missed",
  "yellow-card": "yellow_card",
  "red-card": "red_card",
  substitution: "substitution",
  halftime: "halftime",
  "end-regular-time": "fulltime",
  "end-extra-time": "fulltime",
  var: "var",
  "corner-awarded": "corner",
  "shot-on-target": "shot",
  "shot-off-target": "shot",
  save: "save",
};

/** Neutral events belong to the match, not to a side. */
const NEUTRAL_TYPES = new Set<MatchEventType>([
  "kickoff",
  "halftime",
  "fulltime",
]);

export function mapEventType(slug: string | null | undefined): MatchEventType | null {
  if (!slug) return null;

  const normalized = slug.toLowerCase();
  const exact = EVENT_TYPES[normalized];
  if (exact) return exact;

  // Variants such as "goal---header", "goal---volley", "goal---free-kick".
  if (normalized.startsWith("goal---")) return "goal";

  if (normalized.startsWith("penalty---")) {
    if (normalized.includes("miss")) return "penalty_missed";
    if (normalized.includes("scored") || normalized.includes("goal")) {
      return "penalty_goal";
    }
  }

  return null;
}

function sideFor(
  event: EspnKeyEvent,
  match: Match,
  type: MatchEventType,
): TeamSide | null {
  if (NEUTRAL_TYPES.has(type)) return null;

  const teamId = idString(event.team?.id);
  if (!teamId) return null;
  if (teamId === match.home.externalId) return "home";
  if (teamId === match.away.externalId) return "away";
  return null;
}

function participant(
  event: EspnKeyEvent,
  index: number,
): string | undefined {
  return event.participants?.[index]?.athlete?.displayName;
}

export function normalizeKeyEvents(
  events: EspnKeyEvent[],
  match: Match,
  now: Date = new Date(),
): MatchEvent[] {
  const normalized: MatchEvent[] = [];
  let homeScore = 0;
  let awayScore = 0;

  events.forEach((event, index) => {
    const externalId = idString(event.id);
    const type = mapEventType(event.type?.type);
    if (!externalId || !type) return;

    const clock = parseClockDisplay(
      event.clock?.displayValue,
      event.clock?.value ?? 0,
    );
    const side = sideFor(event, match, type);

    const line: MatchEvent = {
      id: makeEventId(match.id, externalId),
      matchId: match.id,
      externalId,
      type,
      minute: clock.minute,
      addedTime: clock.addedTime,
      sequence: index,
      side,
      player: participant(event, 0),
      // ESPN puts the provider first and the assist second on goals.
      assist: type === "goal" ? participant(event, 1) : undefined,
      detail: event.text,
      createdAt: now.toISOString(),
    };

    if (isGoalEvent(type) && side) {
      if (side === "home") homeScore += 1;
      else awayScore += 1;
      line.scoreAfter = { home: homeScore, away: awayScore };
    }

    normalized.push(line);
  });

  return normalized;
}
