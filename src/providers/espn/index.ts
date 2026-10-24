/** ESPN adapter: implements the Provider port using the public scoreboard API. */

import {
  getProviderCode,
  resolveCompetition,
} from "../../config/competitions";
import type { Provider } from "../../domain/types";
import { fetchScoreboard, fetchSummary } from "./client";
import { parseScoreboard } from "./parse";
import { parseSummary } from "./summary";

export const espnProvider: Provider = {
  id: "espn",
  capabilities: {
    liveScores: true,
    events: true,
    commentary: true,
    lineups: false,
    winProbability: false,
  },

  async listMatches({ competition, date }) {
    const leagueCode = getProviderCode(competition.id, "espn");
    if (!leagueCode) {
      throw new Error(`ESPN has no code for competition ${competition.id}`);
    }

    const payload = await fetchScoreboard(leagueCode, date);
    return parseScoreboard(payload, competition).matches;
  },

  async getMatchDetail(ref) {
    const competition = resolveCompetition(ref.competitionId);
    if (!competition) {
      throw new Error(`unknown competition: ${ref.competitionId}`);
    }

    const leagueCode = getProviderCode(ref.competitionId, "espn");
    if (!leagueCode) {
      throw new Error(
        `ESPN has no code for competition ${ref.competitionId}`,
      );
    }

    const payload = await fetchSummary(leagueCode, ref.externalId);
    return parseSummary(payload, ref, competition).detail;
  },
};
