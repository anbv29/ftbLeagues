# ftbl

Real-time football match rooms — live scores, events and win probability for
the top five European leagues and the Champions League.

Built to run entirely on free tiers: Cloudflare Workers, Durable Objects, D1,
and public football data.

## Stack

- **Runtime:** Cloudflare Workers (TypeScript)
- **Realtime:** Durable Objects + WebSockets
- **Storage:** D1 (SQLite)
- **Frontend:** Vite + React + TypeScript
- **Data:** ESPN public API, with a provider interface for fallbacks

## Local development

```bash
npm install
npm run dev        # http://localhost:8787
npm run typecheck
npm run test
npm run build      # dry-run bundle, no deploy
```

No Cloudflare account is needed to develop or test locally.

## Status

See [PLAN.md](./PLAN.md). Built in 25 parts, one at a time.
