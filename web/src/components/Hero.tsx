import { competitionShortName } from "../constants";
import { fullKickoff, isLive, statusLabel } from "../lib/format";
import type { CompetitionInfo, MatchSummary } from "../types";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  BallIcon,
} from "./Icons";
import { ProbabilityBar } from "./ProbabilityBar";
import { TeamCrest } from "./TeamCrest";
import { PitchBackdrop } from "./PitchBackdrop";

interface HeroProps {
  live: MatchSummary[];
  upcoming: MatchSummary[];
  total: number;
  competitions: CompetitionInfo[];
}

function SpotlightCard({
  match,
  competitions,
}: {
  match: MatchSummary;
  competitions: CompetitionInfo[];
}) {
  const live = isLive(match);
  const scheduled = match.status === "scheduled";

  return (
    <a
      className={`spotlight ${live ? "is-live" : ""}`}
      href={`#/match/${encodeURIComponent(match.id)}`}
    >
      <span className="spotlight-glow" aria-hidden="true" />

      <div className="spotlight-top">
        <span className={`spotlight-tag ${live ? "is-live" : ""}`}>
          {live ? <i className="live-dot" aria-hidden="true" /> : null}
          {live ? "Live now" : scheduled ? "Next up" : "Match"}
        </span>
        <span className="spotlight-comp">
          {competitionShortName(match.competitionId, competitions)}
        </span>
      </div>

      <div className="spotlight-teams">
        <div className="spotlight-side">
          <TeamCrest team={match.home} size="lg" />
          <span className="spotlight-name">{match.home.shortName}</span>
          <span className="spotlight-fullname">{match.home.name}</span>
        </div>

        <div className="spotlight-middle">
          {scheduled ? (
            <span className="spotlight-vs">vs</span>
          ) : (
            <span className="spotlight-score">
              {match.score.home}
              <i>:</i>
              {match.score.away}
            </span>
          )}
          <span className={`spotlight-clock ${live ? "is-live" : ""}`}>
            {statusLabel(match)}
          </span>
        </div>

        <div className="spotlight-side is-away">
          <TeamCrest team={match.away} size="lg" />
          <span className="spotlight-name">{match.away.shortName}</span>
          <span className="spotlight-fullname">{match.away.name}</span>
        </div>
      </div>

      <ProbabilityBar
        probability={match.probability}
        homeShort={match.home.shortName}
        awayShort={match.away.shortName}
        variant="mini"
      />

      <div className="spotlight-foot">
        <span>{match.venue ?? fullKickoff(match.kickoff)}</span>
        <span className="spotlight-open">
          Open room
          <ArrowRightIcon />
        </span>
      </div>
    </a>
  );
}

export function Hero({ live, upcoming, total, competitions }: HeroProps) {
  const spotlight = live[0] ?? upcoming[0] ?? null;
  const liveCount = live.length;

  return (
    <section className="hero">
      <PitchBackdrop variant="hero" />

      <div className="hero-copy">
        <p className="eyebrow">
          <span className="eyebrow-dot" aria-hidden="true" />
          Six competitions · one live feed
        </p>

        <h1>
          Football,
          <br />
          <span className="hero-accent">in the room.</span>
        </h1>

        <p className="hero-sub">
          Every goal, card and turning point as it happens — with a live win
          probability and a seat next to people who care about the same 90
          minutes.
        </p>

        <div className="hero-actions">
          <a className="btn btn-primary" href="#matches">
            Today&apos;s matches
            <ArrowDownIcon />
          </a>
          {spotlight ? (
            <a
              className="btn btn-ghost"
              href={`#/match/${encodeURIComponent(spotlight.id)}`}
            >
              {isLive(spotlight) ? "Join a live room" : "Open the next room"}
              <ArrowRightIcon />
            </a>
          ) : null}
        </div>

        <dl className="hero-stats">
          <div>
            <dt>Live now</dt>
            <dd className={liveCount > 0 ? "is-accent" : ""}>
              {liveCount.toString().padStart(2, "0")}
            </dd>
          </div>
          <div>
            <dt>On the board</dt>
            <dd>{total.toString().padStart(2, "0")}</dd>
          </div>
          <div>
            <dt>Refresh</dt>
            <dd>
              60<span>s</span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="hero-visual">
        <span className="hero-orbit hero-orbit-one" aria-hidden="true" />
        <span className="hero-orbit hero-orbit-two" aria-hidden="true" />
        <span className="hero-ball" aria-hidden="true">
          <BallIcon />
        </span>

        {spotlight ? (
          <SpotlightCard match={spotlight} competitions={competitions} />
        ) : (
          <div className="spotlight spotlight-empty">
            <BallIcon className="empty-ball" />
            <p>The room is warming up.</p>
            <span>Fixtures land here as soon as the next matchday is live.</span>
          </div>
        )}

        <span className="hero-visual-label">
          <span className="live-dot" aria-hidden="true" />
          Updates every minute
        </span>
      </div>
    </section>
  );
}
