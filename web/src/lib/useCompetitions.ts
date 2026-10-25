import { useEffect, useState } from "react";
import { fetchCompetitions } from "../api";
import { FALLBACK_COMPETITIONS } from "../constants";
import type { CompetitionInfo } from "../types";

/** Competition metadata changes rarely; fetch once per page load. */
export function useCompetitions(): CompetitionInfo[] {
  const [competitions, setCompetitions] = useState<CompetitionInfo[]>(
    FALLBACK_COMPETITIONS,
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchCompetitions(controller.signal)
      .then((response) => {
        if (response.competitions.length > 0) {
          setCompetitions(response.competitions);
        }
      })
      .catch(() => {
        // The fallback list is already good enough.
      });
    return () => controller.abort();
  }, []);

  return competitions;
}
