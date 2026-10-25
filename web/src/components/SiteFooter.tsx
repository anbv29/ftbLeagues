import { BallIcon } from "./Icons";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-left">
        <span className="footer-brand">
          ftbl<span>.</span>
        </span>
        <p>
          Live football, without the noise. Scores and key events from ESPN&apos;s
          public feed. Win probability is a model, not a prediction.
        </p>
      </div>

      <div className="footer-right">
        <span className="footer-badge">
          <BallIcon />
          No accounts · no paywall
        </span>
        <span className="footer-copy">Built for the 90 minutes.</span>
      </div>
    </footer>
  );
}
