# ftbl

**Every match, one room.**

ftbl is a real-time football matchday app for the Premier League, La Liga,
Serie A, Bundesliga, Ligue 1 and the Champions League. Follow the live card,
open a room for any match, and watch the score, clock, key moments and win
probability update together.

It is built to run for **$0**: public data, Cloudflare's free tier, no API key,
no domain and no credit card.

## What is in it

- **A live matchday** — fixtures grouped into live, upcoming and results, with
  competition and date filters, crests and a spotlight match.
- **One room per match** — a shared scoreboard, locally ticking clock, event
  feed, Poisson win probability and floating reactions.
- **Real-time by default** — one WebSocket per room, server-backed snapshots,
  heartbeat/reconnect, event de-duplication and a connection badge.
- **Shareable rooms** — create a code and copy an invite link. Nicknames are
  anonymous, so there is nothing to sign up for.
- **A floodlit-stadium look** — dark pitch, lime accents, glass panels,
  oversized type, self-hosted fonts, a looping ticker and a goal flash.
- **Phone-ready** — responsive from 390px up, a mobile reaction dock, safe-area
  handling and reduced-motion support.

## How it works

```text
ESPN scoreboard + summary
          │
          ▼
   poller (cron, 1×/min) ──► normaliser ──► D1 (matches, events, rooms)
          │                                      ▲
          │ MatchUpdate                          │ REST reads
          ▼                                      │
   MatchRoom Durable Object ◄── WebSocket ── React client
   (one per match, hibernating)
```

- A Cloudflare cron trigger runs every minute. It fetches the six competition
  scoreboards, then full summaries only for live or newly finished matches.
- The poller writes a normalised match and only new events to D1. When
  something changes it broadcasts an update to the match's Durable Object.
- One Durable Object per match owns the WebSocket fan-out, presence and
  reactions. It hibernates when nobody is connected.
- The React app talks REST for lists and snapshots, and WebSocket for the room.
  The frontend build is served as static assets by the same Worker.

## Stack and cost

| Layer     | Choice                              | Free-tier note                         |
| --------- | ----------------------------------- | -------------------------------------- |
| Runtime   | Cloudflare Workers                  | 100k requests/day                      |
| Realtime  | Durable Objects + WebSockets        | 100k requests/day, 13k GB-s/day        |
| Storage   | D1 (SQLite)                         | 5M row reads/day, 100k row writes/day  |
| Frontend  | Vite + React + TypeScript           | Static assets are free and unlimited   |
| Data      | ESPN public JSON endpoints          | No key, no account                     |
| Scheduler | Workers cron triggers               | Included with Workers                  |
| CI        | GitHub Actions                      | Free for public repositories           |

## Run locally

**Prerequisites:** Node.js 22+ and npm 10+. No Cloudflare account is needed for
local development.

```bash
git clone https://github.com/anbv29/ftbLeagues.git
cd ftbLeagues
npm install

# The Worker serves the built frontend from web/dist.
npm run build:web

# Create the local D1 schema.
npm run db:migrate

# Start the Worker, API, WebSocket rooms and static frontend.
npm run dev
```

Open **http://127.0.0.1:8787/**.

The local database lives under `.wrangler/`. Data only appears after a poll;
the scheduled job does not run automatically in local dev. Trigger one:

```bash
curl -X POST "http://127.0.0.1:8787/api/dev/poll"
```

You can also exercise the cron handler directly at
`http://127.0.0.1:8787/cdn-cgi/local/scheduled`.

### Frontend hot reload

Run the Worker and Vite in two terminals:

```bash
# terminal 1 — API, rooms, poller
npm run dev

# terminal 2 — React with HMR, proxying /api and /ws to :8787
npm run dev:web
```

Open **http://127.0.0.1:5173/**. Use `127.0.0.1` rather than `localhost` so the
dev-only poll endpoint is allowed.

### Demo data

If there is no live football, seed a live Arsenal–Liverpool match, a finished
El Clásico and an upcoming Dortmund–Bayern game:

```bash
npm run db:demo
```

Then open the app on today's date. The demo room code is `FTBL22`.

To watch the realtime path end to end, open the demo room and add a goal from
another terminal. Every connected browser receives the update, the score
changes and the goal flash plays:

```bash
curl -X POST "http://127.0.0.1:8787/api/dev/demo-goal?matchId=demo%3Aeng.1%3Aars-liv&side=away&player=Salah"
```

Remove the seed with:

```bash
npm run db:demo:clear
```

## Scripts

| Command                 | What it does                                             |
| ----------------------- | -------------------------------------------------------- |
| `npm run dev`           | Worker + built frontend on `127.0.0.1:8787`              |
| `npm run dev:web`       | Vite dev server on `127.0.0.1:5173`, proxies to the API  |
| `npm run build:web`     | Production frontend build into `web/dist`                |
| `npm run build`         | Frontend build + Worker dry-run bundle (no deployment)   |
| `npm run deploy`        | Frontend build + `wrangler deploy`                       |
| `npm test`              | Vitest suite                                             |
| `npm run typecheck`     | Worker and test TypeScript                               |
| `npm run typecheck:web` | Frontend TypeScript                                      |
| `npm run db:migrate`    | Apply D1 migrations locally                              |
| `npm run db:demo`       | Seed local demo matches                                  |
| `npm run db:demo:clear` | Remove local demo matches                                |
| `npm run db:init`       | Apply the initial schema directly (older local setups)   |

## HTTP API

All responses are JSON. Times are ISO 8601 UTC.

| Method | Path                              | Purpose                                      |
| ------ | --------------------------------- | -------------------------------------------- |
| `GET`  | `/health`                         | Worker liveness                              |
| `GET`  | `/api/health`                     | API health + server time                     |
| `GET`  | `/api/competitions`               | The six competitions and current seasons     |
| `GET`  | `/api/matches?date=&competition=` | Matches for a day (`YYYY-MM-DD`), optionally filtered |
| `GET`  | `/api/matches/:id`                | Match, events and win probability            |
| `POST` | `/api/rooms`                      | Create a room `{ "matchId": "..." }`         |
| `GET`  | `/api/rooms/:code`                | Resolve a room code to its match             |

Example:

```bash
curl "http://127.0.0.1:8787/api/matches?date=2026-10-25&competition=eng.1"
curl "http://127.0.0.1:8787/api/matches/espn%3A401875036"
curl -X POST "http://127.0.0.1:8787/api/rooms" \
  -H "content-type: application/json" \
  -d '{"matchId":"espn:401875036"}'
```

`POST /api/dev/poll` and `POST /api/dev/demo-goal` are local-only helpers and
are disabled when `ENVIRONMENT=production`. The demo-goal helper only accepts
matches whose id starts with `demo:`.

## Room protocol

Connect to `/ws/<matchId>?room=<optional-code>`. A room code is validated when
present, but a match can be watched without creating one.

Client messages:

```json
{ "type": "hello", "nickname": "Ada" }
{ "type": "ping" }
{ "type": "reaction", "emoji": "⚽" }
```

Server messages are `welcome` (snapshot, presence, room), `update` (only unseen
events), `presence`, `pong`, `reaction` and `error`. Protocol version is `1`.
Reactions are rate-limited server-side; clients send a heartbeat and reconnect
with backoff when the socket drops.

## Deploy to Cloudflare (free)

The repository ships a ready-to-deploy Worker, but **the `database_id` in
`wrangler.toml` is a placeholder**. Replace it once, then deploy.

1. Log in to Cloudflare:

   ```bash
   npx wrangler login
   ```

2. Create the production D1 database:

   ```bash
   npx wrangler d1 create ftbl
   ```

   Copy the `database_id` it prints into `wrangler.toml`, replacing the zeros.

3. Apply the schema to the remote database:

   ```bash
   npx wrangler d1 migrations apply ftbl --remote
   ```

4. Build and deploy:

   ```bash
   npm run deploy
   ```

5. Open the `https://ftbl.<your-subdomain>.workers.dev` URL printed by
   Wrangler. The cron trigger starts polling on the next minute.

No custom domain, payment method or secret is required for this path. A
`workers.dev` subdomain is created during Cloudflare onboarding.

### GitHub Actions

`.github/workflows/ci.yml` runs tests, typechecks and the production Worker
bundle on every push and pull request. On `main` it also applies remote D1
migrations and deploys — once these repository secrets exist:

- `CLOUDFLARE_API_TOKEN` — a token with **Workers Scripts: Edit**, **D1: Edit**
  and **Account Settings: Read**.
- `CLOUDFLARE_ACCOUNT_ID` — found in the Cloudflare dashboard.

Add them under **Settings → Secrets and variables → Actions**. Do not commit
them. The deploy job is skipped for pull requests.

### Free-tier reality check

- Workers free plan has a per-invocation CPU budget. The poller parses large
  ESPN summaries; if you see CPU-limit errors, lower the detail limit or poll
  less often in `wrangler.toml`.
- D1's free write allowance is ample for one poll a minute, but the API is
  read-heavy; the match list refreshes every 30 seconds per open tab.
- Durable Object free limits cover small rooms comfortably. Hibernation keeps
  idle rooms cheap.
- ESPN's endpoints are public but unofficial. They can change, throttle or
  disappear. The provider adapter is deliberately isolated so another source
  can be added.

## Project layout

```text
src/
  api/          HTTP router, room endpoints, response helpers
  config/       competition registry and season resolution
  data/         repository interface, D1 and in-memory implementations
  domain/       match, event, clock, probability and room-code types
  engine/       poller, fixture discovery and win probability
  providers/    ESPN client, parser, normaliser and fixtures
  rooms/        Durable Object, broadcast pipeline and wire protocol
web/
  src/          React app, components, styles and realtime hooks
  public/       favicon
migrations/     D1 schema
scripts/        local demo seed
test/           Vitest suites and ESPN fixtures
```

## Known limitations

- **One-minute freshness.** This is a matchday companion, not a betting
  feed. The provider does not expose a live clock, so the client interpolates
  it locally between authoritative updates.
- **Current matchday only.** Fixtures are discovered from the day's
  scoreboards; there is no historical archive or league table yet.
- **Heuristic probabilities.** The Poisson model uses score, minute and red
  cards. It is an explainable reading of the match, not a prediction or advice.
- **No accounts.** Nicknames and rooms are anonymous and intentionally
  disposable. There is no chat history or moderation layer.
- **ESPN quirks.** Own goals are credited to the benefiting team, second
  yellows arrive as a red card with detail, and shootout kicks are excluded.

## Status

Parts 1–25 of the build plan are complete. See [PLAN.md](./PLAN.md) for the
part-by-part breakdown. Tests, typechecks and production builds pass locally;
the repository is deployment-ready, but not deployed from this environment.

Football data comes from ESPN's public endpoints. This project is not
affiliated with ESPN, UEFA or any league.
