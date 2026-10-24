/**
 * Small parsing helpers shared by the ESPN adapters.
 *
 * Provider JSON is unknown input. These functions narrow it one field at a
 * time, so a partially broken payload degrades instead of throwing.
 */

import { makeTeamId } from "../../domain/ids";
import type { MatchStatus, Team } from "../../domain/types";

export const ESPN_PROVIDER_ID = "espn";

export type JsonRecord = Record<string, unknown>;

export function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function asNumber(value: unknown): number | null {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(numeric) ? numeric : null;
}

export function idString(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

export function parseScore(value: unknown): number {
  const score = asNumber(value);
  return score === null ? 0 : Math.max(0, Math.trunc(score));
}

export function parseTeam(raw: unknown): Team | null {
  const competitor = asRecord(raw);
  const team = asRecord(competitor?.team);
  if (!team) return null;

  const externalId = idString(team.id);
  const name =
    asString(team.displayName) ??
    asString(team.name) ??
    asString(team.shortDisplayName);

  if (!externalId || !name) return null;

  return {
    id: makeTeamId(ESPN_PROVIDER_ID, externalId),
    externalId,
    name,
    shortName: asString(team.abbreviation) ?? name.slice(0, 3).toUpperCase(),
    crest: asString(team.logo) ?? undefined,
  };
}

/**
 * Explicit status names win over the generic state, so a postponed match can
 * never report as merely "scheduled".
 */
export function parseMatchStatus(raw: unknown): MatchStatus {
  const status = asRecord(raw);
  const type = asRecord(status?.type);
  const name = (asString(type?.name) ?? "").toUpperCase();
  const state = asString(type?.state);

  if (name.includes("POSTPONED")) return "postponed";
  if (
    name.includes("ABANDONED") ||
    name.includes("CANCELED") ||
    name.includes("CANCELLED")
  ) {
    return "abandoned";
  }
  if (name.includes("SUSPENDED")) return "suspended";
  if (name.includes("HALFTIME") || name.includes("HALF_TIME")) {
    return "halftime";
  }

  if (state === "in") return "live";
  if (state === "post") return "finished";
  return "scheduled";
}
