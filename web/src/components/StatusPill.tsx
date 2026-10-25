import type { Match } from "../types";
import { isLive, statusLabel } from "../lib/format";

export function StatusPill({ match }: { match: Match }) {
  const live = isLive(match);

  return (
    <span
      className={`status-pill ${live ? "is-live" : ""} is-${match.status}`}
    >
      {live ? <i className="live-dot" aria-hidden="true" /> : null}
      {statusLabel(match)}
    </span>
  );
}
