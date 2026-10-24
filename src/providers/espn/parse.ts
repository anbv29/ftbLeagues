/**
 * ESPN scoreboard parser.
 *
 * The payload is untrusted. One malformed event must never take down a whole
 * competition, so parsing is per-event and failures are counted, not thrown.
 */

import { makeMatchId, makeTeamId } from "../../domain/ids";
import type {
  Competition,
  Match,
  MatchClock,
  MatchStatus,
  Team,
} from "../../domain/types";

const PROVIDER_ID = "espn";

type JsonRecord = Record<string, unknown>;

export interface ScoreboardParseResult {
  matches: Match[];
  /** Events dropped because required fields were missing or invalid. */
  skipped: number;
}

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(numeric) ? numeric : null;
}

function idString(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/**
 * Map ESPN's status vocabulary onto the domain. Explicit names win over the
 * generic state, so a postponed match never reports as merely "scheduled".
 */
export function parseMatchStatus(raw: unknown): MatchStatus {
  const status = asRecord(raw);
  const type = asRecord(status?.type);
  const name = (asString(type?.name) ?? "").toUpperCase();
  const state = asString(type?.state);

  if (name.includes("POSTPONED")) return "postponed";
  if (
    name.includes("ABANDONED") ||
    name.includes("CANCELED") ||
    name.includes("CANCELLED")
  ) {
    return "abandoned";
  }
  if (name.includes("SUSPENDED")) return "suspended";
  if (name.includes("HALFTIME") || name.includes("HALF_TIME")) {
    return "halftime";
  }

  if (state === "in") return "live";
  if (state === "post") return "finished";
  return "scheduled";
}

const CLOCK_PATTERN = /^(\d+)(?:'\+(\d+))?/;

/**
 * ESPN reports elapsed seconds plus a display string. The display is the
 * source of truth because it distinguishes 90' from 90'+5', which the raw
 * seconds cannot.
 */
export function parseClock(raw: unknown, status: MatchStatus): MatchClock {
  const value = asRecord(raw);
  const display = asString(value?.displayClock) ?? "";
  const seconds = asNumber(value?.clock) ?? 0;

  let minute = Math.max(0, Math.floor(seconds / 60));
  let addedTime = 0;

  const parsed = CLOCK_PATTERN.exec(display);
  if (parsed) {
    const minutes = parsed[1];
    if (minutes !== undefined) minute = Number(minutes);
    addedTime = parsed[2] === undefined ? 0 : Number(parsed[2]);
  }

  if (status === "scheduled") {
    minute = 0;
    addedTime = 0;
  }

  return {
    minute,
    addedTime,
    display: display || `${minute}'`,
    running: status === "live",
  };
}

function parseScore(value: unknown): number {
  const score = asNumber(value);
  return score === null ? 0 : Math.max(0, Math.trunc(score));
}

function parseTeam(raw: unknown): Team | null {
  const competitor = asRecord(raw);
  const team = asRecord(competitor?.team);
  if (!team) return null;

  const externalId = idString(team.id);
  const name =
    asString(team.displayName) ??
    asString(team.name) ??
    asString(team.shortDisplayName);

  if (!externalId || !name) return null;

  return {
    id: makeTeamId(PROVIDER_ID, externalId),
    externalId,
    name,
    shortName: asString(team.abbreviation) ?? name.slice(0, 3).toUpperCase(),
    crest: asString(team.logo) ?? undefined,
  };
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
    id: makeMatchId(PROVIDER_ID, externalId),
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
