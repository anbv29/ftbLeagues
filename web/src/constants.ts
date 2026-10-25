import type { CompetitionInfo } from "./types";

/** Shown if /api/competitions is slow or offline; the ids are stable. */
export const FALLBACK_COMPETITIONS: CompetitionInfo[] = [
  {
    id: "eng.1",
    name: "Premier League",
    shortName: "PL",
    country: "England",
    kind: "league",
    season: "",
  },
  {
    id: "esp.1",
    name: "La Liga",
    shortName: "LaLiga",
    country: "Spain",
    kind: "league",
    season: "",
  },
  {
    id: "ita.1",
    name: "Serie A",
    shortName: "Serie A",
    country: "Italy",
    kind: "league",
    season: "",
  },
  {
    id: "ger.1",
    name: "Bundesliga",
    shortName: "Bundesliga",
    country: "Germany",
    kind: "league",
    season: "",
  },
  {
    id: "fra.1",
    name: "Ligue 1",
    shortName: "Ligue 1",
    country: "France",
    kind: "league",
    season: "",
  },
  {
    id: "uefa.champions",
    name: "UEFA Champions League",
    shortName: "UCL",
    country: "Europe",
    kind: "cup",
    season: "",
  },
];

export function competitionShortName(
  id: string,
  competitions: CompetitionInfo[],
): string {
  return (
    competitions.find((competition) => competition.id === id)?.shortName ??
    id.toUpperCase()
  );
}

export function competitionName(
  id: string,
  competitions: CompetitionInfo[],
): string {
  return (
    competitions.find((competition) => competition.id === id)?.name ?? id
  );
}
