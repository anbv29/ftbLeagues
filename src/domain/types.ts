/**
 * The domain model.
 *
 * Everything downstream of a provider speaks these types only. Provider
 * payloads never escape the adapter, which is what makes the data source
 * swappable without touching the poller, rooms or UI.
 */

/** Stable identifier for a competition we support. */
export type CompetitionId =
  | "eng.1"
  | "esp.1"
  | "ita.1"
  | "ger.1"
  | "fra.1"
  | "uefa.champions";

export interface Competition {
  id: CompetitionId;
  name: string;
  shortName: string;
  country: string;
  kind: "league" | "cup";
  /** Season label, e.g. "2026-27". */
  season: string;
}

export type TeamSide = "home" | "away";

export interface Team {
  /** Internal id, namespaced by provider: `${providerId}:${externalId}`. */
  id: string;
  /** The id used by the upstream provider. */
  externalId: string;
  name: string;
  /** Short code used in tight UI, e.g. "ARS". */
  shortName: string;
  crest?: string;
}

export type MatchStatus =
  | "scheduled"
  | "live"
  | "halftime"
  | "finished"
  | "postponed"
  | "suspended"
  | "abandoned";

export interface Score {
  home: number;
  away: number;
}

export interface MatchClock {
  /** Elapsed minute, 0-120+. */
  minute: number;
  /** Minutes of stoppage time currently being played, 0 when not applicable. */
  addedTime: number;
  /** Provider display string, e.g. "45'+2'". */
  display: string;
  /** True while the clock is actually running (drives the UI pulse). */
  running: boolean;
}

export interface Match {
  /** Internal id, namespaced by provider. */
  id: string;
  competitionId: CompetitionId;
  externalId: string;
  season: string;
  /** ISO 8601 kickoff timestamp. */
  kickoff: string;
  status: MatchStatus;
  clock: MatchClock;
  home: Team;
  away: Team;
  score: Score;
  venue?: string;
  /** Last time the provider gave us new information. */
  updatedAt: string;
}

export type MatchEventType =
  | "kickoff"
  | "goal"
  | "own_goal"
  | "penalty_goal"
  | "penalty_missed"
  | "yellow_card"
  | "second_yellow"
  | "red_card"
  | "substitution"
  | "halftime"
  | "fulltime"
  | "var"
  | "shot"
  | "save"
  | "corner";

export interface MatchEvent {
  /** Internal id, unique per match: `${matchId}:${externalId}`. */
  id: string;
  matchId: string;
  externalId: string;
  type: MatchEventType;
  minute: number;
  addedTime: number;
  /**
   * Provider ordering within the match. Minute alone is not enough: two
   * events can share a minute, and added time complicates comparisons.
   */
  sequence: number;
  /** Null for neutral events such as kickoff or full time. */
  side: TeamSide | null;
  player?: string;
  assist?: string;
  detail?: string;
  /** Score immediately after this event, when the provider exposes it. */
  scoreAfter?: Score;
  /** When we ingested the event, not when it happened. */
  createdAt: string;
}

export interface CommentaryLine {
  id: string;
  minute: number;
  text: string;
  /** Provider-declared kind, e.g. "Goal" or "Commentary". */
  kind?: string;
}

export interface WinProbability {
  /** All three are 0..1 and sum to 1. */
  home: number;
  draw: number;
  away: number;
}

/** Everything a match room needs for one match. */
export interface MatchDetail {
  match: Match;
  events: MatchEvent[];
  commentary?: CommentaryLine[];
  probability?: WinProbability;
}

/** A provider-agnostic reference to a single match. */
export interface MatchRef {
  competitionId: CompetitionId;
  externalId: string;
}

export interface ListMatchesInput {
  competition: Competition;
  /** ISO date, YYYY-MM-DD. The adapter handles provider date formats. */
  date: string;
}

export interface ProviderCapabilities {
  liveScores: boolean;
  events: boolean;
  commentary: boolean;
  lineups: boolean;
  winProbability: boolean;
}

/**
 * The port every data source implements. Adapters translate their payloads
 * into domain types; nothing above this interface knows which provider is in
 * use.
 */
export interface Provider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;
  listMatches(input: ListMatchesInput): Promise<Match[]>;
  getMatchDetail(ref: MatchRef): Promise<MatchDetail | null>;
}
