/** ESPN HTTP client: URL building, timeouts and error wrapping. */

import { ProviderRequestError } from "../errors";

const PROVIDER_ID = "espn";
const DEFAULT_BASE_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer";
const DEFAULT_TIMEOUT_MS = 8000;

export interface EspnClientOptions {
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
}

/** Convert an ISO date (2026-10-24) to ESPN's compact form (20261024). */
export function toEspnDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`invalid date, expected YYYY-MM-DD: ${date}`);
  }
  return date.replaceAll("-", "");
}

function baseUrl(options: EspnClientOptions): string {
  return (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
}

async function requestJson(
  url: string,
  options: EspnClientOptions,
): Promise<unknown> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const response = await fetchImpl(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ProviderRequestError(
        `ESPN responded with ${response.status}`,
        PROVIDER_ID,
        url,
        response.status,
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ProviderRequestError) throw error;

    throw new ProviderRequestError(
      "ESPN request failed",
      PROVIDER_ID,
      url,
      undefined,
      { cause: error },
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * ESPN's `dates` parameter accepts a single day as YYYYMMDD. Ranges
 * (20261020-20261022) silently return zero events, so never send one.
 */
export async function fetchScoreboard(
  leagueCode: string,
  date: string,
  options: EspnClientOptions = {},
): Promise<unknown> {
  const url = `${baseUrl(options)}/${leagueCode}/scoreboard?dates=${toEspnDate(date)}`;
  return requestJson(url, options);
}

/** Full match detail: key events, commentary, box score, lineups. */
export async function fetchSummary(
  leagueCode: string,
  eventId: string,
  options: EspnClientOptions = {},
): Promise<unknown> {
  const url = `${baseUrl(options)}/${leagueCode}/summary?event=${encodeURIComponent(eventId)}`;
  return requestJson(url, options);
}
