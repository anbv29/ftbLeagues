/**
 * ftbl — real-time football match rooms.
 *
 * Worker entry point: HTTP API, cron poller, and (from Part 16) the Durable
 * Object that fans match updates out to room clients.
 */

import { json } from "./api/http";
import { handleApi } from "./api/router";
import { D1MatchRepository } from "./data/d1";
import type { Env } from "./env";
import { pollOnce } from "./engine/poller";
import { espnProvider } from "./providers/espn";
import { broadcastMatchUpdate } from "./rooms/broadcast";

export type { Env };
export { MatchRoom } from "./rooms/match-room";

// Workers does not allow clock reads at module scope (it returns the epoch),
// so the start time is captured lazily on the first request instead.
let startedAt: string | null = null;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/health") {
      startedAt ??= new Date().toISOString();
      return json({
        ok: true,
        service: "ftbl",
        version: "0.1.0",
        startedAt,
        now: new Date().toISOString(),
      });
    }

    if (pathname.startsWith("/ws/")) {
      if (!env.ROOMS) {
        return json({ error: "realtime_unavailable" }, 503);
      }
      const matchId = decodeURIComponent(pathname.slice("/ws/".length));
      const stub = env.ROOMS.get(env.ROOMS.idFromName(matchId));
      return stub.fetch(request);
    }

    const repo = new D1MatchRepository(env.DB);
    const response = await handleApi(request, {
      env,
      repo,
      onUpdate: (update) => broadcastMatchUpdate(env, update),
    });
    if (response) return response;

    return json({ error: "not_found", path: pathname }, 404);
  },

  async scheduled(_controller, env): Promise<void> {
    const repo = new D1MatchRepository(env.DB);
    const summary = await pollOnce({
      provider: espnProvider,
      repo,
      log: (event, data) => console.log(event, data),
      onUpdate: (update) => broadcastMatchUpdate(env, update),
    });
    console.log("poll", JSON.stringify(summary));
  },
} satisfies ExportedHandler<Env>;
