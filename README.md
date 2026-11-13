# DevOps Basha Hacks

The platform for DevOps Basha Hacks, a beginner hackathon run by the DevOps Club at Basha High School. Theme: environment and sustainability.

Students describe an app in plain words, an AI writes it, and they see the chat, the code, and a live preview side by side. One click publishes the app to a public link, and a short form submits it for judging.

## Who goes where

| Address | Who | Login |
| --- | --- | --- |
| `/` (or `/students`) | Students, solo or in a team | Event code and name |
| `/build` | Students who have joined | Their session |
| `/p/<slug>` | Anyone | None. A published student app |
| `/judges` | Judges | Judge passcode and name |
| `/admin` | Club officers | Admin passcode |
| `/tv?key=...` | The big screen in the room | Key in the link |

## How it is built

- Next.js (App Router) and TypeScript, hosted on Vercel
- Postgres for all event data. Tables are created automatically on first start
- Live updates use plain HTTPS polling, because school networks often block WebSockets
- AI calls go to OpenRouter. Each team gets its own key with a hard spending cap, and students only ever see a usage bar
- Student apps run in a sandboxed iframe, so they cannot touch anyone's login

## Run it locally

```bash
cp .env.example .env.local
```

Fill in `DATABASE_URL`, `APP_SECRET`, and `ADMIN_PASSCODE`, and set `AI_MOCK=1` to use the built-in fake AI. Then:

```bash
npm install
```

```bash
npm run dev
```

## Tests

```bash
npm test
```

```bash
npm run test:e2e
```

The end-to-end tests need the dev server running with `AI_MOCK=1` and the phase set to Hacking.

See `docs/RUNBOOK.md` for the event-day checklist.
