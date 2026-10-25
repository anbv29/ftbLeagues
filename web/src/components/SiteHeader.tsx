import { BallIcon } from "./Icons";

interface SiteHeaderProps {
  liveCount?: number;
  compact?: boolean;
}

export function SiteHeader({ liveCount = 0, compact = false }: SiteHeaderProps) {
  return (
    <header className={`site-header ${compact ? "is-compact" : ""}`}>
      <a className="brand" href="#/" aria-label="ftbl home">
        <span className="brand-mark">
          <BallIcon />
        </span>
        <span className="brand-word">
          ftbl<span className="brand-dot">.</span>
        </span>
      </a>

      <div className="header-right">
        <span className="header-tag">Free · no account</span>
        <span className={`header-live ${liveCount > 0 ? "is-on" : ""}`}>
          <i className="live-dot" aria-hidden="true" />
          {liveCount > 0 ? `${liveCount} live` : "Live rooms"}
        </span>
      </div>
    </header>
  );
}
