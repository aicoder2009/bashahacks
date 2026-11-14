# DevOps Basha Hacks

A platform for a beginner hackathon at Basha High School: students describe an app, an AI builds it, and they see chat, code, and a live preview. Includes admin, judging, and a TV screen.

**Read `docs/HANDOFF.md` first.** It says what is done, what is blocked, and what to do next. `docs/RUNBOOK.md` is the event-day guide for officers.

## Commands

```bash
npm install
npm run dev          # needs .env.local, see .env.example
npm test             # unit tests
npm run test:e2e     # browser tests; needs the dev server, AI_MOCK=1, and ADMIN_PASSCODE=admin-dev
npm run test:load    # 40 students polling, 12 AI turns
npx tsc --noEmit && npx eslint src tests
```

Local development needs a Postgres database in `DATABASE_URL`. Tables create themselves on first request. The browser tests read the event code with `psql` on port 54329, or take it from the `EVENT_CODE` variable.

## Layout

- `src/app/` pages: `/` event website, `/join` check in, `/build` student workspace, `/p/[slug]` published apps, `/judges`, `/admin`, `/tv`
- `src/app/api/` route handlers. Admin actions all go through `api/admin/action`
- `src/lib/` server logic: `db.ts`, `auth.ts`, `event.ts` (phases, timer, budget), `openrouter.ts` (keys, limits, streaming), `sandbox.ts`, `parse-files.ts`
- `src/components/` UI, grouped by surface (`build/`, `admin/`, `judges/`, `tv/`)
- `tests/` unit tests in `tests/unit`, browser tests as `tests/e2e-*.mjs`

## Rules for this project

- This is Next.js 16. Read `AGENTS.md`, and check `node_modules/next/dist/docs/` before using a Next.js API from memory.
- User-facing copy: short and plain. No em dashes, no exclamation marks. Say "Publish", not "deploy".
- Students never see dollar amounts. Money appears only in `/admin`.
- Never put secrets in the repo or in chat. Keys live in Vercel environment variables.
- Student apps stay in the sandboxed iframe. Do not add `allow-same-origin`.
- The event is on Saturday Nov 14, 2026. Prefer small, tested changes over rewrites, and run the browser tests before merging to `main`, because `main` deploys straight to the live site.
