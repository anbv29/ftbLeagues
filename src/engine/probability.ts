/**
 * Win probability, model v1.
 *
 * This is a deliberately small Poisson model: it asks how many goals each side
 * is still likely to score in the time left, then sums the score combinations.
 * It is not a betting model. It exists to make a match room legible at a
 * glance, and it only uses facts we already store (score, minute, red cards).
 */

import type {
  Match,
  MatchEvent,
  Score,
  TeamSide,
  WinProbability,
} from "../domain/types";

/** Home advantage, roughly the historical European baseline. */
const PRE_MATCH: WinProbability = { home: 0.45, draw: 0.27, away: 0.28 };

const BASE_HOME_GOALS = 1.45;
const BASE_AWAY_GOALS = 1.15;
const FULL_MATCH_MINUTES = 95;
const MAX_GOALS = 8;

function poisson(lambda: number, goals: number): number {
  let probability = Math.exp(-lambda);
  for (let index = 1; index <= goals; index += 1) {
    probability *= lambda / index;
  }
  return probability;
}

function finishedProbability(score: Score): WinProbability {
  if (score.home > score.away) return { home: 1, draw: 0, away: 0 };
  if (score.home < score.away) return { home: 0, draw: 0, away: 1 };
  return { home: 0, draw: 1, away: 0 };
}

function redCards(events: MatchEvent[], side: TeamSide): number {
  return events.filter(
    (event) =>
      event.side === side &&
      (event.type === "red_card" || event.type === "second_yellow"),
  ).length;
}

/** Round to three decimals and force the three outcomes to sum to one. */
export function normalizeProbability(
  probability: WinProbability,
): WinProbability {
  const total = probability.home + probability.draw + probability.away;
  if (!Number.isFinite(total) || total <= 0) return PRE_MATCH;

  const home = Math.round((probability.home / total) * 1000) / 1000;
  const draw = Math.round((probability.draw / total) * 1000) / 1000;
  const away = Math.round((1 - home - draw) * 1000) / 1000;

  if (away < 0) {
    return { home, draw: Math.round((1 - home) * 1000) / 1000, away: 0 };
  }
  return { home, draw, away };
}

export function computeWinProbability(
  match: Match,
  events: MatchEvent[],
): WinProbability {
  if (match.status === "finished") return finishedProbability(match.score);
  if (
    match.status === "scheduled" ||
    match.status === "postponed" ||
    match.status === "suspended" ||
    match.status === "abandoned"
  ) {
    return PRE_MATCH;
  }

  const elapsed =
    match.status === "halftime"
      ? 45
      : Math.max(0, match.clock.minute);
  const remainingFraction =
    Math.max(0.01, FULL_MATCH_MINUTES - elapsed) / FULL_MATCH_MINUTES;

  const homeReds = redCards(events, "home");
  const awayReds = redCards(events, "away");

  // A red card hurts the side that lost the player and helps the other one.
  const homeFactor = Math.max(
    0.3,
    1 - 0.18 * homeReds + 0.12 * awayReds,
  );
  const awayFactor = Math.max(
    0.3,
    1 - 0.18 * awayReds + 0.12 * homeReds,
  );

  let lambdaHome = BASE_HOME_GOALS * remainingFraction * homeFactor;
  let lambdaAway = BASE_AWAY_GOALS * remainingFraction * awayFactor;

  // The side chasing the game pushes; the leader manages it.
  const difference = match.score.home - match.score.away;
  if (difference > 0) {
    lambdaAway *= 1.1;
    lambdaHome *= 0.92;
  } else if (difference < 0) {
    lambdaHome *= 1.1;
    lambdaAway *= 0.92;
  }

  const homeGoals = Array.from({ length: MAX_GOALS + 1 }, (_, goals) =>
    poisson(lambdaHome, goals),
  );
  const awayGoals = Array.from({ length: MAX_GOALS + 1 }, (_, goals) =>
    poisson(lambdaAway, goals),
  );

  let home = 0;
  let draw = 0;
  let away = 0;

  for (let addHome = 0; addHome <= MAX_GOALS; addHome += 1) {
    for (let addAway = 0; addAway <= MAX_GOALS; addAway += 1) {
      const probability = homeGoals[addHome]! * awayGoals[addAway]!;
      const homeFinal = match.score.home + addHome;
      const awayFinal = match.score.away + addAway;

      if (homeFinal > awayFinal) home += probability;
      else if (homeFinal === awayFinal) draw += probability;
      else away += probability;
    }
  }

  const total = home + draw + away;
  if (total <= 0) return PRE_MATCH;
  return normalizeProbability({
    home: home / total,
    draw: draw / total,
    away: away / total,
  });
}

/** Compact integer percentages for the UI, always summing to 100. */
export function asPercentages(probability: WinProbability): {
  home: number;
  draw: number;
  away: number;
} {
  const home = Math.round(probability.home * 100);
  const draw = Math.round(probability.draw * 100);
  return { home, draw, away: Math.max(0, 100 - home - draw) };
}
