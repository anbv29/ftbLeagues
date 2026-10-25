import type { CSSProperties } from "react";
import { competitionShortName } from "../constants";
import { isLive, kickoffTime, timeUntil } from "../lib/format";
import type { CompetitionInfo, MatchSummary } from "../types";
import { ProbabilityBar } from "./ProbabilityBar";
import { StatusPill } from "./StatusPill";
import { TeamCrest } from "./TeamCrest";

interface MatchCardProps {
  match: MatchSummary;
  competitions: CompetitionInfo[];
  index: number;
  nowMs: number;
}

function scoreLabel(match: MatchSummary, side: "home" | "away"): string {
  if (
    match.status !== "live" &&
    match.status !== "halftime" &&
    match.status !== "finished"
  ) {
    return "–";
  }
  return String(match.score[side]);
}

function winner(match: MatchSummary, side: "home" | "away"): boolean {
  if (match.status !== "finished") return false;
  const other = side === "home" ? "away" : "home";
  return match.score[side] > match.score[other];
}

export function MatchCard({
  match,
  competitions,
  index,
  nowMs,
}: MatchCardProps) {
  const live = isLive(match);
  const style = {
    "--enter-delay": `${Math.min(index, 10) * 45}ms`,
  } as CSSProperties;

  return (
    <a
      className={`match-card ${live ? "is-live" : ""}`}
      href={`#/match/${encodeURIComponent(match.id)}`}
      style={style}
    >
      <span className="card-shine" aria-hidden="true" />

      <div className="card-top">
        <span className="card-comp">
          {competitionShortName(match.competitionId, competitions)}
        </span>
        <StatusPill match={match} />
      </div>

      <div className="card-teams">
        <div className={`card-team ${winner(match, "home") ? "is-winner" : ""}`}>
          <TeamCrest team={match.home} size="sm" />
          <span className="card-team-name">{match.home.name}</span>
          <span className="card-score">{scoreLabel(match, "home")}</span>
        </div>
        <div className={`card-team ${winner(match, "away") ? "is-winner" : ""}`}>
          <TeamCrest team={match.away} size="sm" />
          <span className="card-team-name">{match.away.name}</span>
          <span className="card-score">{scoreLabel(match, "away")}</span>
        </div>
      </div>

      <div className="card-bottom">
        <ProbabilityBar
          probability={match.probability}
          homeShort={match.home.shortName}
          awayShort={match.away.shortName}
          variant="mini"
        />
        <div className="card-meta">
          <span>{match.venue ?? "Venue TBC"}</span>
          <span>
            {match.status === "scheduled"
              ? timeUntil(match.kickoff, nowMs)
              : kickoffTime(match.kickoff)}
          </span>
        </div>
      </div>
    </a>
  );
}
