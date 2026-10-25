/**
 * One Durable Object per match.
 *
 * Sockets hibernate between messages: Cloudflare keeps them alive without
 * billing CPU for an idle room, and `getWebSockets()` is the only state we
 * need for presence. Match updates arrive as internal HTTP posts from the
 * poller and are fanned out to every connected client.
 */

import { D1MatchRepository } from "../data/d1";
import type { Env } from "../env";
import { computeWinProbability } from "../engine/probability";
import type { MatchUpdate } from "../engine/poller";
import {
  PROTOCOL_VERSION,
  REACTION_COOLDOWN_MS,
  type PresenceState,
  type ServerMessage,
  cleanNickname,
  parseClientMessage,
} from "./protocol";

interface Attachment {
  nickname: string;
  joinedAt: string;
  lastReactionAt: number;
}

function defaultAttachment(): Attachment {
  return { nickname: "Guest", joinedAt: new Date().toISOString(), lastReactionAt: 0 };
}

export class MatchRoom implements DurableObject {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/broadcast" && request.method === "POST") {
      return this.handleBroadcast(request);
    }

    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("expected a websocket upgrade", { status: 426 });
    }

    let matchId: string;
    try {
      matchId = decodeURIComponent(url.pathname.replace(/^\/ws\//, ""));
    } catch {
      return new Response("invalid match id", { status: 400 });
    }
    if (!matchId) return new Response("missing match id", { status: 400 });

    const repo = new D1MatchRepository(this.env.DB);
    const match = await repo.getMatch(matchId);
    if (!match) return new Response("match not found", { status: 404 });

    const roomCode = url.searchParams.get("room")?.toUpperCase() ?? null;
    if (roomCode) {
      const room = await repo.getRoom(roomCode);
      if (!room || room.matchId !== matchId) {
        return new Response("room not found", { status: 404 });
      }
    }

    const events = await repo.getEvents(matchId);
    const probability =
      match.probability ?? computeWinProbability(match, events);

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.state.acceptWebSocket(server);
    server.serializeAttachment(defaultAttachment());

    const welcome: ServerMessage = {
      type: "welcome",
      protocol: PROTOCOL_VERSION,
      serverTime: new Date().toISOString(),
      match,
      events,
      probability,
      presence: this.presence(),
      room: { code: roomCode },
    };
    server.send(JSON.stringify(welcome));
    this.broadcastPresence();

    return new Response(null, { status: 101, webSocket: client });
  }

  private async handleBroadcast(request: Request): Promise<Response> {
    let update: MatchUpdate;
    try {
      update = (await request.json()) as MatchUpdate;
    } catch {
      return new Response("invalid update", { status: 400 });
    }

    this.broadcast({
      type: "update",
      serverTime: new Date().toISOString(),
      match: update.match,
      events: update.events,
      probability: update.probability,
    });
    return new Response(null, { status: 204 });
  }

  private attachment(ws: WebSocket): Attachment {
    const stored = ws.deserializeAttachment() as Attachment | null;
    return stored ?? defaultAttachment();
  }

  presence(): PresenceState {
    const sockets = this.state
      .getWebSockets()
      .filter((socket) => socket.readyState !== WebSocket.CLOSED);

    const members = new Set<string>();

    for (const socket of sockets) {
      members.add(this.attachment(socket).nickname);
    }

    return { count: sockets.length, members: [...members].sort() };
  }

  private broadcast(message: ServerMessage): void {
    const payload = JSON.stringify(message);
    for (const socket of this.state.getWebSockets()) {
      try {
        socket.send(payload);
      } catch {
        // The socket is closing; webSocketClose will clean up presence.
      }
    }
  }

  private broadcastPresence(): void {
    this.broadcast({ type: "presence", presence: this.presence() });
  }

  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    if (typeof message !== "string") return;

    const parsed = parseClientMessage(message);
    if (!parsed) {
      ws.send(
        JSON.stringify({
          type: "error",
          code: "bad_message",
          message: "unsupported message",
        } satisfies ServerMessage),
      );
      return;
    }

    const attachment = this.attachment(ws);

    switch (parsed.type) {
      case "hello": {
        attachment.nickname = cleanNickname(parsed.nickname);
        ws.serializeAttachment(attachment);
        this.broadcastPresence();
        break;
      }
      case "ping": {
        ws.send(
          JSON.stringify({
            type: "pong",
            serverTime: new Date().toISOString(),
          } satisfies ServerMessage),
        );
        break;
      }
      case "reaction": {
        const now = Date.now();
        if (now - attachment.lastReactionAt < REACTION_COOLDOWN_MS) return;
        attachment.lastReactionAt = now;
        ws.serializeAttachment(attachment);
        this.broadcast({
          type: "reaction",
          emoji: parsed.emoji,
          nickname: attachment.nickname,
          serverTime: new Date(now).toISOString(),
        });
        break;
      }
    }
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
  ): Promise<void> {
    try {
      // 1005 means "no status received" and is not a valid code to send.
      const safeCode = code === 1005 || code === 1006 ? 1000 : code;
      ws.close(safeCode, reason || "closed");
    } catch {
      // The socket may already be gone.
    }
    this.broadcastPresence();
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    try {
      ws.close(1011, "socket error");
    } catch {
      // Already closed.
    }
    this.broadcastPresence();
  }
}
