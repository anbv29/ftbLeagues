/**
 * D1 implementation of the storage port.
 *
 * All SQL lives here. Writes are deliberately conservative: the match upsert
 * only touches a row when something visible changed, which keeps the poller
 * inside D1's free daily write budget.
 */

import type { Match, MatchEvent, WinProbability } from "../domain/types";
import type {
  EventRow,
  MatchFilter,
  MatchRepository,
  MatchRow,
  RoomRecord,
  StoredMatch,
} from "./repository";
import { rowToEvent, rowToMatch } from "./repository";

const MATCH_COLUMNS = `
  id, competition_id, external_id, season, kickoff, status, minute, added_time,
  clock_display, clock_running, home_id, home_name, home_short, home_crest,
  away_id, away_name, away_short, away_crest, home_score, away_score, venue,
  updated_at
`;

const UPSERT_MATCH = `
  INSERT INTO matches (${MATCH_COLUMNS})
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    competition_id = excluded.competition_id,
    external_id = excluded.external_id,
    season = excluded.season,
    kickoff = excluded.kickoff,
    status = excluded.status,
    minute = excluded.minute,
    added_time = excluded.added_time,
    clock_display = excluded.clock_display,
    clock_running = excluded.clock_running,
    home_id = excluded.home_id,
    home_name = excluded.home_name,
    home_short = excluded.home_short,
    home_crest = excluded.home_crest,
    away_id = excluded.away_id,
    away_name = excluded.away_name,
    away_short = excluded.away_short,
    away_crest = excluded.away_crest,
    home_score = excluded.home_score,
    away_score = excluded.away_score,
    venue = excluded.venue,
    updated_at = excluded.updated_at
  WHERE
    matches.competition_id IS NOT excluded.competition_id OR
    matches.kickoff IS NOT excluded.kickoff OR
    matches.status IS NOT excluded.status OR
    matches.minute IS NOT excluded.minute OR
    matches.added_time IS NOT excluded.added_time OR
    matches.clock_display IS NOT excluded.clock_display OR
    matches.clock_running IS NOT excluded.clock_running OR
    matches.home_score IS NOT excluded.home_score OR
    matches.away_score IS NOT excluded.away_score OR
    matches.venue IS NOT excluded.venue
`;

const INSERT_EVENT = `
  INSERT OR IGNORE INTO match_events (
    id, match_id, external_id, type, minute, added_time, sequence, side,
    player, assist, detail, score_home, score_away, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

function matchValues(match: Match): (string | number | null)[] {
  return [
    match.id,
    match.competitionId,
    match.externalId,
    match.season,
    match.kickoff,
    match.status,
    match.clock.minute,
    match.clock.addedTime,
    match.clock.display,
    match.clock.running ? 1 : 0,
    match.home.id,
    match.home.name,
    match.home.shortName,
    match.home.crest ?? null,
    match.away.id,
    match.away.name,
    match.away.shortName,
    match.away.crest ?? null,
    match.score.home,
    match.score.away,
    match.venue ?? null,
    match.updatedAt,
  ];
}

function eventValues(event: MatchEvent): (string | number | null)[] {
  return [
    event.id,
    event.matchId,
    event.externalId,
    event.type,
    event.minute,
    event.addedTime,
    event.sequence,
    event.side,
    event.player ?? null,
    event.assist ?? null,
    event.detail ?? null,
    event.scoreAfter?.home ?? null,
    event.scoreAfter?.away ?? null,
    event.createdAt,
  ];
}

export class D1MatchRepository implements MatchRepository {
  constructor(private readonly db: D1Database) {}

  async upsertMatches(matches: Match[]): Promise<void> {
    if (matches.length === 0) return;
    const statement = this.db.prepare(UPSERT_MATCH);
    await this.db.batch(matches.map((match) => statement.bind(...matchValues(match))));
  }

  async getMatches(filter: MatchFilter = {}): Promise<StoredMatch[]> {
    const clauses: string[] = [];
    const values: string[] = [];

    if (filter.date) {
      clauses.push("substr(kickoff, 1, 10) = ?");
      values.push(filter.date);
    }
    if (filter.competitionId) {
      clauses.push("competition_id = ?");
      values.push(filter.competitionId);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const result = await this.db
      .prepare(`SELECT * FROM matches ${where} ORDER BY kickoff ASC`)
      .bind(...values)
      .all<MatchRow>();

    return result.results.map(rowToMatch);
  }

  async getMatch(id: string): Promise<StoredMatch | null> {
    const row = await this.db
      .prepare("SELECT * FROM matches WHERE id = ?")
      .bind(id)
      .first<MatchRow>();
    return row ? rowToMatch(row) : null;
  }

  async getEvents(matchId: string): Promise<MatchEvent[]> {
    const result = await this.db
      .prepare("SELECT * FROM match_events WHERE match_id = ? ORDER BY sequence ASC")
      .bind(matchId)
      .all<EventRow>();
    return result.results.map(rowToEvent);
  }

  async getKnownEventIds(matchId: string): Promise<Set<string>> {
    const result = await this.db
      .prepare("SELECT external_id FROM match_events WHERE match_id = ?")
      .bind(matchId)
      .all<{ external_id: string }>();
    return new Set(result.results.map((row) => row.external_id));
  }

  async insertEvents(events: MatchEvent[]): Promise<MatchEvent[]> {
    if (events.length === 0) return [];

    const known = await this.getKnownEventIds(events[0]!.matchId);
    const fresh = events.filter((event) => !known.has(event.externalId));
    if (fresh.length === 0) return [];

    const statement = this.db.prepare(INSERT_EVENT);
    await this.db.batch(fresh.map((event) => statement.bind(...eventValues(event))));
    return fresh;
  }

  async setProbability(
    matchId: string,
    probability: WinProbability,
  ): Promise<void> {
    await this.db
      .prepare(
        `UPDATE matches
         SET prob_home = ?, prob_draw = ?, prob_away = ?
         WHERE id = ?`,
      )
      .bind(probability.home, probability.draw, probability.away, matchId)
      .run();
  }

  async createRoom(code: string, matchId: string): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO rooms (code, match_id, created_at)
         VALUES (?, ?, ?)
         ON CONFLICT(code) DO NOTHING`,
      )
      .bind(code, matchId, new Date().toISOString())
      .run();
  }

  async getRoom(code: string): Promise<RoomRecord | null> {
    const row = await this.db
      .prepare("SELECT code, match_id FROM rooms WHERE code = ?")
      .bind(code)
      .first<{ code: string; match_id: string }>();
    return row ? { code: row.code, matchId: row.match_id } : null;
  }
}
