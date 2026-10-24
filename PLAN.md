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
- [ ] **6. Normalizer** — raw key events into MatchEvent
- [ ] **7. Normalizer edge cases** — own goals, penalties, VAR, extra time
- [ ] **8. Fixtures + tests** — vitest suite for the normalizer
- [ ] **9. D1 schema** — tables, indexes, local database setup
- [ ] **10. Repository layer** — upserts, idempotent event writes, queries

## Phase 2 — Engine

- [ ] **11. Poller: fixtures** — six scoreboards into the database
- [ ] **12. Poller: live detail** — summary fetch, diff, event writes
- [ ] **13. Resilience** — rate limits, backoff, caching, per-league isolation
- [ ] **14. HTTP API** — router, /api/matches, /api/matches/:id
- [ ] **15. Win probability** — model v1 from score, minute, red cards

## Phase 3 — Real time

- [ ] **16. Durable Object room** — WebSocket accept, hibernation, snapshot
- [ ] **17. Broadcast pipeline** — poller to room to clients
- [ ] **18. Room protocol** — message types, heartbeat, reconnect, dedupe
- [ ] **19. Rooms API** — create/join, nicknames, share codes

## Phase 4 — Frontend

- [ ] **20. Web scaffold** — Vite, React, TypeScript, design tokens
- [ ] **21. Match list** — live states, competition filter, auto-refresh
- [ ] **22. Match room** — scoreboard, clock, event feed
- [ ] **23. Live visuals** — win probability bar, momentum, animations
- [ ] **24. Realtime client** — reconnect, optimistic UI, room presence

## Phase 5 — Ship

- [ ] **25. Deploy** — cron trigger, CI, README, mock mode, final QA

## Status

Part 5 complete. Awaiting "proceed" for Part 6.
