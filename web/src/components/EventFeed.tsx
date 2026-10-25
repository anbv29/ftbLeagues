import type { Match, MatchEvent, MatchEventType } from "../types";
import { isLive } from "../lib/format";

interface EventMeta {
  label: string;
  glyph: string;
  tone: string;
}

const META: Record<MatchEventType, EventMeta> = {
  kickoff: { label: "Kick-off", glyph: "▶", tone: "neutral" },
  goal: { label: "Goal", glyph: "⚽", tone: "goal" },
  own_goal: { label: "Own goal", glyph: "⚽", tone: "goal" },
  penalty_goal: { label: "Penalty scored", glyph: "◎", tone: "goal" },
  penalty_missed: { label: "Penalty missed", glyph: "✕", tone: "miss" },
  yellow_card: { label: "Yellow card", glyph: "▮", tone: "yellow" },
  second_yellow: { label: "Second yellow", glyph: "▮▮", tone: "red" },
  red_card: { label: "Red card", glyph: "▮", tone: "red" },
  substitution: { label: "Substitution", glyph: "⇄", tone: "neutral" },
  halftime: { label: "Half-time", glyph: "Ⅱ", tone: "neutral" },
  fulltime: { label: "Full time", glyph: "■", tone: "neutral" },
  var: { label: "VAR check", glyph: "▣", tone: "var" },
  shot: { label: "Shot", glyph: "➤", tone: "neutral" },
  save: { label: "Save", glyph: "✋", tone: "neutral" },
  corner: { label: "Corner", glyph: "⚑", tone: "neutral" },
};

function minuteLabel(event: MatchEvent): string {
  return event.addedTime > 0
    ? `${event.minute}+${event.addedTime}'`
    : `${event.minute}'`;
}

function eventLabel(event: MatchEvent, meta: EventMeta): string {
  if (event.type === "kickoff" && event.minute >= 45) return "Second half";
  return meta.label;
}

function detailFor(event: MatchEvent): string {
  if (!event.detail) return "";
  if (
    event.type === "goal" ||
    event.type === "own_goal" ||
    event.type === "penalty_goal"
  ) {
    const stop = event.detail.indexOf(". ");
    if (stop > 8) return event.detail.slice(stop + 2);
  }
  return event.detail;
}

interface EventFeedProps {
  match: Match;
  events: MatchEvent[];
}

export function EventFeed({ match, events }: EventFeedProps) {
  const live = isLive(match);
  const ordered = [...events].sort(
    (a, b) => b.sequence - a.sequence || b.minute - a.minute,
  );

  return (
    <section className="feed-panel">
      <header className="feed-head">
        <div>
          <p className="eyebrow">Key moments</p>
          <h2>Match feed</h2>
        </div>
        <span className={`feed-count ${live ? "is-live" : ""}`}>
          {live ? <span className="live-dot" aria-hidden="true" /> : null}
          {events.length} {events.length === 1 ? "event" : "events"}
        </span>
      </header>

      {ordered.length === 0 ? (
        <div className="feed-empty">
          <span className="feed-empty-glyph">⚽</span>
          <h3>
            {match.status === "scheduled"
              ? "The room opens at kick-off"
              : "Waiting for the first key moment"}
          </h3>
          <p>
            Goals, cards, substitutions and VAR checks land here within a
            minute of the live feed.
          </p>
        </div>
      ) : (
        <div className="feed-list">
          {ordered.map((event) => {
            const meta = META[event.type];
            const team =
              event.side === "home"
                ? match.home
                : event.side === "away"
                  ? match.away
                  : null;
            const detail = detailFor(event);

            return (
              <article
                key={event.id}
                className={`event is-${meta.tone}`}
              >
                <span className="event-minute">{minuteLabel(event)}</span>

                <span className="event-rail" aria-hidden="true">
                  <span className="event-node">
                    <span className="event-glyph">{meta.glyph}</span>
                  </span>
                </span>

                <div className="event-body">
                  <div className="event-kicker">
                    <span>{eventLabel(event, meta)}</span>
                    {team ? (
                      <span className="event-team">{team.shortName}</span>
                    ) : null}
                  </div>

                  {event.player ? (
                    <h3 className="event-player">
                      {event.player}
                      {event.assist ? (
                        <span className="event-assist">
                          assisted by {event.assist}
                        </span>
                      ) : null}
                    </h3>
                  ) : null}

                  {detail ? <p className="event-detail">{detail}</p> : null}
                </div>

                <div className="event-tail">
                  {event.scoreAfter ? (
                    <span className="score-chip">
                      {event.scoreAfter.home}
                      <i>–</i>
                      {event.scoreAfter.away}
                    </span>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
