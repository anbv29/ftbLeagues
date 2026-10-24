/**
 * Internal identifier helpers.
 *
 * Provider ids are only unique within a provider, so every internal id is
 * namespaced. This keeps rows from two sources from ever colliding and makes
 * it obvious where a record came from when debugging.
 */

export function makeTeamId(providerId: string, externalId: string): string {
  return `${providerId}:${externalId}`;
}

export function makeMatchId(providerId: string, externalId: string): string {
  return `${providerId}:${externalId}`;
}

export function makeEventId(matchId: string, externalId: string): string {
  return `${matchId}:${externalId}`;
}
