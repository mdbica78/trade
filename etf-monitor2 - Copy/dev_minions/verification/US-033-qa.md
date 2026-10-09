# US-033 QA checklist — Diagnosable load failures and schema-drift visibility

Round 1: review PASS (`US-033-review.md`, no Critical, 2 non-blocking notes — HANDOVER's "Files
changed" wording lagged the implementation for part of the round, fixed in place; one new cosmetic
ESLint unused-var warning). Tests PASS (`US-033-tests.md`, all 7 acceptance criteria MET,
162 test files / 1743 tests, typecheck/lint/build/test all green with `DATABASE_URL`, `CRON_SECRET`,
`GEMINI_API_KEY`, `GROQ_API_KEY` unset).

Every acceptance criterion (AC1-AC7) was drafted by the `story-planner` from DEC-019 §1-§3
(Decided) and the sprint-08 story file, not agent-invented — no PO confirmation flag needed here.

## Automated (already run, not manual)
1. `pnpm typecheck && pnpm lint && pnpm build && pnpm test` (offline, four env vars unset) — PASS.
   Re-run: `env -u DATABASE_URL -u CRON_SECRET -u GEMINI_API_KEY -u GROQ_API_KEY pnpm typecheck &&
   pnpm lint && pnpm build && pnpm test` (or `bash scripts/claude/predeploy-check.sh`).

## Manual checks (live, for the Codex QA loop / the user after deploy)
1. **Neon schema-drift line, live.** Before running `pnpm db:migrate` on Neon (or on a scratch
   Neon branch missing `0001_etf_report_links.sql`), open the deployed `/health`. Expect: the
   normal "Connected" state PLUS a line "Database schema out of date: run pnpm db:migrate. Missing
   tables:" with `etf_report_links` listed. After migrating and redeploying, reload `/health`:
   the line is gone.
2. **Home table degrades, live, pre-migration.** With `etf_report_links` missing on the live
   Neon database, open `/`. Expect: the home table still renders with report-derived PDF links
   (no crash, no "Could not load the data."). This is the exact production symptom Sprint 8 was
   opened for (HANDOVER "US-032 (superseded)" note) — confirms the fix.
3. **Vercel function logs, one safe line per failure.** Trigger a real failure in production (e.g.
   temporarily point `DATABASE_URL` at an unreachable host, or check logs from a genuine outage
   window) and check Vercel → Logs. Expect: one line per failure, exactly
   `[load-error] <scope> name=<ErrorName> code=<sqlstate> relation=<table>` (fields present only
   when known) — never a stack trace, connection string, or raw exception message.
4. **README steps, read-only.** In the Neon SQL editor, run
   `select to_regclass('public.etf_report_links');` — confirms the exact query from the README's
   "Deployment" section. `null` means the migration is missing.

## PO to confirm
- No new product decision in this story (DEC-019 §1-§3 settled every design question as
  TECHNICAL). Nothing here needs product confirmation before Codex QA.

## Files changed (US-033, final)
- new: `lib/log/load-error.ts`, `lib/log/load-error.test.ts`, `lib/health.pglite.test.ts`,
  `lib/monitoring/home-fallback.pglite.test.ts`, `app/health/page.schema.pglite.test.tsx`,
  `app/chat/page.load-error.test.tsx`, `app/load-error.boundary.test.ts`,
  `test/helpers/pglite-drizzle.ts`, `test/readme-deployment.test.ts`
- changed (source): `lib/health.ts`, `lib/monitoring/home.ts`, `lib/ai/chat.ts`, `app/page.tsx`,
  `app/etf/[symbol]/page.tsx`, `app/health/page.tsx`, `app/admin/etfs/page.tsx`,
  `app/admin/etfs/[symbol]/fields/page.tsx`, `app/admin/ai/page.tsx`, `app/admin/cron/page.tsx`,
  `app/admin/operations/page.tsx`, `messages/en.json`, `messages/ro.json`, `README.md`,
  `dev_minions/architecture/data-model.md`
- changed (tests/boundaries): `lib/ai/boundaries.test.ts`, `lib/health.test.ts`,
  `app/health/page.test.tsx`, `app/health/page.failure.test.tsx`, `app/page.test.tsx`,
  `app/etf/[symbol]/page.test.tsx`, `app/admin/etfs/page.test.tsx`,
  `app/admin/etfs/[symbol]/fields/page.test.tsx`, `app/admin/ai/page.test.tsx`,
  `app/admin/cron/page.test.tsx`, `app/admin/operations/page.test.tsx`, `lib/ai/chat.test.ts`
- `dev_minions/verification/US-033-plan.md` (story-planner), `US-033-review.md`, `US-033-tests.md`,
  `US-033-qa.md` (this file, new)
