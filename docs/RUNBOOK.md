# Event day runbook

DevOps Basha Hacks, Saturday November 14, room K105, 9:00 AM to 2:00 PM.

## The four links

| What | Link | Who needs what |
| --- | --- | --- |
| Students | the site address, for example `bashahacks.vercel.app` | The event code (shown on the TV) |
| Judges | add `/judges` | The judge passcode (Admin, Settings) |
| Officers | add `/admin` | The admin passcode |
| TV | Admin, Settings, "TV link" | Open it on the computer plugged into the TV |

## The night before (Friday)

1. Open the site on a school computer. If the school filter blocks it, tell Karthick right away.
2. Log in at `/admin`.
3. **AI tab**
   - Press **Check OpenRouter balance**. It should show about $50. Auto top-up must be off in the OpenRouter account.
   - Press **Test AI**. You should get a short friendly sentence back and a tiny cost.
   - Press **Prepare team keys** with 20. The pool should then show 20 free keys.
4. **Event tab**: check the start time (9:30 AM) and end time (12:30 PM), and that Auto start and Auto end are on.
5. **Settings tab**: copy the TV link, write down the event code and the judge passcode.
6. Do one practice round with another officer: join as a student, build something, publish, submit, score it at `/judges`, then run the podium from the Judging tab.
7. When the practice is done: Settings, Danger zone, **Wipe event data** (type WIPE). This clears practice students and scores and keeps your settings and AI keys.
8. After the wipe, set the phase back to **Lobby** and turn **Auto start** on again (Event tab).

## Saturday morning

| Time | What happens | What you do |
| --- | --- | --- |
| 8:40 | Setup | Open the TV link on the TV computer, press F11 for full screen, click once to turn on sound. Confirm it shows the Lobby with the event code. |
| 9:00 | Welcome | Students go to the site, type the event code, pick a name and a character. Watch them pop up on the TV. |
| 9:30 | Building starts | It starts by itself. If you are running late, turn Auto start off before 9:30 and press **Start building now** when ready. |
| 9:30 to 12:30 | Building | Walk the room. Send announcements from the Announce tab. Watch the Teams tab for anyone running low on AI. |
| 12:15 | Reminder | Announce: "15 minutes left. Press Publish, then Submit." |
| 12:30 | Time is up | Building closes by itself. The TV switches to Judging. |
| 12:30 to 1:30 | Judging and lunch | Judges walk the room and score on their phones at `/judges`. Watch progress in the Judging tab. |
| 1:30 | Winners | Judging tab: **Lock results and start the winners reveal**, then press Show 3rd place, Show 2nd place, Show 1st place, one at a time. |
| 2:00 | Done | Set the phase to Done. |

## Common situations

**A student closed the tab or switched computers.**
On the first page, press "Already joined? Get back in with your team code". Their code is in the Teams tab if they forgot it.

**A student is out of AI ("used all of its AI").**
Teams tab, find the team, **Add AI**. The box shows the most you can give without going over the event budget. Check the AI tab first to see how much budget is left.

**Someone joined the wrong team or picked a silly name.**
Teams tab: Move member, Rename, or Remove member.

**The AI gave a student a broken app.**
They can press **Undo**, or open **History** and go back to a version that worked. If the preview shows a yellow error bar, **Ask AI to fix this** usually sorts it out.

**The AI is failing for everyone.**
1. AI tab, press **Test AI** and read the message.
2. If it says the model is not found, press **Load models** and pick another one.
3. If the balance is used up, the event budget is spent. AI stays off. Students can still edit their code by hand, publish, and submit.

**The AI bill is climbing too fast.**
AI tab, **Pause AI for everyone**. Students keep their apps and can still publish and submit. Turn it back on when you are ready.

**We need more time.**
Overview, **+5 min**. If building already closed, +5 min reopens it for five minutes.

**The TV shows the wrong thing or froze.**
Refresh the page on the TV computer. It picks up where the event is.

**The whole site is down.**
Check [vercel-status.com](https://www.vercel-status.com). Students' work is saved on the server after every change, so nothing is lost. Announce a short break and try again in a few minutes.

## Spending limits, in one place

- OpenRouter account: $50 of credits, auto top-up off. This is the hard ceiling.
- Each team key: $2.50 cap, enforced by OpenRouter.
- Shared backup key: $7 cap. Used only if a team has no key of its own. The Teams tab marks teams that are on it.
- The platform also stops all AI one dollar before the total budget set in the AI tab.
- Students never see dollars, only a bar that says how much AI they have left.

## After the event

1. Judging tab, **Download results (CSV)**.
2. Published apps stay online at their links as long as the site and database stay up.
3. To clear everything for next time: Settings, **Wipe event data**.
4. In OpenRouter, delete the team keys (they are named `bashahacks-team-...`) so no credit can be spent later.
