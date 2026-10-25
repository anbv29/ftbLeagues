export type {
  Competition,
  CompetitionId,
  Match,
  MatchEvent,
  MatchEventType,
  MatchStatus,
  Score,
  Team,
  WinProbability,
} from "../../src/domain/types";

export type {
  PresenceState,
  Reaction,
  ServerMessage,
  ServerUpdate,
  ServerWelcome,
} from "../../src/rooms/protocol";

import type {
  Match,
  MatchEvent,
  WinProbability,
} from "../../src/domain/types";

/** A match as returned by the API: stored state plus a model output. */
export interface MatchSummary extends Match {
  probability: WinProbability | null;
}

export interface MatchListResponse {
  date: string;
  competition: string | null;
  serverTime: string;
  count: number;
  matches: MatchSummary[];
}

export interface MatchDetailResponse {
  serverTime: string;
  match: MatchSummary;
  events: MatchEvent[];
  probability: WinProbability | null;
}

export interface CompetitionInfo {
  id: string;
  name: string;
  shortName: string;
  country: string;
  kind: "league" | "cup";
  season: string;
}

export interface CompetitionsResponse {
  competitions: CompetitionInfo[];
  serverTime: string;
}

export interface RoomResponse {
  room: { code: string; matchId: string };
  match: MatchSummary;
  serverTime: string;
}
