import { afterEach, describe, expect, it, vi } from "vitest";
import summaryFixture from "./fixtures/espn-summary.json";
import { resolveCompetition } from "../src/config/competitions";
import { espnProvider } from "../src/providers/espn";
import { fetchSummary } from "../src/providers/espn/client";
import { scoresAgree } from "../src/providers/espn/normalize";
import { parseSummary } from "../src/providers/espn/summary";

const NOW = new Date("2026-10-24T18:00:00Z");

const competition = resolveCompetition("eng.1", NOW);
if (!competition) throw new Error("fixture competition missing");

const ref = {
  competitionId: "eng.1",
  externalId: "401879256",
} as const;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseSummary", () => {
  const result = parseSummary(summaryFixture, ref, competition, NOW);
  const detail = result.detail;
  if (!detail) throw new Error("fixture should parse");

  it("parses the match header", () => {
    expect(detail.match.id).toBe("espn:401879256");
    expect(detail.match.status).toBe("finished");
    expect(detail.match.score).toEqual({ home: 2, away: 1 });
    expect(detail.match.home.shortName).toBe("AVL");
    expect(detail.match.away.name).toBe("Manchester City");
    expect(detail.match.venue).toBe("Villa Park");
    expect(detail.match.kickoff).toBe("2026-10-24T11:30Z");
    expect(detail.match.season).toBe("2026-27");
    expect(detail.match.updatedAt).toBe(NOW.toISOString());
  });

  it("infers the clock from the latest event", () => {
    expect(detail.match.clock).toEqual({
      minute: 90,
      addedTime: 5,
      display: "90'+5'",
      running: false,
    });
  });

  it("orders commentary by sequence, not payload order", () => {
    expect(detail.commentary?.map((line) => line.id.split(":").pop())).toEqual([
      "0",
      "1",
      "60",
      "137",
    ]);
  });

  it("maps commentary minutes and kinds", () => {
    const goal = detail.commentary?.find((line) => line.kind === "Goal");

    expect(goal?.minute).toBe(60);
    expect(goal?.text).toContain("Nicolas Jackson");
    expect(detail.commentary?.at(-1)?.minute).toBe(90);
  });

  it("extracts raw key events for the normalizer", () => {
    expect(result.keyEvents).toHaveLength(8);
    expect(result.keyEvents[1]?.type?.type).toBe("goal");
    expect(result.keyEvents[4]?.type?.type).toBe("substitution");
  });

  it("normalizes key events into the domain feed", () => {
    expect(detail.events).toHaveLength(8);
    expect(scoresAgree(detail.events, detail.match)).toBe(true);
    expect(detail.events.map((event) => event.type)).toEqual([
      "kickoff",
      "goal",
      "yellow_card",
      "halftime",
      "substitution",
      "goal",
      "goal",
      "fulltime",
    ]);

    expect(detail.events[1]).toMatchObject({
      id: "espn:401879256:54146134",
      minute: 6,
      addedTime: 0,
      side: "home",
      player: "Nicolas Jackson",
      assist: "John McGinn",
      scoreAfter: { home: 1, away: 0 },
    });

    expect(detail.events[2]).toMatchObject({
      type: "yellow_card",
      minute: 32,
      side: "away",
      player: "Marc Guéhi",
    });

    expect(detail.events[3]).toMatchObject({
      type: "halftime",
      minute: 45,
      addedTime: 2,
      side: null,
    });

    expect(detail.events[5]).toMatchObject({
      type: "goal",
      minute: 52,
      side: "away",
      player: "Erling Haaland",
      assist: "Iliman Ndiaye",
      scoreAfter: { home: 1, away: 1 },
    });

    expect(detail.events[6]).toMatchObject({
      type: "goal",
      minute: 60,
      side: "home",
      scoreAfter: { home: 2, away: 1 },
    });

    expect(detail.events[7]).toMatchObject({
      type: "fulltime",
      minute: 90,
      addedTime: 5,
      side: null,
    });
  });

  it("returns null when the header is unusable", () => {
    expect(parseSummary({}, ref, competition, NOW).detail).toBeNull();
    expect(
      parseSummary({ header: { competitions: [] } }, ref, competition, NOW)
        .detail,
    ).toBeNull();
  });

  it("handles an abandoned match with no events", () => {
    const abandoned = {
      ...summaryFixture,
      header: {
        ...summaryFixture.header,
        competitions: [
          {
            ...summaryFixture.header.competitions[0],
            status: { type: { name: "STATUS_ABANDONED", state: "post" } },
          },
        ],
      },
      keyEvents: [],
      commentary: [],
    };

    const parsed = parseSummary(abandoned, ref, competition, NOW);

    expect(parsed.detail?.match.status).toBe("abandoned");
    expect(parsed.detail?.events).toEqual([]);
  });

  it("carries the last known minute for untimed commentary", () => {
    const payload = {
      ...summaryFixture,
      commentary: [
        {
          sequence: 60,
          time: { value: 3591, displayValue: "60'" },
          text: "Goal! Aston Villa 2, Manchester City 1.",
        },
        {
          sequence: 61,
          text: "Match ends, Aston Villa 2, Manchester City 1.",
        },
      ],
    };

    const parsed = parseSummary(payload, ref, competition, NOW);

    expect(parsed.detail?.commentary?.at(-1)).toMatchObject({
      minute: 60,
      text: "Match ends, Aston Villa 2, Manchester City 1.",
    });
  });

  it("infers a live clock from commentary", () => {
    const live = {
      header: {
        competitions: [
          {
            date: "2026-10-25T14:00Z",
            status: {
              type: { name: "STATUS_SECOND_HALF", state: "in" },
            },
            competitors: [
              {
                homeAway: "home",
                score: "1",
                team: {
                  id: "364",
                  abbreviation: "LIV",
                  displayName: "Liverpool",
                },
              },
              {
                homeAway: "away",
                score: "0",
                team: {
                  id: "331",
                  abbreviation: "BHA",
                  displayName: "Brighton & Hove Albion",
                },
              },
            ],
          },
        ],
      },
      commentary: [
        {
          sequence: 42,
          time: { value: 4920, displayValue: "82'" },
          text: "Corner, Liverpool. Conceded by Bart Verbruggen.",
        },
      ],
    };

    const parsed = parseSummary(live, ref, competition, NOW);

    expect(parsed.detail?.match.status).toBe("live");
    expect(parsed.detail?.match.clock).toEqual({
      minute: 82,
      addedTime: 0,
      display: "82'",
      running: true,
    });
  });
});

describe("ESPN summary client", () => {
  it("builds the summary URL with the event id", async () => {
    const fetchImpl = vi.fn(
      async (_url: string) =>
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );

    await fetchSummary("eng.1", "401879256", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/summary?event=401879256",
    );
  });
});

describe("espnProvider.getMatchDetail", () => {
  it("fetches and parses a real match summary", async () => {
    const fetchImpl = vi.fn(
      async (_url: string) =>
        new Response(JSON.stringify(summaryFixture), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchImpl);

    const detail = await espnProvider.getMatchDetail(ref);

    expect(detail?.match.id).toBe("espn:401879256");
    expect(detail?.commentary).toHaveLength(4);
    expect(espnProvider.capabilities.commentary).toBe(true);
    expect(espnProvider.capabilities.lineups).toBe(false);
    expect(fetchImpl.mock.calls[0]?.[0]).toContain(
      "/summary?event=401879256",
    );
  });
});
