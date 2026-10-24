/** ESPN adapter: implements the Provider port using the public scoreboard API. */

import { getProviderCode } from "../../config/competitions";
import type { Provider } from "../../domain/types";
import { fetchScoreboard } from "./client";
import { parseScoreboard } from "./parse";

export const espnProvider: Provider = {
  id: "espn",
  capabilities: {
    liveScores: true,
    events: true,
    commentary: true,
    lineups: true,
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

  async getMatchDetail() {
    throw new Error("ESPN match detail is implemented in part 5");
  },
};
