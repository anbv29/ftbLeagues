# ftbl — build plan

Real-time football match rooms for the Premier League, La Liga, Serie A,
Bundesliga, Ligue 1 and the Champions League. Free data, free hosting.

**Rules of engagement**

- One part at a time. Each part ends with a report and a commit.
- Commits land roughly every 100 lines of code.
- Work stops after each part until the instruction "proceed".

## Phase 0 — Foundation

- [x] **1. Scaffold** — package.json, tsconfig, wrangler, health route, docs
- [x] **2. Domain types** — Match, Team, Competition, MatchEvent, Provider
- [x] **3. Competition registry** — the six leagues, codes, seasons, config

## Phase 1 — Ingestion

- [x] **4. ESPN scoreboard adapter** — fetch + defensive parsing
- [x] **5. ESPN summary adapter** — key events, commentary, box score
- [x] **6. Normalizer** — raw key events into MatchEvent
- [x] **7. Normalizer edge cases** — own goals, penalties, VAR, extra time
- [x] **8. Fixtures + tests** — vitest suite for the normalizer
- [x] **9. D1 schema** — tables, indexes, local database setup
- [x] **10. Repository layer** — upserts, idempotent event writes, queries

## Phase 2 — Engine

- [x] **11. Poller: fixtures** — six scoreboards into the database
- [x] **12. Poller: live detail** — summary fetch, diff, event writes
- [x] **13. Resilience** — rate limits, backoff, caching, per-league isolation
- [x] **14. HTTP API** — router, /api/matches, /api/matches/:id
- [x] **15. Win probability** — model v1 from score, minute, red cards

## Phase 3 — Real time

- [x] **16. Durable Object room** — WebSocket accept, hibernation, snapshot
- [x] **17. Broadcast pipeline** — poller to room to clients
- [x] **18. Room protocol** — message types, heartbeat, reconnect, dedupe
- [x] **19. Rooms API** — create/join, nicknames, share codes

## Phase 4 — Frontend

- [x] **20. Web scaffold** — Vite, React, TypeScript, design tokens
- [x] **21. Match list** — live states, competition filter, auto-refresh
- [x] **22. Match room** — scoreboard, clock, event feed
- [x] **23. Live visuals** — win probability bar, momentum, animations
- [x] **24. Realtime client** — reconnect, optimistic UI, room presence

## Phase 5 — Ship

- [x] **25. Deploy** — cron trigger, CI, README, mock mode, final QA

## Status

All 25 parts complete. The Worker, D1 schema, Durable Object rooms, ESPN
ingestion, API, React frontend, local demo seed, tests and deployment workflow
are in place. The build passes locally and is ready for a Cloudflare account:
replace the placeholder D1 `database_id`, run the remote migration, then
`npm run deploy`. See [README.md](./README.md) for the full walkthrough.
