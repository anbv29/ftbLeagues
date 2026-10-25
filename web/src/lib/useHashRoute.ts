import { useEffect, useState } from "react";

export type Route =
  | { view: "list" }
  | { view: "match"; matchId: string; roomCode: string | null };

function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, "");
  const [path = "", query = ""] = raw.split("?");

  if (path.startsWith("/match/")) {
    try {
      const matchId = decodeURIComponent(path.slice("/match/".length));
      if (matchId) {
        const params = new URLSearchParams(query);
        const room = params.get("room")?.trim().toUpperCase() ?? null;
        return { view: "match", matchId, roomCode: room || null };
      }
    } catch {
      return { view: "list" };
    }
  }

  return { view: "list" };
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    parseHash(window.location.hash),
  );

  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo(0, 0);
    };

    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return route;
}
