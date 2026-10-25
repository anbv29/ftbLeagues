/** ESPN HTTP client: URL building, timeouts, retries and error wrapping. */

import { ProviderRequestError } from "../errors";

const PROVIDER_ID = "espn";
const DEFAULT_BASE_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer";
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 250;

export interface EspnClientOptions {
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
  /** Additional attempts after the first one. Zero disables retries. */
  retries?: number;
  /** Base for exponential backoff between attempts. */
  retryDelayMs?: number;
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

function shouldRetry(error: unknown): boolean {
  if (!(error instanceof ProviderRequestError)) return false;
  if (error.status === undefined) return true;
  return error.status === 429 || error.status >= 500;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Fetch with a small exponential backoff. 4xx responses other than 429 are
 * permanent and returned immediately; network errors and 5xx are retried.
 */
async function requestJsonWithRetry(
  url: string,
  options: EspnClientOptions,
): Promise<unknown> {
  const retries = Math.max(0, options.retries ?? DEFAULT_RETRIES);
  const baseDelay = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await requestJson(url, options);
    } catch (error) {
      lastError = error;
      if (attempt === retries || !shouldRetry(error)) throw error;
      await sleep(baseDelay * 2 ** attempt);
    }
  }

  throw lastError;
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
  return requestJsonWithRetry(url, options);
}

/** Full match detail: key events, commentary, box score, lineups. */
export async function fetchSummary(
  leagueCode: string,
  eventId: string,
  options: EspnClientOptions = {},
): Promise<unknown> {
  const url = `${baseUrl(options)}/${leagueCode}/summary?event=${encodeURIComponent(eventId)}`;
  return requestJsonWithRetry(url, options);
}
