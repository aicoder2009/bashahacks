# DevOps Basha Hacks

The platform for DevOps Basha Hacks, a beginner hackathon run by the DevOps Club at Basha High School. Theme: environment and sustainability.

Students describe an app in plain words, an AI writes it, and they see the chat, the code, and a live preview side by side. One click publishes the app to a public link, and a short form submits it for judging.

The code is open source under the MIT License, so you can run your own event with it.

## Who goes where

| Address | Who | Login |
| --- | --- | --- |
| `/` | Anyone | None. The event website |
| `/join` (or `/students`) | Students, solo or in a team | Event code and name |
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

You need Node.js and a Postgres database.

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

Open `/api/health` to check that the settings are present and the database answers.

## Settings

| Variable | What it is for |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `APP_SECRET` | Long random string. Signs login cookies and encrypts stored AI keys |
| `ADMIN_PASSCODE` | Passcode for `/admin` |
| `OPENROUTER_MANAGEMENT_KEY` | OpenRouter Management key. Creates and adjusts the team keys. Cannot spend |
| `OPENROUTER_API_KEY` | OpenRouter regular key with a small cap. A shared backup only |
| `AI_MOCK` | Set to `1` for a fake AI that always builds the same counter app. Local development and tests only |

The event code, judge passcode and TV link are made at random on first start. Find them in `/admin`, Settings.

## Tests

```bash
npx tsc --noEmit && npx eslint src tests
```

```bash
npm test
```

```bash
npm run test:e2e
```

The browser tests write to the database, so use a throwaway local Postgres, never one that holds real event data. They need:

- the dev server running with `AI_MOCK=1` and `ADMIN_PASSCODE=admin-dev`
- Playwright, which is not in `package.json`: `npm i --no-save playwright`, then `npx playwright install chromium`
- the event code. The tests read it with `psql` from a database named `bh` on port 54329. If yours is elsewhere, set `EVENT_CODE`

`npm run test:load` runs 40 students polling and 12 AI turns against the same setup.

## Run your own event

The platform was built for one event, so some details are written into the code. Change these before you use it:

- `src/app/page.tsx`: the event website, with the date, place, schedule, prizes and FAQ
- `src/lib/event.ts`: the default event name, start and end times, TV schedule, team size, and AI budget. Most of these can also be changed in `/admin` once the site is running
- `src/lib/openrouter.ts`: the site address sent to OpenRouter, and the default model list
- `src/lib/ai-prompt.ts`: what the AI is told about the event and its theme
- Search `src` for "Basha" to find the remaining page titles and labels

Then:

1. Create a Postgres database and deploy to a host that runs Next.js.
2. Set the variables above. Leave `AI_MOCK` empty on the live site.
3. Add credits to an OpenRouter account and turn auto top-up off, so the balance is a hard ceiling.
4. Follow `docs/RUNBOOK.md` for the night before and the day itself. `docs/day-of-schedule.html` is the minute by minute plan this event used, with five short workshops.

## Contributing and security

See `CONTRIBUTING.md`. To report a security problem privately, see `SECURITY.md`.

## License

MIT. See `LICENSE`.
