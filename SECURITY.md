# Security

This platform is used by high school students, so security reports are taken seriously.

## Reporting a problem

Please do not open a public issue. Use GitHub's private reporting instead: open the **Security** tab of this repository and press **Report a vulnerability**.

Include what you found, how to reproduce it, and what an attacker could do with it.

## What matters most

- Anything that lets a student app escape its sandboxed iframe or read another person's login
- Anything that lets someone act as an admin or a judge without the passcode
- Anything that exposes an AI key or lets AI spending go past a team's cap or the event budget
- Anything that exposes student names or work to people outside the event

## If you run your own event

- Set a long random `APP_SECRET` and a strong `ADMIN_PASSCODE`.
- Never set `AI_MOCK=1` on a live site.
- Keep auto top-up off on the AI account, so the credit balance is a hard ceiling.
