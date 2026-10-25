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
  Score,
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
  "second-yellow": "second_yellow",
  substitution: "substitution",
  halftime: "halftime",
  "end-regular-time": "fulltime",
  "end-extra-time": "fulltime",
  "end-penalty-shootout": "fulltime",
  "penalty---saved": "penalty_missed",
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

  // "var", "var---goal-awarded", "var---goal-cancelled", ...
  if (normalized === "var" || normalized.startsWith("var---")) return "var";

  if (normalized.startsWith("penalty---")) {
    if (
      normalized.includes("miss") ||
      normalized.includes("saved") ||
      normalized.includes("save")
    ) {
      return "penalty_missed";
    }
    if (normalized.includes("scored") || normalized.includes("goal")) {
      return "penalty_goal";
    }
  }

  return null;
}

/**
 * A second bookable offence arrives as "red-card" with prose explaining it.
 * The slug alone cannot tell the difference, so the text is required.
 */
export function refineEventType(
  type: MatchEventType,
  text: string | undefined,
): MatchEventType {
  if (type === "red_card" && /second\s+yellow/i.test(text ?? "")) {
    return "second_yellow";
  }
  return type;
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
  const seen = new Set<string>();
  let homeScore = 0;
  let awayScore = 0;

  events.forEach((event, index) => {
    const externalId = idString(event.id);
    const mapped = mapEventType(event.type?.type);
    if (!externalId || !mapped || seen.has(externalId)) return;
    seen.add(externalId);

    const type = refineEventType(mapped, event.text);
    const slug = (event.type?.type ?? "").toLowerCase();
    const shootout = event.shootout === true || slug.includes("shootout");

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

    // Shootout kicks are recorded but never change the match score; a shootout
    // is a separate competition from the 120 minutes before it.
    if (isGoalEvent(type) && side && !shootout) {
      if (side === "home") homeScore += 1;
      else awayScore += 1;
      line.scoreAfter = { home: homeScore, away: awayScore };
    }

    normalized.push(line);
  });

  return normalized;
}

/** The score implied by the normalized feed, i.e. the last goal's scoreAfter. */
export function computedFinalScore(events: MatchEvent[]): Score {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const score = events[index]?.scoreAfter;
    if (score) return score;
  }
  return { home: 0, away: 0 };
}

/**
 * Whether the feed's goals account for the provider's score. Useful as a
 * drift alarm on finished matches; on live matches the provider often updates
 * the score before the key event arrives, so a temporary mismatch is normal.
 */
export function scoresAgree(events: MatchEvent[], match: Match): boolean {
  const computed = computedFinalScore(events);
  return (
    computed.home === match.score.home && computed.away === match.score.away
  );
}
