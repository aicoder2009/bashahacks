# Handoff notes

Written November 13, 2026, the day before the event, so a new Claude session (or a person) can pick up where the last one stopped. No secrets are in this file, only variable names.

## Where things stand

- **Code:** everything is on `main`. Vercel deploys `main` automatically.
- **Live site:** https://bashahacks.vercel.app, Vercel project `bashahacks` in the team `karthickaruns-projects`. It replaced an older site called Hack the Den at the same address.
- **Tested locally with the fake AI:** the full event (admin, announcements, AI limits, judging, podium), the solo student flow, the team flow, 20 unit tests, a load check, and the production build.
- **Not tested at all yet:** real AI calls, creating OpenRouter keys, changing a key's limit, and the live site end to end.

## Database (fixed Nov 13)

A free Neon database, `bashahacks-db`, is connected to the Vercel project in all environments. `/api/health` reports `"ok":true` and the tables have been created.

Development and Preview point at the same live database. Do not pull the Vercel env vars and run the browser or load tests against them, because those tests would write into the event data. Run the tests against a local Postgres instead.

## Decisions already made (do not reopen without Karthick)

| Topic | Decision |
|---|---|
| Event | Saturday Nov 14, 2026, room K105. Welcome 9:00, building 9:30 to 1:00 with lunch at 12:00 while they build, presentations 1:00, winners 1:40, done 2:00. Arizona time. |
| Size | About 10 to 15 students expected. Solo or teams of up to 3. |
| AI budget | $50 total, hard maximum. OpenRouter credits with auto top-up off. |
| OpenRouter keys Karthick made | `basha-hacks-2026-managment2` (management key, made on OpenRouter's Management keys page, not the API keys page; it has no spend cap and cannot make AI calls) and `basha-hacks-2026-backup` (regular key, $7 cap, shared fallback) |
| Keys the platform makes | `bashahacks-team-xxxxxx` at $4 each, and one `bashahacks-test-xxxxxx` at $3 |
| Model | `openai/gpt-5.6-luna` with thinking level High. Step up if its apps are poor: `anthropic/claude-sonnet-5.5` (about 6 to 10 cents per request, so $4 is only 40 to 65 requests). |
| Students and money | Students never see dollars, only a usage bar. Dollars appear only in admin. |
| Judging | Teams show their apps to the room on the TV (an officer presses Show on TV in the Judging tab). Judges score privately on phones. Top 3 on the podium. |
| Copy | No em dashes, no exclamation marks, plain friendly wording. |

## What is left, in order

### 1. Cheap live test (the account has about $5 of credits for this)

1. `/api/health` says `"ok":true`.
2. Log in at `/admin` with the passcode Karthick set in Vercel.
3. AI tab: **Check OpenRouter balance**. Set the total budget to that balance so the platform stops AI before the credit runs out.
4. Confirm the model is `openai/gpt-5.6-luna` (or auto pick) and the thinking level is High.
5. **Test AI**. This is the first real AI call and the first real key creation. If it fails, read the message and check `src/lib/openrouter.ts` against OpenRouter's current API reference.
6. **Prepare team keys** with 2.
7. Event tab: start building. As a student: join, build a sustainability app from a prompt, ask for a change, undo, publish, open the public link, submit. As a second student: build a small game.
8. Note the cost and wait time of each request (admin Teams tab shows dollars per team).
9. Send an announcement and see it on the student screen and on the TV link (admin, Settings).
10. Judging tab: press **Show on TV** next to one app and check it fills the TV, then **Stop showing**. Score both apps at `/judges` on a phone. Check the leaderboard, then run the podium from the Judging tab.
11. Limits: set one team's AI amount just above what it has spent, confirm it gets blocked, top it up, confirm it works again. This also tests changing a key's limit at OpenRouter.
12. Settings: **Wipe event data** (type WIPE). Event tab: phase Lobby, auto start on, start 9:30 AM and end 1:00 PM on Nov 14.

Target: under $1 spent.

### 2. If the test passes

1. Karthick adds credits up to $50 total.
2. AI tab: total budget $50, starting amount per team $4, **Prepare team keys** with 12.
3. Open the site on a school computer to confirm the school filter allows it.
4. Give officers `docs/RUNBOOK.md`.

### 3. If something fails

- **AI errors:** most likely a mismatch with OpenRouter's API. The streaming chat request and key creation were checked against the docs; changing a key's limit (`PATCH /keys/{hash}`) and the balance check (`GET /credits`) were not.
- **Luna's apps are weak or slow:** switch the model to `anthropic/claude-sonnet-5.5` in admin, set the thinking level to Off, and plan for fewer requests per team.
- **Teams misbehave:** Event tab, turn off "Teams allowed". Everyone builds solo.

## Things worth knowing about the code

- `/` is the event website (static, no database). Students join at `/join`, which the home page's Check in button, the TV and its QR code all point to. `/students` redirects there.
- `docs/day-of-schedule.html` is the minute by minute plan for officers: workshops, roles, setup checklist. Open it in a browser.
- `src/lib/db.ts` creates all tables on first use. There are no migrations. To change the schema, add `ALTER TABLE ... IF NOT EXISTS` statements to the `SCHEMA` string.
- Live updates are plain polling of `/api/sync` every 2.5 seconds. No WebSockets, on purpose: school networks often block them.
- Student apps run in a sandboxed iframe with no same-origin access (`src/lib/sandbox.ts`). Do not add `allow-same-origin`.
- The AI returns whole files inside `<file name="...">` tags (`src/lib/ai-prompt.ts`, `src/lib/parse-files.ts`).
- `AI_MOCK=1` swaps in a fake AI that always builds the same counter app. Tests rely on it. It must not be set on Vercel.
