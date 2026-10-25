import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/espn-scoreboard.json";
import {
  getProviderCode,
  resolveCompetition,
} from "../src/config/competitions";
import { ProviderRequestError } from "../src/providers/errors";
import { espnProvider } from "../src/providers/espn";
import {
  fetchScoreboard,
  toEspnDate,
} from "../src/providers/espn/client";
import {
  parseClock,
  parseMatchStatus,
  parseScoreboard,
} from "../src/providers/espn/parse";

const NOW = new Date("2026-10-24T18:00:00Z");

const competition = resolveCompetition("eng.1", NOW);
if (!competition) throw new Error("fixture competition missing");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseScoreboard", () => {
  const result = parseScoreboard(fixture, competition, NOW);

  it("parses every event and skips none", () => {
    expect(result.matches).toHaveLength(3);
    expect(result.skipped).toBe(0);
  });

  it("namespaces ids and fills competition context", () => {
    const match = result.matches[0];
    expect(match?.id).toBe("espn:401878767");
    expect(match?.competitionId).toBe("eng.1");
    expect(match?.season).toBe("2026-27");
    expect(match?.home.id).toBe("espn:363");
    expect(match?.away.id).toBe("espn:367");
  });

  it("parses a live match", () => {
    const match = result.matches[0];

    expect(match?.status).toBe("live");
    expect(match?.clock).toEqual({
      minute: 79,
      addedTime: 0,
      display: "79'",
      running: true,
    });
    expect(match?.score).toEqual({ home: 0, away: 1 });
    expect(match?.home.name).toBe("Chelsea");
    expect(match?.home.shortName).toBe("CHE");
    expect(match?.away.name).toBe("Tottenham Hotspur");
    expect(match?.venue).toBe("Stamford Bridge");
    expect(match?.kickoff).toBe("2026-10-24T16:30Z");
  });

  it("parses a finished match with stoppage time", () => {
    const match = result.matches[1];

    expect(match?.status).toBe("finished");
    expect(match?.clock).toEqual({
      minute: 90,
      addedTime: 5,
      display: "90'+5'",
      running: false,
    });
    expect(match?.score).toEqual({ home: 2, away: 1 });
    expect(match?.home.name).toBe("Aston Villa");
    expect(match?.away.shortName).toBe("MNC");
    expect(match?.venue).toBe("Villa Park");
  });

  it("parses a scheduled match", () => {
    const match = result.matches[2];

    expect(match?.status).toBe("scheduled");
    expect(match?.clock).toEqual({
      minute: 0,
      addedTime: 0,
      display: "0'",
      running: false,
    });
    expect(match?.score).toEqual({ home: 0, away: 0 });
    expect(match?.kickoff).toBe("2026-10-25T14:00Z");
  });

  it("counts malformed events instead of throwing", () => {
    const broken = {
      events: [
        { id: "1", date: "2026-10-24T14:00Z", competitions: [] },
        { date: "2026-10-24T14:00Z" },
        null,
      ],
    };

    expect(parseScoreboard(broken, competition, NOW)).toEqual({
      matches: [],
      skipped: 3,
    });
  });

  it("survives a payload with no events", () => {
    expect(parseScoreboard({}, competition, NOW)).toEqual({
      matches: [],
      skipped: 0,
    });
  });
});

describe("parseMatchStatus", () => {
  const cases: Array<[string, string, string]> = [
    ["STATUS_SCHEDULED", "pre", "scheduled"],
    ["STATUS_SECOND_HALF", "in", "live"],
    ["STATUS_FIRST_HALF", "in", "live"],
    ["STATUS_HALFTIME", "in", "halftime"],
    ["STATUS_FULL_TIME", "post", "finished"],
    ["STATUS_POSTPONED", "pre", "postponed"],
    ["STATUS_ABANDONED", "post", "abandoned"],
    ["STATUS_CANCELED", "post", "abandoned"],
    ["STATUS_SUSPENDED", "in", "suspended"],
    ["STATUS_EXTRA_TIME", "in", "live"],
    ["STATUS_PENALTY_SHOOTOUT", "in", "live"],
  ];

  it.each(cases)("maps %s in state %s to %s", (name, state, expected) => {
    expect(parseMatchStatus({ type: { name, state } })).toBe(expected);
  });

  it("defaults to scheduled for an empty status", () => {
    expect(parseMatchStatus(undefined)).toBe("scheduled");
  });
});

describe("parseClock", () => {
  it("prefers the display string over raw seconds", () => {
    expect(
      parseClock({ clock: 5400, displayClock: "90'+5'" }, "finished"),
    ).toEqual({ minute: 90, addedTime: 5, display: "90'+5'", running: false });
  });

  it("falls back to elapsed seconds when display is missing", () => {
    expect(parseClock({ clock: 2700 }, "halftime")).toEqual({
      minute: 45,
      addedTime: 0,
      display: "45'",
      running: false,
    });
  });

  it("zeroes a scheduled match", () => {
    expect(parseClock({ clock: 0, displayClock: "0'" }, "scheduled")).toEqual({
      minute: 0,
      addedTime: 0,
      display: "0'",
      running: false,
    });
  });
});

describe("ESPN client", () => {
  it("converts ISO dates to ESPN's compact format", () => {
    expect(toEspnDate("2026-10-24")).toBe("20261024");
  });

  it("rejects malformed dates before making a request", () => {
    expect(() => toEspnDate("24/10/2026")).toThrow(/invalid date/);
  });

  it("builds the scoreboard URL with a date filter", async () => {
    const fetchImpl = vi.fn(
      async (_url: string) =>
        new Response(JSON.stringify({ events: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );

    await fetchScoreboard("eng.1", "2026-10-24", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates=20261024",
    );
  });

  it("wraps non-2xx responses with the status code", async () => {
    const fetchImpl = vi.fn(async () => new Response("rate limited", { status: 429 }));

    await expect(
      fetchScoreboard("eng.1", "2026-10-24", {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        timeoutMs: 1000,
        retries: 0,
      }),
    ).rejects.toMatchObject({
      name: "ProviderRequestError",
      providerId: "espn",
      status: 429,
    });
  });

  it("wraps network failures and keeps the cause", async () => {
    const failure = new Error("socket closed");
    const fetchImpl = vi.fn(async () => {
      throw failure;
    });

    const error = await fetchScoreboard("eng.1", "2026-10-24", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutMs: 1000,
      retries: 0,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ProviderRequestError);
    expect((error as ProviderRequestError).status).toBeUndefined();
    expect((error as ProviderRequestError).cause).toBe(failure);
  });

  it("retries a transient 5xx and then succeeds", async () => {
    let attempts = 0;
    const fetchImpl = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) return new Response("overloaded", { status: 503 });
      return new Response(JSON.stringify({ events: [] }), { status: 200 });
    });

    const payload = await fetchScoreboard("eng.1", "2026-10-24", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retryDelayMs: 0,
    });

    expect(payload).toEqual({ events: [] });
    expect(attempts).toBe(2);
  });

  it("does not retry a permanent 4xx", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("missing", { status: 404 }),
    );

    await expect(
      fetchScoreboard("eng.1", "2026-10-24", {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        retryDelayMs: 0,
      }),
    ).rejects.toMatchObject({ status: 404 });

    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});

describe("espnProvider", () => {
  it("maps a competition to its ESPN league code", () => {
    expect(getProviderCode("uefa.champions", "espn")).toBe("uefa.champions");
    expect(getProviderCode("eng.1", "unknown")).toBeNull();
    expect(getProviderCode("eng.2", "espn")).toBeNull();
  });

  it("returns parsed matches through the Provider interface", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify(fixture), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchImpl);

    const matches = await espnProvider.listMatches({
      competition,
      date: "2026-10-24",
    });

    expect(matches).toHaveLength(3);
    expect(matches[0]?.status).toBe("live");
    expect(espnProvider.capabilities.events).toBe(true);
  });
});
