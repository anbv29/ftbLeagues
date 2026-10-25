/**
 * API router.
 *
 * Read-only match data plus room creation. The router takes its dependencies
 * explicitly so tests can run it against the in-memory repository.
 */

import { isKnownCompetition, listCompetitions } from "../config/competitions";
import type { MatchRepository } from "../data/repository";
import type { Provider } from "../domain/types";
import { generateRoomCode, isRoomCode } from "../domain/room-code";
import { pollOnce } from "../engine/poller";
import type { MatchUpdate } from "../engine/poller";
import { computeWinProbability } from "../engine/probability";
import type { Env } from "../env";
import { espnProvider } from "../providers/espn";
import { error, json, preflight } from "./http";

export interface ApiDeps {
  repo: MatchRepository;
  env: Env;
  provider?: Provider;
  now?: () => Date;
  onUpdate?: (update: MatchUpdate) => Promise<void> | void;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function isLocal(url: URL): boolean {
  return url.hostname === "127.0.0.1" || url.hostname === "localhost";
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function handleApi(
  request: Request,
  deps: ApiDeps,
): Promise<Response | null> {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") return preflight();
  if (!url.pathname.startsWith("/api/")) return null;

  const now = deps.now?.() ?? new Date();
  const serverTime = now.toISOString();
  const path = url.pathname.replace(/\/+$/, "");

  if (request.method === "GET" && path === "/api/health") {
    return json({ ok: true, service: "ftbl", serverTime });
  }

  if (request.method === "GET" && path === "/api/competitions") {
    return json({ competitions: listCompetitions(now), serverTime });
  }

  if (request.method === "GET" && path === "/api/matches") {
    const date = url.searchParams.get("date") ?? serverTime.slice(0, 10);
    if (!isIsoDate(date)) {
      return error(400, "invalid_date", "date must be YYYY-MM-DD");
    }

    const competition = url.searchParams.get("competition") ?? undefined;
    if (competition && !isKnownCompetition(competition)) {
      return error(400, "invalid_competition", "unknown competition");
    }

    const matches = await deps.repo.getMatches({
      date,
      competitionId: competition,
    });

    const withProbability = matches.map((match) => ({
      ...match,
      probability:
        match.probability ?? computeWinProbability(match, []),
    }));

    return json({
      date,
      competition: competition ?? null,
      serverTime,
      count: withProbability.length,
      matches: withProbability,
    });
  }

  if (request.method === "GET" && path.startsWith("/api/matches/")) {
    let id: string;
    try {
      id = decodeURIComponent(path.slice("/api/matches/".length));
    } catch {
      return error(400, "invalid_match_id");
    }

    if (!id) return error(400, "invalid_match_id");

    const match = await deps.repo.getMatch(id);
    if (!match) return error(404, "match_not_found");

    const events = await deps.repo.getEvents(id);
    return json({
      serverTime,
      match,
      events,
      probability: match.probability ?? computeWinProbability(match, events),
    });
  }

  if (request.method === "POST" && path === "/api/rooms") {
    const body = await readJson(request);
    const matchId =
      typeof body === "object" && body !== null && "matchId" in body
        ? (body as { matchId?: unknown }).matchId
        : null;

    if (typeof matchId !== "string" || matchId.length === 0) {
      return error(400, "invalid_match_id", "matchId is required");
    }

    const match = await deps.repo.getMatch(matchId);
    if (!match) return error(404, "match_not_found");

    let code = generateRoomCode();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const existing = await deps.repo.getRoom(code);
      if (!existing) break;
      code = generateRoomCode();
      if (attempt === 3) return error(503, "room_code_exhausted");
    }

    await deps.repo.createRoom(code, matchId);
    return json({ room: { code, matchId }, match, serverTime }, 201);
  }

  if (request.method === "GET" && path.startsWith("/api/rooms/")) {
    const code = path.slice("/api/rooms/".length).toUpperCase();
    if (!isRoomCode(code)) return error(404, "room_not_found");

    const room = await deps.repo.getRoom(code);
    if (!room) return error(404, "room_not_found");

    const match = await deps.repo.getMatch(room.matchId);
    if (!match) return error(404, "match_not_found");

    return json({ room, match, serverTime });
  }

  // Local development helper: force a poll without waiting for cron.
  if (request.method === "POST" && path === "/api/dev/poll") {
    if (deps.env.ENVIRONMENT === "production") {
      return error(404, "not_found");
    }
    if (!isLocal(url) && deps.env.ENVIRONMENT !== "development") {
      return error(404, "not_found");
    }

    const date = url.searchParams.get("date") ?? undefined;
    if (date && !isIsoDate(date)) {
      return error(400, "invalid_date", "date must be YYYY-MM-DD");
    }

    const summary = await pollOnce({
      provider: deps.provider ?? espnProvider,
      repo: deps.repo,
      now: deps.now,
      log: (event, data) => console.log(event, data),
      onUpdate: deps.onUpdate,
    }, {
      date,
      backfill: url.searchParams.get("backfill") === "1",
    });

    return json({ summary, serverTime });
  }

  return error(404, "not_found");
}
