/** Bindings and environment shared by the Worker entry point and the API. */

export interface Env {
  DB: D1Database;
  /** Present once the realtime room lands (Part 16). */
  ROOMS?: DurableObjectNamespace;
  /** Set to "production" on the deployed Worker, if desired. */
  ENVIRONMENT?: string;
}
