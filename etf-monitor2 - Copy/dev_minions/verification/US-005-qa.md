# US-005 QA checklist — Seed ETF registry and field catalogue

Round 1: story-reviewer PASS (`US-005-review.md`), story-tester PASS (`US-005-tests.md`, 50/50 tests, typecheck/lint/build all green). No fix loop needed.

## Manual checks for the user (live Neon required — AC1, AC2)

1. **First run inserts the expected rows.**
   `cd /mnt/c/_mystaff/myG/trade/etf-monitor2 && export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt && DATABASE_URL=<your Neon URL> pnpm db:seed`
   Expected: exits successfully, prints "Seed complete." Inspect the DB (or `drizzle-kit studio`) and confirm exactly 3 rows in `etfs`, 8 in `field_catalog`, 6 in `tracked_fields` (2 per ETF), 1 in `settings` (id=1, default_locale='ro').

2. **Second run is a no-op (idempotent).**
   Run the same command again. Expected: exits successfully, row counts unchanged (no duplicates, no errors) — every insert uses `onConflictDoUpdate` on the table's unique constraint.

3. **PO to confirm the Romanian/English field labels** in `lib/db/seed-data.ts` (`seedFieldCatalog`) — these are the interface labels shown to the user, agent-written, distinct from whatever wording appears in the PDFs themselves.

## Notes from the Sprint 1 tech-lead audit (`SPRINT-01-audit.md`, non-blocking)

- Warning (W1): the round-1 review/test verdicts label AC1/AC2 "MET (manual QA)"; the audit's more accurate label is "UNVERIFIED" — no test actually runs `seed()` against any database (mocked or live), so a broken `seed()` body would still pass every automated gate. Checks 1–2 above are the only thing that actually proves AC1/AC2; please run them.
- Warning (W2): the upserts in `lib/db/seed.ts` will silently overwrite any admin edits (settings, tracked-field display order, disabled fields) once an admin UI exists (Sprint 5). Before then, either switch those specific upserts to `onConflictDoNothing` or treat `pnpm db:seed` as a first-install-only step, not something to re-run after go-live.
- Warning (W5): the README's env-var instructions say to put `DATABASE_URL` in `.env.local`, but `db:seed` (tsx) and `db:migrate` (drizzle-kit) don't load `.env.local` themselves — you must pass `DATABASE_URL=...` inline (as check 1 above does) or export it in your shell first.

## Files changed

- lib/db/seed-data.ts (new — seed data: 3 ETFs, 8 field-catalog rows, tracked-field defs, settings row)
- lib/db/seed-data.test.ts (new — AC4: internal consistency of the seed data)
- lib/db/seed.ts (new — idempotent upsert-based seed(db) function)
- scripts/db-seed.ts (new — CLI entry, calls getDb()+seed())
- package.json, pnpm-lock.yaml (`pnpm add -D tsx`; added `db:seed` script)
- dev_minions/verification/US-005-plan.md, US-005-review.md, US-005-tests.md, US-005-qa.md (new)
