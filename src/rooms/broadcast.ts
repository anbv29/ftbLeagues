/** Send a poller update to the match's Durable Object, if it is bound. */

import type { Env } from "../env";
import type { MatchUpdate } from "../engine/poller";

export async function broadcastMatchUpdate(
  env: Env,
  update: MatchUpdate,
): Promise<void> {
  if (!env.ROOMS) return;

  try {
    const stub = env.ROOMS.get(env.ROOMS.idFromName(update.match.id));
    const response = await stub.fetch("https://room.internal/broadcast", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(update),
    });
    if (!response.ok) {
      console.warn("room_broadcast_failed", {
        matchId: update.match.id,
        status: response.status,
      });
    }
  } catch (error) {
    console.warn("room_broadcast_error", {
      matchId: update.match.id,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
