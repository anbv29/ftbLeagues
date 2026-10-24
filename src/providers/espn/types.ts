/**
 * Raw ESPN shapes.
 *
 * Deliberately partial: only the fields we consume are typed. Everything that
 * arrives from the network is still validated by the parser at runtime — these
 * interfaces describe intent, not a guarantee.
 */

export interface EspnStatus {
  clock?: number;
  displayClock?: string;
  period?: number;
  type?: {
    id?: string;
    name?: string;
    state?: string;
    completed?: boolean;
    description?: string;
    detail?: string;
    shortDetail?: string;
  };
}

export interface EspnTeam {
  id?: string | number;
  abbreviation?: string;
  displayName?: string;
  shortDisplayName?: string;
  name?: string;
  logo?: string;
}

export interface EspnCompetitor {
  id?: string;
  homeAway?: string;
  score?: string | number;
  winner?: boolean;
  team?: EspnTeam;
}

export interface EspnCompetition {
  id?: string;
  date?: string;
  status?: EspnStatus;
  venue?: { id?: string; fullName?: string };
  competitors?: EspnCompetitor[];
}

export interface EspnEvent {
  id?: string;
  date?: string;
  name?: string;
  shortName?: string;
  season?: { year?: number; slug?: string };
  status?: EspnStatus;
  competitions?: EspnCompetition[];
  venue?: { fullName?: string };
}

export interface EspnScoreboardResponse {
  events?: EspnEvent[];
  leagues?: Array<{ id?: string; name?: string }>;
}

export interface EspnKeyEvent {
  id?: string;
  type?: { id?: string; text?: string; type?: string };
  text?: string;
  shortText?: string;
  period?: { number?: number };
  clock?: { value?: number; displayValue?: string };
  scoringPlay?: boolean;
  team?: { id?: string; displayName?: string; abbreviation?: string };
  participants?: Array<{ athlete?: { id?: string; displayName?: string } }>;
  shootout?: boolean;
}

export interface EspnCommentaryLine {
  sequence?: number;
  time?: { value?: number; displayValue?: string };
  text?: string;
  play?: EspnKeyEvent;
}

export interface EspnSummaryResponse {
  header?: {
    id?: string;
    season?: { year?: number; slug?: string };
    competitions?: EspnCompetition[];
  };
  keyEvents?: EspnKeyEvent[];
  commentary?: EspnCommentaryLine[];
  gameInfo?: { venue?: { fullName?: string }; attendance?: number };
}
