/**
 * ESPN scoreboard parser.
 *
 * The payload is untrusted. One malformed event must never take down a whole
 * competition, so parsing is per-event and failures are counted, not thrown.
 */

import { parseClockDisplay } from "../../domain/clock";
import { makeMatchId } from "../../domain/ids";
import type {
  Competition,
  Match,
  MatchClock,
  MatchStatus,
  Team,
} from "../../domain/types";
import {
  ESPN_PROVIDER_ID,
  asNumber,
  asRecord,
  asString,
  idString,
  parseMatchStatus,
  parseScore,
  parseTeam,
} from "./shared";

export { parseMatchStatus } from "./shared";

export interface ScoreboardParseResult {
  matches: Match[];
  /** Events dropped because required fields were missing or invalid. */
  skipped: number;
}

/** Build a domain clock from ESPN's status object. */
export function parseClock(raw: unknown, status: MatchStatus): MatchClock {
  const value = asRecord(raw);
  const parsed = parseClockDisplay(
    asString(value?.displayClock),
    asNumber(value?.clock) ?? 0,
  );

  if (status === "scheduled") {
    return { ...parsed, minute: 0, addedTime: 0, running: false };
  }

  return { ...parsed, running: status === "live" };
}

function parseEvent(
  raw: unknown,
  competition: Competition,
  now: Date,
): Match | null {
  const event = asRecord(raw);
  if (!event) return null;

  const externalId = idString(event.id);
  const kickoff = asString(event.date);
  const competitions = Array.isArray(event.competitions)
    ? event.competitions
    : [];
  const details = asRecord(competitions[0]);

  if (!externalId || !kickoff || !details) return null;

  const competitors = Array.isArray(details.competitors)
    ? details.competitors
    : [];

  let home: Team | null = null;
  let away: Team | null = null;
  let homeScore = 0;
  let awayScore = 0;

  for (const rawCompetitor of competitors) {
    const competitor = asRecord(rawCompetitor);
    const team = parseTeam(rawCompetitor);
    if (!competitor || !team) continue;

    if (competitor.homeAway === "home") {
      home = team;
      homeScore = parseScore(competitor.score);
    } else if (competitor.homeAway === "away") {
      away = team;
      awayScore = parseScore(competitor.score);
    }
  }

  if (!home || !away) return null;

  const statusRaw = details.status ?? event.status;
  const status = parseMatchStatus(statusRaw);
  const clock = parseClock(statusRaw, status);

  const venue =
    asString(asRecord(details.venue)?.fullName) ??
    asString(asRecord(event.venue)?.fullName);

  return {
    id: makeMatchId(ESPN_PROVIDER_ID, externalId),
    competitionId: competition.id,
    externalId,
    season: competition.season,
    kickoff,
    status,
    clock,
    home,
    away,
    score: { home: homeScore, away: awayScore },
    venue: venue ?? undefined,
    updatedAt: now.toISOString(),
  };
}

export function parseScoreboard(
  payload: unknown,
  competition: Competition,
  now: Date = new Date(),
): ScoreboardParseResult {
  const body = asRecord(payload);
  const events = Array.isArray(body?.events) ? body.events : [];

  const matches: Match[] = [];
  let skipped = 0;

  for (const event of events) {
    const match = parseEvent(event, competition, now);
    if (match) matches.push(match);
    else skipped += 1;
  }

  return { matches, skipped };
}
