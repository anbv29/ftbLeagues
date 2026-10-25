/**
 * Poller.
 *
 * One pass fetches every competition scoreboard for the current matchday,
 * stores the fixtures, then fetches full summaries only for matches that are
 * live (or have just finished). That keeps upstream traffic at roughly six
 * requests a minute plus one per live match, which is comfortably inside
 * ESPN's tolerance for a public feed.
 *
 * A failing competition never aborts the pass: failures are collected and
 * reported, and the next minute retries.
 */

import { listCompetitions } from "../config/competitions";
import type { MatchRepository, StoredMatch } from "../data/repository";
import type {
  Match,
  MatchEvent,
  Provider,
  WinProbability,
} from "../domain/types";
import { computeWinProbability } from "./probability";

export interface MatchUpdate {
  match: Match;
  /** Only events the room has not seen yet. */
  events: MatchEvent[];
  probability: WinProbability;
}

export interface PollFailure {
  competitionId?: string;
  matchId?: string;
  message: string;
}

export interface PollSummary {
  date: string;
  competitions: number;
  fixtures: number;
  detailed: number;
  events: number;
  failures: PollFailure[];
}

export interface PollDeps {
  provider: Provider;
  repo: MatchRepository;
  now?: () => Date;
  onUpdate?: (update: MatchUpdate) => Promise<void> | void;
  log?: (event: string, data?: Record<string, unknown>) => void;
}

export interface PollOptions {
  /** Override the matchday (YYYY-MM-DD). Mostly for backfills. */
  date?: string;
  /** Fetch every summary, including old finished matches. */
  backfill?: boolean;
  detailLimit?: number;
}

const DEFAULT_DETAIL_LIMIT = 15;
const DETAIL_CONCURRENCY = 4;

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function dateOffset(now: Date, days: number): string {
  return new Date(now.getTime() + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/**
 * European matches can run past midnight UTC. In those small hours we also
 * look at yesterday's card so a live match is not dropped mid-game.
 */
export function fixtureDates(now: Date, override?: string): string[] {
  if (override) return [override];
  const today = now.toISOString().slice(0, 10);
  return now.getUTCHours() < 3 ? [dateOffset(now, -1), today] : [today];
}

function isLive(match: Match): boolean {
  return match.status === "live" || match.status === "halftime";
}

function probabilityChanged(
  previous: WinProbability | null | undefined,
  next: WinProbability,
): boolean {
  if (!previous) return true;
  return (
    Math.abs(previous.home - next.home) >= 0.002 ||
    Math.abs(previous.draw - next.draw) >= 0.002 ||
    Math.abs(previous.away - next.away) >= 0.002
  );
}

async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      while (true) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) return;
        results[index] = await fn(items[index]!);
      }
    },
  );

  await Promise.all(workers);
  return results;
}

function detailsFor(
  matches: Match[],
  existing: Map<string, StoredMatch>,
  options: PollOptions,
): Match[] {
  const limit = options.detailLimit ?? DEFAULT_DETAIL_LIMIT;

  return matches
    .filter((match) => {
      if (options.backfill) return true;
      if (isLive(match)) return true;

      // Fetch the final summary once, on the transition to finished.
      const previous = existing.get(match.id);
      return (
        match.status === "finished" &&
        previous !== undefined &&
        previous.status !== "finished"
      );
    })
    .sort((a, b) => {
      if (isLive(a) !== isLive(b)) return isLive(a) ? -1 : 1;
      return a.kickoff.localeCompare(b.kickoff);
    })
    .slice(0, limit);
}

export async function pollOnce(
  deps: PollDeps,
  options: PollOptions = {},
): Promise<PollSummary> {
  const now = deps.now?.() ?? new Date();
  const dates = fixtureDates(now, options.date);
  const competitions = listCompetitions(now);
  const failures: PollFailure[] = [];

  const fixturesByDate = await Promise.all(
    dates.map(async (date) => {
      const settled = await Promise.allSettled(
        competitions.map(async (competition) => {
          const matches = await deps.provider.listMatches({
            competition,
            date,
          });
          return { competition, matches };
        }),
      );

      const matches: Match[] = [];
      settled.forEach((result, index) => {
        const competition = competitions[index]!;
        if (result.status === "rejected") {
          failures.push({
            competitionId: competition.id,
            message: messageOf(result.reason),
          });
          deps.log?.("fixtures_failed", {
            competitionId: competition.id,
            date,
            message: messageOf(result.reason),
          });
          return;
        }
        matches.push(...result.value.matches);
      });

      return { date, matches };
    }),
  );

  const byId = new Map<string, Match>();
  for (const { matches } of fixturesByDate) {
    for (const match of matches) byId.set(match.id, match);
  }
  const matches = [...byId.values()];

  const existing = new Map<string, StoredMatch>();
  for (const date of dates) {
    for (const match of await deps.repo.getMatches({ date })) {
      existing.set(match.id, match);
    }
  }

  await deps.repo.upsertMatches(matches);

  const targets = detailsFor(matches, existing, options);
  let detailed = 0;
  let eventCount = 0;

  await mapLimit(targets, DETAIL_CONCURRENCY, async (match) => {
    try {
      const detail = await deps.provider.getMatchDetail({
        competitionId: match.competitionId,
        externalId: match.externalId,
      });
      if (!detail) return;

      detailed += 1;
      const inserted = await deps.repo.insertEvents(detail.events);
      eventCount += inserted.length;

      const probability = computeWinProbability(detail.match, detail.events);
      const previous = existing.get(detail.match.id);

      if (probabilityChanged(previous?.probability, probability)) {
        await deps.repo.setProbability(detail.match.id, probability);
      }

      await deps.repo.upsertMatches([detail.match]);

      const statusChanged =
        !previous || previous.status !== detail.match.status;
      const scoreChanged =
        !previous ||
        previous.score.home !== detail.match.score.home ||
        previous.score.away !== detail.match.score.away;

      if (inserted.length > 0 || statusChanged || scoreChanged) {
        if (deps.onUpdate) {
          await deps.onUpdate({
            match: detail.match,
            events: inserted,
            probability,
          });
        }
      }
    } catch (error) {
      failures.push({
        matchId: match.id,
        message: messageOf(error),
      });
      deps.log?.("detail_failed", {
        matchId: match.id,
        message: messageOf(error),
      });
    }
  });

  const summary: PollSummary = {
    date: dates.at(-1) ?? now.toISOString().slice(0, 10),
    competitions: competitions.length,
    fixtures: matches.length,
    detailed,
    events: eventCount,
    failures,
  };

  deps.log?.("poll_complete", { ...summary });
  return summary;
}
