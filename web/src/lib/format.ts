import type { Match, MatchSummary, WinProbability } from "../types";

const TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
});

const FULL_FORMAT = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const DAY_FORMAT = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function shiftIso(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function dateLabel(date: string): string {
  const today = isoToday();
  if (date === today) return "Today";
  if (date === shiftIso(today, 1)) return "Tomorrow";
  if (date === shiftIso(today, -1)) return "Yesterday";
  return DAY_FORMAT.format(new Date(`${date}T12:00:00.000Z`));
}

export function longDateLabel(date: string): string {
  return DAY_FORMAT.format(new Date(`${date}T12:00:00.000Z`));
}

export function kickoffTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "TBC";
  return TIME_FORMAT.format(parsed);
}

export function fullKickoff(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "Kick-off TBC";
  return FULL_FORMAT.format(parsed);
}

export function isLive(match: Match): boolean {
  return match.status === "live" || match.status === "halftime";
}

/** A scoreline-friendly label for pills and cards. */
export function statusLabel(match: Match): string {
  switch (match.status) {
    case "live":
      return rotClock(match);
    case "halftime":
      return "HT";
    case "finished":
      return "FT";
    case "scheduled":
      return kickoffTime(match.kickoff);
    case "postponed":
      return "Postponed";
    case "suspended":
      return "Suspended";
    case "abandoned":
      return "Abandoned";
  }
}

function rotClock(match: Match): string {
  if (match.clock.addedTime > 0) {
    return `${match.clock.minute}+${match.clock.addedTime}'`;
  }
  return `${match.clock.minute}'`;
}

/**
 * Tick the clock between server updates. The provider minute is the anchor;
 * wall time only fills the gap until the next event arrives.
 */
export function liveClock(
  match: Match,
  serverTime: string | null,
  nowMs: number,
): string {
  if (match.status === "halftime") return "HT";
  if (match.status !== "live") return statusLabel(match);

  if (match.clock.addedTime > 0) {
    return `${match.clock.minute}+${match.clock.addedTime}'`;
  }

  const synced = serverTime ? Date.parse(serverTime) : Number.NaN;
  const elapsedMinutes = Number.isFinite(synced)
    ? Math.max(0, Math.floor((nowMs - synced) / 60_000))
    : 0;
  const cap = match.clock.minute > 90 ? 120 : 90;
  const minute = Math.min(cap, match.clock.minute + elapsedMinutes);
  return `${minute}'`;
}

export function matchPhase(match: Match): "live" | "upcoming" | "finished" {
  if (isLive(match)) return "live";
  if (match.status === "scheduled") return "upcoming";
  return "finished";
}

export interface GroupedMatches {
  live: MatchSummary[];
  upcoming: MatchSummary[];
  finished: MatchSummary[];
}

export function groupMatches(matches: MatchSummary[]): GroupedMatches {
  const groups: GroupedMatches = { live: [], upcoming: [], finished: [] };
  for (const match of matches) {
    groups[matchPhase(match)].push(match);
  }

  groups.live.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  groups.upcoming.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  groups.finished.sort((a, b) => b.kickoff.localeCompare(a.kickoff));
  return groups;
}

export function percentages(probability: WinProbability): {
  home: number;
  draw: number;
  away: number;
} {
  const home = Math.round(probability.home * 100);
  const draw = Math.round(probability.draw * 100);
  return { home, draw, away: Math.max(0, 100 - home - draw) };
}

export function relativeTime(timestamp: number, nowMs: number): string {
  const seconds = Math.max(0, Math.round((nowMs - timestamp) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

/** Compact countdown for scheduled match cards. */
export function timeUntil(iso: string, nowMs: number): string {
  const target = Date.parse(iso);
  if (!Number.isFinite(target)) return "TBC";

  const minutes = Math.ceil((target - nowMs) / 60_000);
  if (minutes <= 0) return "Awaiting kick-off";
  if (minutes < 60) return `in ${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `in ${hours}h`;
  return `in ${Math.floor(hours / 24)}d`;
}

export function initials(nickname: string): string {
  const parts = nickname.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function teamInitials(name: string, shortName?: string): string {
  if (shortName && shortName.length <= 4) return shortName.toUpperCase();
  const words = name.split(/\s+/).filter(Boolean);
  return words
    .slice(0, 3)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}
