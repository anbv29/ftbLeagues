import { useState } from "react";
import { useCompetitions } from "../lib/useCompetitions";
import {
  dateLabel,
  groupMatches,
  isoToday,
  longDateLabel,
  relativeTime,
  shiftIso,
} from "../lib/format";
import { useMatchList } from "../lib/useMatchList";
import { useNow } from "../lib/useNow";
import type { MatchSummary } from "../types";
import { Hero } from "./Hero";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BallIcon,
} from "./Icons";
import { LiveTicker } from "./LiveTicker";
import { MatchCard } from "./MatchCard";
import { PitchBackdrop } from "./PitchBackdrop";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

function MatchGroup({
  title,
  matches,
  competitions,
  startIndex,
  nowMs,
  live = false,
}: {
  title: string;
  matches: MatchSummary[];
  competitions: ReturnType<typeof useCompetitions>;
  startIndex: number;
  nowMs: number;
  live?: boolean;
}) {
  if (matches.length === 0) return null;

  return (
    <section className={`match-group ${live ? "is-live" : ""}`}>
      <div className="group-head">
        <h3>
          {live ? <span className="live-dot" aria-hidden="true" /> : null}
          {title}
        </h3>
        <span className="group-count">{matches.length}</span>
      </div>
      <div className="match-grid">
        {matches.map((match, index) => (
          <MatchCard
            key={match.id}
            match={match}
            competitions={competitions}
            index={startIndex + index}
            nowMs={nowMs}
          />
        ))}
      </div>
    </section>
  );
}

function MatchSkeletons() {
  return (
    <div className="match-grid" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <div className="match-card skeleton-card" key={index}>
          <div className="skeleton-line is-short" />
          <div className="skeleton-team">
            <span className="skeleton-dot" />
            <span className="skeleton-line" />
          </div>
          <div className="skeleton-team">
            <span className="skeleton-dot" />
            <span className="skeleton-line" />
          </div>
          <div className="skeleton-line is-bar" />
        </div>
      ))}
    </div>
  );
}

export function MatchListPage() {
  const [date, setDate] = useState(() => isoToday());
  const [competition, setCompetition] = useState<string | null>(null);
  const competitions = useCompetitions();
  const { data, loading, error, lastUpdated, refresh } = useMatchList(
    date,
    competition,
  );
  const now = useNow(1000);

  const matches = data?.matches ?? [];
  const groups = groupMatches(matches);
  const liveCount = groups.live.length;
  const today = isoToday();
  const updatedLabel =
    lastUpdated !== null ? relativeTime(lastUpdated, now) : "syncing";

  return (
    <div className="page-shell">
      <SiteHeader liveCount={liveCount} />

      <main className="list-main">
        <Hero
          live={groups.live}
          upcoming={groups.upcoming}
          total={data?.count ?? 0}
          competitions={competitions}
        />

        <LiveTicker matches={groups.live} competitions={competitions} />

        <section className="matches-section" id="matches">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                <span className="eyebrow-dot" aria-hidden="true" />
                Matchday
              </p>
              <h2>
                {dateLabel(date)}
                <span className="section-date">{longDateLabel(date)}</span>
              </h2>
            </div>

            <div className="date-nav">
              <button
                className="icon-btn"
                type="button"
                aria-label="Previous day"
                onClick={() => setDate((current) => shiftIso(current, -1))}
              >
                <ArrowLeftIcon />
              </button>
              <button
                className={`today-btn ${date === today ? "is-active" : ""}`}
                type="button"
                onClick={() => setDate(today)}
              >
                Today
              </button>
              <button
                className="icon-btn"
                type="button"
                aria-label="Next day"
                onClick={() => setDate((current) => shiftIso(current, 1))}
              >
                <ArrowRightIcon />
              </button>
            </div>
          </div>

          <div className="filter-bar">
            <div className="filter-scroll" role="group" aria-label="Competition filter">
              <button
                className={`chip ${competition === null ? "is-active" : ""}`}
                type="button"
                aria-pressed={competition === null}
                onClick={() => setCompetition(null)}
              >
                All
              </button>
              {competitions.map((item) => (
                <button
                  key={item.id}
                  className={`chip ${competition === item.id ? "is-active" : ""}`}
                  type="button"
                  aria-pressed={competition === item.id}
                  onClick={() => setCompetition(item.id)}
                >
                  {item.shortName}
                </button>
              ))}
            </div>

            <div className="filter-status">
              <span className="filter-updated">
                <span className="sync-dot" aria-hidden="true" />
                Updated {updatedLabel}
              </span>
              <button className="refresh-btn" type="button" onClick={refresh}>
                Refresh
              </button>
            </div>
          </div>

          {error ? (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button type="button" onClick={refresh}>
                Try again
              </button>
            </div>
          ) : null}

          {loading ? (
            <MatchSkeletons />
          ) : matches.length === 0 ? (
            <div className="empty-state">
              <PitchBackdrop variant="room" />
              <span className="empty-icon">
                <BallIcon />
              </span>
              <h3>No fixtures on this date</h3>
              <p>
                The top five leagues and the Champions League may simply be
                having a quiet day. Try another date.
              </p>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => setDate(today)}
              >
                Back to today
              </button>
            </div>
          ) : (
            <div className="match-groups">
              <MatchGroup
                title="Live now"
                matches={groups.live}
                competitions={competitions}
                startIndex={0}
                nowMs={now}
                live
              />
              <MatchGroup
                title="Next up"
                matches={groups.upcoming}
                competitions={competitions}
                startIndex={groups.live.length}
                nowMs={now}
              />
              <MatchGroup
                title="Results"
                matches={groups.finished}
                competitions={competitions}
                startIndex={groups.live.length + groups.upcoming.length}
                nowMs={now}
              />
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
