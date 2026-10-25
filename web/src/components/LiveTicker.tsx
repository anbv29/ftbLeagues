import type { CSSProperties } from "react";
import { competitionShortName } from "../constants";
import { statusLabel } from "../lib/format";
import type { CompetitionInfo, MatchSummary } from "../types";
import { TeamCrest } from "./TeamCrest";

interface LiveTickerProps {
  matches: MatchSummary[];
  competitions: CompetitionInfo[];
}

export function LiveTicker({ matches, competitions }: LiveTickerProps) {
  if (matches.length === 0) return null;

  // Repeat the live set enough times that each half of the marquee fills a
  // wide viewport, then duplicate it so the -50% loop is seamless.
  const repeats = Math.max(2, Math.ceil(7 / matches.length));
  const half = Array.from({ length: repeats }, () => matches).flat();
  const loop = [...half, ...half];
  const style = {
    "--ticker-duration": `${Math.max(32, half.length * 7)}s`,
  } as CSSProperties;

  return (
    <section className="ticker" aria-label="Live scores ticker">
      <div className="ticker-badge">
        <span className="live-dot" aria-hidden="true" />
        Live
      </div>

      <div className="ticker-window">
        <div className="ticker-track" style={style}>
          {loop.map((match, index) => {
            const duplicate = index >= half.length;
            return (
              <a
                key={`${match.id}-${index}`}
                className="ticker-item"
                href={`#/match/${encodeURIComponent(match.id)}`}
                aria-hidden={duplicate}
                tabIndex={duplicate ? -1 : 0}
              >
                <span className="ticker-comp">
                  {competitionShortName(match.competitionId, competitions)}
                </span>
                <TeamCrest team={match.home} size="sm" />
                <span className="ticker-team">{match.home.shortName}</span>
                <span className="ticker-score">
                  {match.score.home}
                  <i>–</i>
                  {match.score.away}
                </span>
                <span className="ticker-team">{match.away.shortName}</span>
                <TeamCrest team={match.away} size="sm" />
                <span className="ticker-clock">{statusLabel(match)}</span>
              </a>
            );
          })}
        </div>
      </div>

      <span className="ticker-end">Tap to join</span>
    </section>
  );
}
