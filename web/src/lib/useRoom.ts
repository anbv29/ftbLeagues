import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMatch } from "../api";
import type {
  Match,
  MatchEvent,
  PresenceState,
  Reaction,
  ServerMessage,
  WinProbability,
} from "../types";

export type ConnectionState = "connecting" | "live" | "reconnecting";

export interface FloatingReaction {
  id: string;
  emoji: Reaction;
  nickname: string;
}

export interface RoomState {
  match: Match | null;
  events: MatchEvent[];
  probability: WinProbability | null;
  presence: PresenceState;
  reactions: FloatingReaction[];
  connection: ConnectionState;
  serverTime: string | null;
  roomCode: string | null;
  error: string | null;
  loading: boolean;
  sendReaction: (emoji: Reaction) => void;
}

const EMPTY_PRESENCE: PresenceState = { count: 0, members: [] };

function mergeEvents(current: MatchEvent[], incoming: MatchEvent[]): MatchEvent[] {
  if (incoming.length === 0) return current;
  const known = new Set(current.map((event) => event.id));
  const fresh = incoming.filter((event) => !known.has(event.id));
  if (fresh.length === 0) return current;
  return [...current, ...fresh].sort((a, b) => a.sequence - b.sequence);
}

function reactionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useRoom(
  matchId: string,
  roomCode: string | null,
  nickname: string,
): RoomState {
  const [match, setMatch] = useState<Match | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [probability, setProbability] = useState<WinProbability | null>(null);
  const [presence, setPresence] = useState<PresenceState>(EMPTY_PRESENCE);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [serverTime, setServerTime] = useState<string | null>(null);
  const [serverRoomCode, setServerRoomCode] = useState<string | null>(roomCode);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const socketRef = useRef<WebSocket | null>(null);
  const nicknameRef = useRef(nickname);
  const welcomeRef = useRef(false);
  const reactionTimers = useRef<Set<number>>(new Set());

  useEffect(() => {
    nicknameRef.current = nickname;
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "hello", nickname }));
    }
  }, [nickname]);

  // Keep the visible code in step with the share link without tearing down a
  // healthy socket.
  useEffect(() => {
    setServerRoomCode(roomCode);
  }, [roomCode]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    welcomeRef.current = false;

    setMatch(null);
    setEvents([]);
    setProbability(null);
    setPresence(EMPTY_PRESENCE);
    setError(null);
    setLoading(true);

    fetchMatch(matchId, controller.signal)
      .then((response) => {
        if (cancelled || welcomeRef.current) return;
        setMatch(response.match);
        setEvents(
          [...response.events].sort((a, b) => a.sequence - b.sequence),
        );
        setProbability(
          response.probability ?? response.match.probability ?? null,
        );
        setServerTime(response.serverTime);
      })
      .catch((caught) => {
        if (cancelled) return;
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(
          caught instanceof Error ? caught.message : "Could not load this match",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // A room code only changes the share label; the match snapshot is the same.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  useEffect(() => {
    return () => {
      for (const timer of reactionTimers.current) window.clearTimeout(timer);
      reactionTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let heartbeat: number | undefined;
    let watchdog: number | undefined;
    let retryTimer: number | undefined;
    let attempt = 0;
    let lastMessageAt = Date.now();

    setConnection("connecting");

    const pushReaction = (emoji: Reaction, from: string) => {
      const id = reactionId();
      setReactions((current) => [
        ...current.slice(-9),
        { id, emoji, nickname: from },
      ]);
      const timer = window.setTimeout(() => {
        setReactions((current) => current.filter((item) => item.id !== id));
        reactionTimers.current.delete(timer);
      }, 2800);
      reactionTimers.current.add(timer);
    };

    const scheduleReconnect = () => {
      if (disposed) return;
      setConnection("reconnecting");
      const delay = Math.min(1000 * 2 ** attempt, 10_000);
      attempt += 1;
      retryTimer = window.setTimeout(connect, delay + Math.random() * 400);
    };

    const connect = () => {
      if (disposed) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const query = roomCode ? `?room=${encodeURIComponent(roomCode)}` : "";
      const url = `${protocol}//${window.location.host}/ws/${encodeURIComponent(matchId)}${query}`;

      try {
        socket = new WebSocket(url);
      } catch {
        scheduleReconnect();
        return;
      }

      socketRef.current = socket;

      socket.onopen = () => {
        attempt = 0;
        lastMessageAt = Date.now();
        setConnection("live");
        socket?.send(
          JSON.stringify({ type: "hello", nickname: nicknameRef.current }),
        );

        heartbeat = window.setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping" }));
          }
        }, 25_000);

        watchdog = window.setInterval(() => {
          if (
            socket?.readyState === WebSocket.OPEN &&
            Date.now() - lastMessageAt > 65_000
          ) {
            socket.close();
          }
        }, 20_000);
      };

      socket.onmessage = (event) => {
        lastMessageAt = Date.now();
        let message: ServerMessage;
        try {
          message = JSON.parse(String(event.data)) as ServerMessage;
        } catch {
          return;
        }

        switch (message.type) {
          case "welcome": {
            welcomeRef.current = true;
            setMatch(message.match);
            setEvents(
              [...message.events].sort((a, b) => a.sequence - b.sequence),
            );
            setProbability(message.probability);
            setPresence(message.presence);
            setServerRoomCode(message.room.code);
            setServerTime(message.serverTime);
            setError(null);
            setLoading(false);
            setConnection("live");
            break;
          }
          case "update": {
            setMatch(message.match);
            setEvents((current) => mergeEvents(current, message.events));
            setProbability(message.probability);
            setServerTime(message.serverTime);
            break;
          }
          case "presence": {
            setPresence(message.presence);
            break;
          }
          case "reaction": {
            pushReaction(message.emoji, message.nickname);
            break;
          }
          case "pong": {
            setServerTime(message.serverTime);
            break;
          }
          case "error": {
            break;
          }
        }
      };

      socket.onclose = () => {
        window.clearInterval(heartbeat);
        window.clearInterval(watchdog);
        heartbeat = undefined;
        watchdog = undefined;
        if (socketRef.current === socket) socketRef.current = null;
        if (!disposed) scheduleReconnect();
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    return () => {
      disposed = true;
      window.clearInterval(heartbeat);
      window.clearInterval(watchdog);
      window.clearTimeout(retryTimer);
      if (socket) {
        socket.onclose = null;
        socket.close(1000, "leaving");
      }
      socketRef.current = null;
    };
    // Joining a match uses the initial room code for validation. Changing the
    // share code while connected does not require a reconnect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  const sendReaction = useCallback((emoji: Reaction) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "reaction", emoji }));
    }
  }, []);

  return {
    match,
    events,
    probability,
    presence,
    reactions,
    connection,
    serverTime,
    roomCode: serverRoomCode ?? roomCode,
    error,
    loading,
    sendReaction,
  };
}
