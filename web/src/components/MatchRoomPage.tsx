import { useEffect, useRef, useState } from "react";
import { cleanNickname } from "../../../src/rooms/protocol";
import { createRoom } from "../api";
import { competitionName, competitionShortName } from "../constants";
import {
  fullKickoff,
  isLive,
  kickoffTime,
  liveClock,
} from "../lib/format";
import { useCompetitions } from "../lib/useCompetitions";
import { useNow } from "../lib/useNow";
import { useRoom } from "../lib/useRoom";
import type { Match } from "../types";
import { ConnectionBadge } from "./ConnectionBadge";
import { EventFeed } from "./EventFeed";
import { FloatingReactions } from "./FloatingReactions";
import { ArrowLeftIcon, BallIcon } from "./Icons";
import { PitchBackdrop } from "./PitchBackdrop";
import { ProbabilityBar } from "./ProbabilityBar";
import { ReactionDock } from "./ReactionDock";
import { RoomPanel } from "./RoomPanel";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { TeamCrest } from "./TeamCrest";

function statusCopy(match: Match): string {
  switch (match.status) {
    case "live":
      return "Live now";
    case "halftime":
      return "Half-time";
    case "finished":
      return "Full time";
    case "scheduled":
      return `Kick-off ${kickoffTime(match.kickoff)}`;
    case "postponed":
      return "Postponed";
    case "suspended":
      return "Suspended";
    case "abandoned":
      return "Abandoned";
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }

  try {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.top = "-1000px";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    return copied;
  } catch {
    return false;
  }
}

function MatchFacts({
  match,
  competition,
}: {
  match: Match;
  competition: string;
}) {
  return (
    <section className="facts-panel">
      <h2>Match facts</h2>
      <dl className="facts-list">
        <div>
          <dt>Competition</dt>
          <dd>{competition}</dd>
        </div>
        <div>
          <dt>Kick-off</dt>
          <dd>{fullKickoff(match.kickoff)}</dd>
        </div>
        <div>
          <dt>Venue</dt>
          <dd>{match.venue ?? "To be confirmed"}</dd>
        </div>
        <div>
          <dt>Season</dt>
          <dd>{match.season}</dd>
        </div>
        <div>
          <dt>Data</dt>
          <dd>ESPN · refreshed every 60s</dd>
        </div>
      </dl>

      <details className="model-note">
        <summary>How the win probability works</summary>
        <p>
          A small Poisson model estimates how many goals each side might still
          score, then adds those to the current score. It accounts for the
          minute, the scoreline and red cards. It is a reading of the match,
          not a betting tip.
        </p>
      </details>
    </section>
  );
}

function RoomSkeleton() {
  return (
    <main className="room-shell" aria-busy="true">
      <div className="room-nav skeleton-line is-nav" />
      <div className="room-hero">
        <div className="room-skeleton">
          <div className="skeleton-line is-comp" />
          <div className="skeleton-scoreboard">
            <div className="skeleton-team">
              <span className="skeleton-dot is-lg" />
              <span className="skeleton-line" />
            </div>
            <div className="skeleton-line is-score" />
            <div className="skeleton-team">
              <span className="skeleton-dot is-lg" />
              <span className="skeleton-line" />
            </div>
          </div>
          <div className="skeleton-line is-bar" />
        </div>
      </div>
    </main>
  );
}

export function MatchRoomPage({
  matchId,
  roomCode: initialRoomCode,
}: {
  matchId: string;
  roomCode: string | null;
}) {
  const [nickname, setNickname] = useState(
    () => window.localStorage.getItem("ftbl:nickname") ?? "",
  );
  const [sharing, setSharing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [goalFlash, setGoalFlash] = useState<{ id: string; label: string } | null>(
    null,
  );
  const toastTimer = useRef<number | undefined>(undefined);
  const goalTimer = useRef<number | undefined>(undefined);
  const lastGoalRef = useRef<string | null>(null);
  const hydratedRef = useRef(false);

  const competitions = useCompetitions();
  const now = useNow(10_000);
  const displayNickname = cleanNickname(nickname);
  const room = useRoom(matchId, initialRoomCode, displayNickname);
  const match = room.match;

  useEffect(() => {
    return () => window.clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(goalTimer.current);
  }, []);

  useEffect(() => {
    if (room.loading || !room.match) return;

    const latestGoal = [...room.events]
      .reverse()
      .find(
        (event) =>
          event.type === "goal" ||
          event.type === "own_goal" ||
          event.type === "penalty_goal",
      );

    // The first snapshot is already history; only new goals get the light show.
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      lastGoalRef.current = latestGoal?.id ?? null;
      return;
    }

    if (!latestGoal || lastGoalRef.current === latestGoal.id) return;

    lastGoalRef.current = latestGoal.id;
    const team =
      latestGoal.side === "home"
        ? room.match.home.shortName
        : latestGoal.side === "away"
          ? room.match.away.shortName
          : null;
    setGoalFlash({
      id: latestGoal.id,
      label: [latestGoal.player, team].filter(Boolean).join(" · ") || "Goal",
    });

    window.clearTimeout(goalTimer.current);
    goalTimer.current = window.setTimeout(() => setGoalFlash(null), 2300);
  }, [room.events, room.match, room.loading]);

  useEffect(() => {
    return () => {
      document.title = "ftbl — every match, one room";
    };
  }, []);

  useEffect(() => {
    if (!match) return;
    const score =
      match.status === "scheduled"
        ? ""
        : ` ${match.score.home}–${match.score.away}`;
    document.title = `${match.home.shortName}${score} ${match.away.shortName} · ftbl`;
  }, [match]);
  const showToast = (message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2800);
  };

  const handleNickname = (value: string) => {
    setNickname(value);
    window.localStorage.setItem("ftbl:nickname", value);
  };

  const handleShare = async () => {
    if (!match) return;
    setSharing(true);

    try {
      let code = room.roomCode;
      if (!code) {
        const created = await createRoom(match.id);
        code = created.room.code;
        window.location.hash = `#/match/${encodeURIComponent(match.id)}?room=${encodeURIComponent(code)}`;
      }

      const url = `${window.location.origin}${window.location.pathname}#/match/${encodeURIComponent(match.id)}?room=${encodeURIComponent(code)}`;
      const copied = await copyText(url);
      showToast(
        copied
          ? "Invite link copied"
          : "Link ready — copy it from the address bar",
      );
    } catch (caught) {
      showToast(
        caught instanceof Error ? caught.message : "Could not create an invite",
      );
    } finally {
      setSharing(false);
    }
  };

  if (!match && room.error && !room.loading) {
    return (
      <div className="page-shell">
        <SiteHeader />
        <main className="room-error">
          <span className="room-error-icon">
            <BallIcon />
          </span>
          <p className="eyebrow">Match room</p>
          <h1>That room isn&apos;t on the board.</h1>
          <p>{room.error}</p>
          <a className="btn btn-primary" href="#/">
            Back to matches
          </a>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="page-shell">
        <SiteHeader />
        <RoomSkeleton />
        <SiteFooter />
      </div>
    );
  }

  const live = isLive(match);
  const clock = liveClock(match, room.serverTime, now);
  const competition = competitionName(match.competitionId, competitions);
  const canReact = room.connection === "live";

  return (
    <div className="page-shell room-page">
      <SiteHeader liveCount={live ? 1 : 0} compact />

      <main className="room-shell">
        <nav className="room-nav">
          <a className="back-link" href="#/">
            <ArrowLeftIcon />
            All matches
          </a>

          <div className="room-nav-right">
            <span className="room-comp-pill">
              {competitionShortName(match.competitionId, competitions)}
            </span>
            <ConnectionBadge state={room.connection} />
          </div>
        </nav>

        <section className={`room-hero ${live ? "is-live" : ""}`}>
          <PitchBackdrop variant="room" />

          {goalFlash ? (
            <div className="goal-flash" role="status" key={goalFlash.id}>
              <span>GOAL</span>
              <small>{goalFlash.label}</small>
            </div>
          ) : null}

          <div className="room-topline">
            <span>
              {competition}
              <i aria-hidden="true">·</i>
              {match.venue ?? "Venue TBC"}
            </span>
            <span className="room-kickoff">{fullKickoff(match.kickoff)}</span>
          </div>

          <div className="room-scoreboard">
            <div className="room-team is-home">
              <span className="team-side-label">Home</span>
              <TeamCrest team={match.home} size="lg" />
              <h1>{match.home.name}</h1>
              <span className="team-code">{match.home.shortName}</span>
            </div>

            <div className="score-core">
              <div
                className={`scoreline ${match.status === "scheduled" ? "is-pending" : ""}`}
              >
                <span>
                  {match.status === "scheduled" ? "–" : match.score.home}
                </span>
                <i>:</i>
                <span>
                  {match.status === "scheduled" ? "–" : match.score.away}
                </span>
              </div>

              <div className={`room-clock ${live ? "is-live" : ""}`}>
                {live ? <i className="live-dot" aria-hidden="true" /> : null}
                {clock}
              </div>

              <span className="room-status">{statusCopy(match)}</span>
            </div>

            <div className="room-team is-away">
              <span className="team-side-label">Away</span>
              <TeamCrest team={match.away} size="lg" />
              <h1>{match.away.name}</h1>
              <span className="team-code">{match.away.shortName}</span>
            </div>
          </div>

          <div className="room-probability">
            <ProbabilityBar
              probability={room.probability}
              homeShort={match.home.shortName}
              awayShort={match.away.shortName}
            />
          </div>
        </section>

        <div className="room-grid">
          <EventFeed match={match} events={room.events} />

          <aside className="room-side">
            <RoomPanel
              presence={room.presence}
              roomCode={room.roomCode}
              nickname={displayNickname}
              onNickname={handleNickname}
              onShare={handleShare}
              sharing={sharing}
              onReact={room.sendReaction}
              canReact={canReact}
            />
            <MatchFacts match={match} competition={competition} />
          </aside>
        </div>
      </main>

      <ReactionDock onReact={room.sendReaction} canReact={canReact} />
      <FloatingReactions reactions={room.reactions} />

      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}

      <SiteFooter />
    </div>
  );
}
