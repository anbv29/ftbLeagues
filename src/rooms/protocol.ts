/**
 * Wire protocol between the browser and a match room.
 *
 * Kept dependency-free so the same file can be imported by the Worker and by
 * the Vite frontend.
 */

import type {
  Match,
  MatchEvent,
  WinProbability,
} from "../domain/types";

export const PROTOCOL_VERSION = 1;
export const MAX_NICKNAME_LENGTH = 24;
export const REACTION_COOLDOWN_MS = 400;

export const REACTIONS = ["🔥", "⚽", "😱", "💪", "👏"] as const;
export type Reaction = (typeof REACTIONS)[number];

export type ClientMessage =
  | { type: "hello"; nickname: string }
  | { type: "ping" }
  | { type: "reaction"; emoji: Reaction };

export interface PresenceState {
  count: number;
  members: string[];
}

export interface RoomInfo {
  code: string | null;
}

export interface ServerWelcome {
  type: "welcome";
  protocol: number;
  serverTime: string;
  match: Match;
  events: MatchEvent[];
  probability: WinProbability | null;
  presence: PresenceState;
  room: RoomInfo;
}

export interface ServerUpdate {
  type: "update";
  serverTime: string;
  match: Match;
  /** Only events the client has not seen yet. */
  events: MatchEvent[];
  probability: WinProbability | null;
}

export interface ServerPresence {
  type: "presence";
  presence: PresenceState;
}

export interface ServerPong {
  type: "pong";
  serverTime: string;
}

export interface ServerReaction {
  type: "reaction";
  emoji: Reaction;
  nickname: string;
  serverTime: string;
}

export interface ServerError {
  type: "error";
  code: string;
  message: string;
}

export type ServerMessage =
  | ServerWelcome
  | ServerUpdate
  | ServerPresence
  | ServerPong
  | ServerReaction
  | ServerError;

export function cleanNickname(value: unknown): string {
  if (typeof value !== "string") return "Guest";
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, MAX_NICKNAME_LENGTH);
  return cleaned.length > 0 ? cleaned : "Guest";
}

export function isReaction(value: unknown): value is Reaction {
  return (
    typeof value === "string" &&
    (REACTIONS as readonly string[]).includes(value)
  );
}

export function parseClientMessage(raw: string): ClientMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;

  switch (record.type) {
    case "hello":
      return { type: "hello", nickname: cleanNickname(record.nickname) };
    case "ping":
      return { type: "ping" };
    case "reaction":
      return isReaction(record.emoji)
        ? { type: "reaction", emoji: record.emoji }
        : null;
    default:
      return null;
  }
}
