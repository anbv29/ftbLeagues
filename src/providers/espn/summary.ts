/**
 * ESPN summary parser.
 *
 * The summary endpoint is the rich one: match header, key events, full
 * commentary and box score. It is also large (~400KB), so only the pieces the
 * room needs are kept.
 *
 * Key events are extracted here and mapped into domain events by the
 * normalizer, so a summary parse yields a feed ready to broadcast.
 */

import { parseClockDisplay } from "../../domain/clock";
import { makeMatchId } from "../../domain/ids";
import type {
  CommentaryLine,
  Competition,
  Match,
  MatchClock,
  MatchDetail,
  MatchRef,
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
import { normalizeKeyEvents } from "./normalize";
import type { JsonRecord } from "./shared";
import type { EspnKeyEvent } from "./types";
export interface SummaryParseResult {
  detail: MatchDetail | null;
  /** Raw key events, ready for the event normalizer. */
  keyEvents: EspnKeyEvent[];
}

export function parseSummary(
  payload: unknown,
  ref: MatchRef,
  competition: Competition,
  now: Date = new Date(),
): SummaryParseResult {
  const body = asRecord(payload);
  const header = asRecord(body?.header);
  const competitions = Array.isArray(header?.competitions)
    ? header.competitions
    : [];
  const details = asRecord(competitions[0]);

  if (!details) return { detail: null, keyEvents: [] };

  const kickoff = asString(details.date);
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

  if (!kickoff || !home || !away) return { detail: null, keyEvents: [] };

  const status = parseMatchStatus(details.status);
  const keyEvents = extractKeyEvents(body?.keyEvents);
  const commentaryRaw = Array.isArray(body?.commentary) ? body.commentary : [];

  const clock = inferClock([...keyEvents, ...commentaryRaw], status);
  const matchId = makeMatchId(ESPN_PROVIDER_ID, ref.externalId);

  const match: Match = {
    id: matchId,
    competitionId: ref.competitionId,
    externalId: ref.externalId,
    season: competition.season,
    kickoff,
    status,
    clock,
    home,
    away,
    score: { home: homeScore, away: awayScore },
    venue: asString(asRecord(asRecord(body?.gameInfo)?.venue)?.fullName) ?? undefined,
    updatedAt: now.toISOString(),
  };

  return {
    detail: {
      match,
      events: normalizeKeyEvents(keyEvents, match, now),
      commentary: parseCommentary(commentaryRaw, matchId),
    },
    keyEvents,
  };
}

function extractKeyEvents(raw: unknown): EspnKeyEvent[] {
  if (!Array.isArray(raw)) return [];

  return raw.filter((entry): entry is EspnKeyEvent => {
    const record = asRecord(entry);
    if (!record) return false;
    return Boolean(idString(record.id) && asRecord(record.type));
  });
}

/**
 * The header status carries no clock, so the minute is inferred from the
 * latest key event or commentary line. For live matches that is usually within
 * a minute of the real clock; the poller's scoreboard snapshot stays the
 * authority for exact minutes.
 */
function inferClock(sources: unknown[], status: MatchStatus): MatchClock {
  let bestSeconds = 0;
  let bestDisplay: string | null = null;

  for (const source of sources) {
    const record = asRecord(source);
    const clock = asRecord(record?.clock) ?? asRecord(record?.time);
    const seconds = asNumber(clock?.value) ?? 0;

    if (seconds >= bestSeconds) {
      bestSeconds = seconds;
      bestDisplay = asString(clock?.displayValue);
    }
  }

  const parsed = parseClockDisplay(bestDisplay, bestSeconds);

  if (status === "scheduled") {
    return { ...parsed, minute: 0, addedTime: 0, running: false };
  }

  return { ...parsed, running: status === "live" };
}

function parseCommentary(raw: unknown[], matchId: string): CommentaryLine[] {
  const entries: Array<{ sequence: number; line: JsonRecord }> = [];

  raw.forEach((entry, index) => {
    const record = asRecord(entry);
    if (!record || !asString(record.text)) return;
    entries.push({
      sequence: asNumber(record.sequence) ?? index,
      line: record,
    });
  });

  entries.sort((a, b) => a.sequence - b.sequence);

  const lines: CommentaryLine[] = [];
  let lastMinute = 0;

  for (const { sequence, line } of entries) {
    const text = asString(line.text);
    if (!text) continue;

    const time = asRecord(line.time);
    const display = asString(time?.displayValue);
    const seconds = asNumber(time?.value) ?? 0;

    let clock = parseClockDisplay(display, seconds);
    // ESPN omits the timestamp on lines like "Match ends", so inherit the
    // last known minute instead of dropping the line to 0'.
    if (!display && seconds === 0 && lastMinute > 0) {
      clock = { minute: lastMinute, addedTime: 0, display: `${lastMinute}'` };
    }
    if (clock.minute > 0) lastMinute = clock.minute;

    const play = asRecord(line.play);
    const kind = asString(asRecord(play?.type)?.text);

    lines.push({
      id: `${matchId}:c:${sequence}`,
      minute: clock.minute,
      text,
      kind: kind ?? undefined,
    });
  }

  return lines;
}
