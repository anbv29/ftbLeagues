import { useCallback, useEffect, useState } from "react";
import { fetchMatches } from "../api";
import type { MatchListResponse } from "../types";

const REFRESH_MS = 30_000;

export interface MatchListState {
  data: MatchListResponse | null;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  refresh: () => void;
}

export function useMatchList(
  date: string,
  competition: string | null,
): MatchListState {
  const [data, setData] = useState<MatchListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setData(null);
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        const response = await fetchMatches(date, competition, controller.signal);
        if (cancelled) return;
        setData(response);
        setError(null);
        setLastUpdated(Date.now());
      } catch (caught) {
        if (cancelled) return;
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(
          caught instanceof Error ? caught.message : "Could not load matches",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, REFRESH_MS);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [date, competition, reloadKey]);

  return { data, loading, error, lastUpdated, refresh };
}
