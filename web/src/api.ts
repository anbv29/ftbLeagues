import type {
  CompetitionsResponse,
  MatchDetailResponse,
  MatchListResponse,
  RoomResponse,
} from "./types";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { accept: "application/json", ...init?.headers },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as {
        error?: string;
        message?: string;
      };
      message = body.message ?? body.error ?? message;
    } catch {
      // Keep the status message.
    }
    throw new ApiError(message, response.status);
  }

  return (await response.json()) as T;
}

export function fetchMatches(
  date: string,
  competition: string | null,
  signal?: AbortSignal,
): Promise<MatchListResponse> {
  const params = new URLSearchParams({ date });
  if (competition) params.set("competition", competition);
  return request<MatchListResponse>(`/api/matches?${params.toString()}`, {
    signal,
  });
}

export function fetchMatch(
  matchId: string,
  signal?: AbortSignal,
): Promise<MatchDetailResponse> {
  return request<MatchDetailResponse>(
    `/api/matches/${encodeURIComponent(matchId)}`,
    { signal },
  );
}

export function fetchCompetitions(
  signal?: AbortSignal,
): Promise<CompetitionsResponse> {
  return request<CompetitionsResponse>("/api/competitions", { signal });
}

export function createRoom(matchId: string): Promise<RoomResponse> {
  return request<RoomResponse>("/api/rooms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ matchId }),
  });
}
