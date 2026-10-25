import type { ConnectionState } from "../lib/useRoom";

const COPY: Record<ConnectionState, string> = {
  connecting: "Connecting",
  live: "Live",
  reconnecting: "Reconnecting",
};

export function ConnectionBadge({ state }: { state: ConnectionState }) {
  return (
    <span className={`connection-badge is-${state}`}>
      <i aria-hidden="true" />
      {COPY[state]}
    </span>
  );
}
