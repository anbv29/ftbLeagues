/**
 * ftbl — real-time football match rooms.
 *
 * Worker entry point. Routes are added progressively; for now this only
 * exposes a health check so we can verify the runtime end to end.
 */

export interface Env {
  // Bindings are added as the project grows (D1, Durable Objects, assets).
}

const startedAt = new Date().toISOString();

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
      return json({
        ok: true,
        service: "ftbl",
        version: "0.1.0",
        startedAt,
        now: new Date().toISOString(),
      });
    }

    return json({ error: "not_found", path: pathname }, 404);
  },
} satisfies ExportedHandler<Env>;
