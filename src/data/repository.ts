/**
 * Storage port.
 *
 * The poller and API depend on this interface, never on D1 directly. That
 * keeps the SQL in one place and lets tests run against an in-memory store.
 */

import type {
  Match,
  MatchEvent,
  MatchEventType,
  TeamSide,
  WinProbability,
} from "../domain/types";

/** A match plus its last computed model output. */
export interface StoredMatch extends Match {
  probability: WinProbability | null;
}

export interface MatchFilter {
  /** ISO date, compared against the UTC calendar day of kickoff. */
  date?: string;
  competitionId?: string;
}

export interface RoomRecord {
  code: string;
  matchId: string;
}

export interface MatchRepository {
  upsertMatches(matches: Match[]): Promise<void>;
  getMatches(filter?: MatchFilter): Promise<StoredMatch[]>;
  getMatch(id: string): Promise<StoredMatch | null>;
  getEvents(matchId: string): Promise<MatchEvent[]>;
  getKnownEventIds(matchId: string): Promise<Set<string>>;
  /** Inserts only events not already stored; returns the new ones. */
  insertEvents(events: MatchEvent[]): Promise<MatchEvent[]>;
  setProbability(matchId: string, probability: WinProbability): Promise<void>;
  createRoom(code: string, matchId: string): Promise<void>;
  getRoom(code: string): Promise<RoomRecord | null>;
}

export interface MatchRow {
  id: string;
  competition_id: string;
  external_id: string;
  season: string;
  kickoff: string;
  status: string;
  minute: number;
  added_time: number;
  clock_display: string;
  clock_running: number;
  home_id: string;
  home_name: string;
  home_short: string;
  home_crest: string | null;
  away_id: string;
  away_name: string;
  away_short: string;
  away_crest: string | null;
  home_score: number;
  away_score: number;
  venue: string | null;
  prob_home: number | null;
  prob_draw: number | null;
  prob_away: number | null;
  updated_at: string;
}

export interface EventRow {
  id: string;
  match_id: string;
  external_id: string;
  type: string;
  minute: number;
  added_time: number;
  sequence: number;
  side: string | null;
  player: string | null;
  assist: string | null;
  detail: string | null;
  score_home: number | null;
  score_away: number | null;
  created_at: string;
}

function asSide(value: string | null): TeamSide | null {
  return value === "home" || value === "away" ? value : null;
}

function probabilityOf(row: MatchRow): WinProbability | null {
  if (
    row.prob_home === null ||
    row.prob_draw === null ||
    row.prob_away === null
  ) {
    return null;
  }
  return {
    home: row.prob_home,
    draw: row.prob_draw,
    away: row.prob_away,
  };
}

export function rowToMatch(row: MatchRow): StoredMatch {
  return {
    id: row.id,
    competitionId: row.competition_id as StoredMatch["competitionId"],
    externalId: row.external_id,
    season: row.season,
    kickoff: row.kickoff,
    status: row.status as StoredMatch["status"],
    clock: {
      minute: row.minute,
      addedTime: row.added_time,
      display: row.clock_display,
      running: row.clock_running === 1,
    },
    home: {
      id: row.home_id,
      externalId: row.home_id.split(":").at(-1) ?? row.home_id,
      name: row.home_name,
      shortName: row.home_short,
      crest: row.home_crest ?? undefined,
    },
    away: {
      id: row.away_id,
      externalId: row.away_id.split(":").at(-1) ?? row.away_id,
      name: row.away_name,
      shortName: row.away_short,
      crest: row.away_crest ?? undefined,
    },
    score: { home: row.home_score, away: row.away_score },
    venue: row.venue ?? undefined,
    updatedAt: row.updated_at,
    probability: probabilityOf(row),
  };
}

export function rowToEvent(row: EventRow): MatchEvent {
  const scoreAfter =
    row.score_home === null || row.score_away === null
      ? undefined
      : { home: row.score_home, away: row.score_away };

  return {
    id: row.id,
    matchId: row.match_id,
    externalId: row.external_id,
    type: row.type as MatchEventType,
    minute: row.minute,
    addedTime: row.added_time,
    sequence: row.sequence,
    side: asSide(row.side),
    player: row.player ?? undefined,
    assist: row.assist ?? undefined,
    detail: row.detail ?? undefined,
    scoreAfter,
    createdAt: row.created_at,
  };
}
