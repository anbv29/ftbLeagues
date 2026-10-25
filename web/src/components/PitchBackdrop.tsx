interface PitchBackdropProps {
  variant?: "hero" | "room";
}

/**
 * Decorative pitch markings. Pure SVG so it stays crisp at any size and costs
 * nothing to load.
 */
export function PitchBackdrop({ variant = "hero" }: PitchBackdropProps) {
  return (
    <div className={`pitch-backdrop is-${variant}`} aria-hidden="true">
      <svg viewBox="0 0 1200 760" fill="none" preserveAspectRatio="xMidYMid slice">
        <g stroke="currentColor" strokeWidth="1.2">
          <rect x="80" y="70" width="1040" height="620" rx="2" />
          <line x1="600" y1="70" x2="600" y2="690" />
          <circle cx="600" cy="380" r="96" />
          <circle cx="600" cy="380" r="3.5" fill="currentColor" stroke="none" />
          <rect x="80" y="210" width="150" height="340" />
          <rect x="970" y="210" width="150" height="340" />
          <rect x="80" y="292" width="52" height="176" />
          <rect x="1068" y="292" width="52" height="176" />
          <path d="M230 292a96 96 0 0 1 0 176" />
          <path d="M970 292a96 96 0 0 0 0 176" />
          <path d="M80 70a24 24 0 0 1-24 24M1120 70a24 24 0 0 0 24 24M80 690a24 24 0 0 0-24-24M1120 690a24 24 0 0 1 24-24" />
        </g>
      </svg>
      <span className="pitch-glow" />
    </div>
  );
}
