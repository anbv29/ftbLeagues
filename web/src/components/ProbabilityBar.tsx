import type { WinProbability } from "../types";
import { percentages } from "../lib/format";

interface ProbabilityBarProps {
  probability: WinProbability | null;
  homeShort: string;
  awayShort: string;
  variant?: "mini" | "full";
}

export function ProbabilityBar({
  probability,
  homeShort,
  awayShort,
  variant = "full",
}: ProbabilityBarProps) {
  if (!probability) {
    if (variant === "mini") {
      return <div className="prob-track is-empty" aria-hidden="true" />;
    }
    return (
      <div className="probability probability-empty">
        <span>Win probability appears at kick-off</span>
      </div>
    );
  }

  const { home, draw, away } = percentages(probability);
  const label = `${homeShort} ${home} percent, draw ${draw} percent, ${awayShort} ${away} percent`;

  if (variant === "mini") {
    return (
      <div className="prob-track prob-mini" role="img" aria-label={label}>
        <span className="prob-seg prob-home" style={{ width: `${home}%` }} />
        <span className="prob-seg prob-draw" style={{ width: `${draw}%` }} />
        <span className="prob-seg prob-away" style={{ width: `${away}%` }} />
      </div>
    );
  }

  return (
    <div className="probability">
      <div className="prob-head">
        <span className="prob-title">
          <span className="prob-kicker">Live model</span>
          Win probability
        </span>
        <span className="prob-note">Poisson · v1</span>
      </div>

      <div className="prob-legend">
        <span className="prob-team is-home">
          <span className="prob-abbr">{homeShort}</span>
          <strong>{home}%</strong>
        </span>
        <span className="prob-team is-draw">
          <span className="prob-abbr">Draw</span>
          <strong>{draw}%</strong>
        </span>
        <span className="prob-team is-away">
          <strong>{away}%</strong>
          <span className="prob-abbr">{awayShort}</span>
        </span>
      </div>

      <div className="prob-track" role="img" aria-label={label}>
        <span className="prob-seg prob-home" style={{ width: `${home}%` }} />
        <span className="prob-seg prob-draw" style={{ width: `${draw}%` }} />
        <span className="prob-seg prob-away" style={{ width: `${away}%` }} />
      </div>
    </div>
  );
}
