/**
 * ftbl — real-time football match rooms.
 *
 * Worker entry point. Routes are added progressively; for now this only
 * exposes a health check so we can verify the runtime end to end.
 */

import { listCompetitions } from "./config/competitions";

export interface Env {
  // Bindings are added as the project grows (D1, Durable Objects, assets).
}

// Workers does not allow clock reads at module scope (it returns the epoch),
// so the start time is captured lazily on the first request instead.
let startedAt: string | null = null;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request): Promise<Response> {
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

    if (pathname === "/api/competitions") {
      return json({ competitions: listCompetitions() });
    }

    return json({ error: "not_found", path: pathname }, 404);
  },
} satisfies ExportedHandler<Env>;
