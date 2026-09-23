# US-006 QA checklist — Deploy to Vercel with a health-check page

Round 1: story-reviewer PASS (`US-006-review.md`), story-tester PASS (`US-006-tests.md`, 56/56 tests, typecheck/lint/build all green). No fix loop needed.

## Manual steps the user performs (live Neon + Vercel)

1. Create a Neon Postgres database and copy its connection string.
2. Create a Vercel project from this GitHub repository (Hobby plan).
3. In the Vercel project's environment variables, set `DATABASE_URL` (the Neon connection string) and `CRON_SECRET` (any random value; unused until Sprint 3).
4. Run migrations against Neon: `DATABASE_URL=<neon-url> pnpm db:migrate`.
5. Seed the registry: `DATABASE_URL=<neon-url> pnpm db:seed` (see `US-005-qa.md`).
6. Deploy (push to the connected branch, or `vercel deploy`).
7. Open the deployed `/health` URL. Expected: reports a successful connection, ETF count 3, field-catalogue count 8, current locale.

## Manual check — AC1/AC2 locally, before deploying

8. `cd /mnt/c/_mystaff/myG/trade/etf-monitor2 && export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt && DATABASE_URL=<your Neon URL> pnpm dev`, open `http://localhost:3000/health`. Expected: connected state with the seeded counts (AC1). Click the RO/EN switcher — all `/health` labels switch (AC3).
9. Temporarily set `DATABASE_URL` to an unreachable value (e.g. `postgresql://u:p@127.0.0.1:1/x`) and reload `/health`. Expected: page still returns 200 (no crash/500), shows a clear "database unreachable" message with the error text (AC2).

## Notes carried from review (non-blocking)

- ~~Warning: `app/health/page.tsx` uses the async `next-intl/server` API instead of the sync `useTranslations`/`useLocale` convention.~~ **Withdrawn by the Sprint 1 tech-lead audit (`SPRINT-01-audit.md`, finding W3): the reviewer's advice was wrong.** `HealthPage` is an async component; next-intl's sync hooks throw when called there. The code is correct as written. The real gap is that `README.md`'s Internationalisation section doesn't yet say `next-intl/server` is expected in async Server Components — a documentation follow-up, not a code change.
- Note: the health page shows the raw DB error message on an unauthenticated page (auth is explicitly out of scope for this story). Unlikely to leak secrets, but worth a second look before a public demo.
- Note: `components/AppHeader.test.tsx` was not updated to assert the new `Nav.health` link renders — not required by any AC, minor coverage gap.
- Warning (Sprint 1 audit, W4): no test covers `getDb()` itself throwing `MissingDatabaseUrlError` inside `loadHealthStatus`'s outer try/catch (the likely failure on a fresh Vercel deploy missing `DATABASE_URL`). Also, `lib/health.test.ts`'s success-path test uses the same count for both tables, so it would not catch the two counts being swapped.
- Warning (Sprint 1 audit, W6): the health query has no timeout; a hanging (not refusing) database connection could produce a 504 instead of the AC2 failure message.

## Files changed

- lib/health.ts (new — getHealthStatus(db): success/failure union, never throws)
- lib/health.test.ts (new — success + failure + non-Error-throw paths, mocked Db)
- app/health/page.tsx (new — /health route)
- app/health/page.test.tsx (new — RO/EN label switching + failure-state rendering)
- components/AppHeader.tsx (edited — added Nav.health link)
- README.md (edited — Deployment + Health check sections, env var docs)
- dev_minions/verification/US-006-plan.md, US-006-review.md, US-006-tests.md, US-006-qa.md (new)
