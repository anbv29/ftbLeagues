import { describe, expect, it } from "vitest";
import {
  COMPETITIONS,
  COMPETITION_IDS,
  currentSeason,
  getCompetitionDefinition,
  isKnownCompetition,
  listCompetitions,
  resolveCompetition,
} from "../src/config/competitions";

describe("competition registry", () => {
  it("contains exactly the six supported competitions", () => {
    expect(COMPETITIONS).toHaveLength(6);
    expect(new Set(COMPETITION_IDS).size).toBe(6);
  });

  it("covers five leagues and the Champions League", () => {
    const leagues = COMPETITIONS.filter((c) => c.kind === "league");
    const cups = COMPETITIONS.filter((c) => c.kind === "cup");

    expect(leagues).toHaveLength(5);
    expect(cups.map((c) => c.id)).toEqual(["uefa.champions"]);
  });

  it("maps every competition to an ESPN code", () => {
    for (const competition of COMPETITIONS) {
      expect(competition.providerCodes.espn).toBe(competition.id);
    }
  });

  it("recognises known ids and rejects unknown ones", () => {
    expect(isKnownCompetition("eng.1")).toBe(true);
    expect(isKnownCompetition("uefa.champions")).toBe(true);
    expect(isKnownCompetition("eng.2")).toBe(false);
    expect(isKnownCompetition("")).toBe(false);
  });

  it("looks up definitions by id", () => {
    const premierLeague = getCompetitionDefinition("eng.1");
    expect(premierLeague?.name).toBe("Premier League");
    expect(premierLeague?.country).toBe("England");
    expect(getCompetitionDefinition("nope")).toBeNull();
  });
});

describe("season resolution", () => {
  it("treats July as the start of a new season", () => {
    expect(currentSeason(new Date("2026-07-01T00:00:00Z"))).toBe("2026-27");
  });

  it("keeps June in the previous season", () => {
    expect(currentSeason(new Date("2026-06-30T23:59:59Z"))).toBe("2025-26");
  });

  it("resolves mid-season dates correctly", () => {
    expect(currentSeason(new Date("2026-01-15T12:00:00Z"))).toBe("2025-26");
    expect(currentSeason(new Date("2026-12-31T12:00:00Z"))).toBe("2026-27");
    expect(currentSeason(new Date("2027-02-01T00:00:00Z"))).toBe("2026-27");
  });

  it("pads the end year to two digits", () => {
    expect(currentSeason(new Date("2009-09-01T00:00:00Z"))).toBe("2009-10");
  });
});

describe("resolving competitions", () => {
  it("fills in the season and drops provider internals", () => {
    const resolved = resolveCompetition(
      "esp.1",
      new Date("2026-10-24T12:00:00Z"),
    );

    expect(resolved).not.toBeNull();
    expect(resolved?.season).toBe("2026-27");
    expect(resolved?.name).toBe("La Liga");
    expect(resolved && "providerCodes" in resolved).toBe(false);
  });

  it("returns null for unknown competitions", () => {
    expect(resolveCompetition("eng.2")).toBeNull();
  });

  it("lists all six with seasons attached", () => {
    const all = listCompetitions(new Date("2026-10-24T12:00:00Z"));
    expect(all).toHaveLength(6);
    expect(all.every((c) => c.season === "2026-27")).toBe(true);
  });
});
