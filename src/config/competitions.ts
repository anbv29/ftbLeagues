/**
 * Competition registry.
 *
 * The six competitions the product supports, plus season resolution. Seasons
 * are computed from the date rather than stored, so nothing needs updating
 * when a new campaign starts.
 */

import type {
  Competition,
  CompetitionId,
} from "../domain/types";
import { isCompetitionId } from "../domain/guards";

/** Static facts about a competition. Season is resolved at runtime. */
export type CompetitionDefinition = Omit<Competition, "season"> & {
  /** Codes used by each upstream provider, keyed by provider id. */
  providerCodes: Record<string, string>;
};

export const COMPETITIONS = [
  {
    id: "eng.1",
    name: "Premier League",
    shortName: "PL",
    country: "England",
    kind: "league",
    providerCodes: { espn: "eng.1" },
  },
  {
    id: "esp.1",
    name: "La Liga",
    shortName: "LaLiga",
    country: "Spain",
    kind: "league",
    providerCodes: { espn: "esp.1" },
  },
  {
    id: "ita.1",
    name: "Serie A",
    shortName: "Serie A",
    country: "Italy",
    kind: "league",
    providerCodes: { espn: "ita.1" },
  },
  {
    id: "ger.1",
    name: "Bundesliga",
    shortName: "Bundesliga",
    country: "Germany",
    kind: "league",
    providerCodes: { espn: "ger.1" },
  },
  {
    id: "fra.1",
    name: "Ligue 1",
    shortName: "Ligue 1",
    country: "France",
    kind: "league",
    providerCodes: { espn: "fra.1" },
  },
  {
    id: "uefa.champions",
    name: "UEFA Champions League",
    shortName: "UCL",
    country: "Europe",
    kind: "cup",
    providerCodes: { espn: "uefa.champions" },
  },
] as const satisfies readonly CompetitionDefinition[];

export const COMPETITION_IDS: readonly CompetitionId[] = COMPETITIONS.map(
  (competition) => competition.id,
);

/**
 * European seasons run July to June. Dates in July or later belong to the
 * campaign starting that year; earlier dates belong to the one that started
 * the previous year.
 */
export function currentSeason(at: Date = new Date()): string {
  const year = at.getUTCFullYear();
  const month = at.getUTCMonth(); // 0 = January
  const startYear = month >= 6 ? year : year - 1;
  const endYear = startYear + 1;
  return `${startYear}-${String(endYear).slice(-2)}`;
}

export function getCompetitionDefinition(
  id: string,
): CompetitionDefinition | null {
  const found = COMPETITIONS.find((competition) => competition.id === id);
  return found ?? null;
}

/** The code a given provider uses for a competition, if it covers it. */
export function getProviderCode(
  competitionId: string,
  providerId: string,
): string | null {
  return (
    getCompetitionDefinition(competitionId)?.providerCodes[providerId] ?? null
  );
}

/** Resolve a competition for a date, filling in the current season. */
export function resolveCompetition(
  id: string,
  at: Date = new Date(),
): Competition | null {
  const definition = getCompetitionDefinition(id);
  if (!definition) return null;

  const { providerCodes: _providerCodes, ...competition } = definition;
  return { ...competition, season: currentSeason(at) };
}

export function listCompetitions(at: Date = new Date()): Competition[] {
  return COMPETITIONS.map((definition) => {
    const resolved = resolveCompetition(definition.id, at);
    if (!resolved) throw new Error(`unresolvable competition: ${definition.id}`);
    return resolved;
  });
}

/** True when the string is both a known id and a guarded CompetitionId. */
export function isKnownCompetition(id: string): id is CompetitionId {
  return isCompetitionId(id) && getCompetitionDefinition(id) !== null;
}
