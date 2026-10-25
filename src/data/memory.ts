/**
 * In-memory storage port.
 *
 * Used by unit tests and by the mock mode that makes the UI runnable without
 * any network access. Semantics mirror the D1 repository: event writes are
 * idempotent on (matchId, externalId).
 */

import type { Match, MatchEvent, WinProbability } from "../domain/types";
import type {
  MatchFilter,
  MatchRepository,
  RoomRecord,
  StoredMatch,
} from "./repository";

export class MemoryMatchRepository implements MatchRepository {
  private readonly matches = new Map<string, StoredMatch>();
  private readonly events = new Map<string, MatchEvent[]>();
  private readonly rooms = new Map<string, RoomRecord>();

  async upsertMatches(matches: Match[]): Promise<void> {
    for (const match of matches) {
      const previous = this.matches.get(match.id);
      this.matches.set(match.id, {
        ...match,
        probability: previous?.probability ?? null,
      });
      if (!this.events.has(match.id)) this.events.set(match.id, []);
    }
  }

  async getMatches(filter: MatchFilter = {}): Promise<StoredMatch[]> {
    return [...this.matches.values()]
      .filter((match) => {
        if (filter.date && match.kickoff.slice(0, 10) !== filter.date) {
          return false;
        }
        if (
          filter.competitionId &&
          match.competitionId !== filter.competitionId
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  }

  async getMatch(id: string): Promise<StoredMatch | null> {
    return this.matches.get(id) ?? null;
  }

  async getEvents(matchId: string): Promise<MatchEvent[]> {
    return [...(this.events.get(matchId) ?? [])].sort(
      (a, b) => a.sequence - b.sequence,
    );
  }

  async getKnownEventIds(matchId: string): Promise<Set<string>> {
    return new Set(
      (this.events.get(matchId) ?? []).map((event) => event.externalId),
    );
  }

  async insertEvents(events: MatchEvent[]): Promise<MatchEvent[]> {
    if (events.length === 0) return [];

    const matchId = events[0]!.matchId;
    const existing = this.events.get(matchId) ?? [];
    const known = new Set(existing.map((event) => event.externalId));
    const fresh = events.filter((event) => !known.has(event.externalId));

    if (fresh.length > 0) {
      this.events.set(
        matchId,
        [...existing, ...fresh].sort((a, b) => a.sequence - b.sequence),
      );
    }
    return fresh;
  }

  async setProbability(
    matchId: string,
    probability: WinProbability,
  ): Promise<void> {
    const match = this.matches.get(matchId);
    if (match) this.matches.set(matchId, { ...match, probability });
  }

  async createRoom(code: string, matchId: string): Promise<void> {
    if (!this.rooms.has(code)) this.rooms.set(code, { code, matchId });
  }

  async getRoom(code: string): Promise<RoomRecord | null> {
    return this.rooms.get(code) ?? null;
  }
}
