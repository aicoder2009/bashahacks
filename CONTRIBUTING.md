# Contributing

Thanks for wanting to help. This project runs a real event for beginners, so small, tested changes are preferred over rewrites.

## Before you open a pull request

1. Open an issue first for anything bigger than a small fix, so the approach can be agreed on.
2. Set the project up with the steps in `README.md`. Use a local Postgres database and `AI_MOCK=1`. Never point tests at a database that holds real event data, because the browser tests write to it.
3. Run the checks:

```bash
npx tsc --noEmit && npx eslint src tests
```

```bash
npm test
```

4. If you changed a page or an API route, also run the browser tests (see `README.md`).

## Rules that keep students safe

- Student apps stay in the sandboxed iframe. Do not add `allow-same-origin`.
- Students never see dollar amounts. Money appears only in `/admin`.
- No secrets in the repo, in issues, or in pull requests.
- User-facing copy is short and plain. No em dashes, no exclamation marks. Say "Publish", not "deploy".

## Security problems

Do not open a public issue for a security problem. See `SECURITY.md`.

## License

By contributing, you agree that your contribution is released under the MIT License in `LICENSE`.
