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

export async function fetchScoreboard(
  leagueCode: string,
  date: string,
  options: EspnClientOptions = {},
): Promise<unknown> {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const url = `${baseUrl}/${leagueCode}/scoreboard?dates=${toEspnDate(date)}`;

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
