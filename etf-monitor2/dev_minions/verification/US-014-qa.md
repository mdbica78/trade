# US-014 — QA checklist (Missing report, parse failure, and no-adapter handling)

Round 1: review PASS, tests PASS (556/556 total). No fix loop.
See `US-014-review.md` / `US-014-tests.md` for full evidence. All ACs drafted by `story-planner`
and reviewed by `tech-lead` at sprint-review 3 — no PO-confirm markers on this story's criteria.
Both technical decisions in the story (date-less failures write no row; partial-extraction
values are kept) were settled Decided at sprint-review 3, before implementation — nothing left
open for the demo.

## Automated (already verified by this loop, no action needed)
- AC1 (no adapter, `fetch` never called) — IF-1a/b/c/d
- AC2 (missing report, `no_report_entries` vs `list_not_found`) — IF-2a/b
- AC3 (fetch failures: http_error/network/timeout/not_pdf, one request each) — IF-3 (7 cases)
- AC4 (unusable report: unreadable text, `canHandle` false, adapter `ok: false`) — IF-4a/b/c/d/e/f
- AC5 (incomplete extraction: atomic `parse_error` row, found values kept, missing fields named) —
  IF-5a/b/c/d, E2E-3 (PGlite), PG-14a
- AC6 (contract violations: valid date → `parse_error` no values; invalid date → no row) —
  IF-6a/b/c/d, PG-14c
- AC7 (precedence: `ok` never downgraded — proven at the SQL level via `status <> 'ok'` guards,
  not just via `findReport`; a later `parse_error` replaces an older one) —
  IF-7a/b/c/d, PG-14d/e/f, SQ-14b
- AC8 (exactly one outcome, never throws, only `ok`/`parse_error` ever written — anti-vacuity
  trigger-per-code table plus 16 never-throws cases) — OC-8a, IF-8a/b/c, BD-14a/b
- AC9 (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`) — all green

## MANUAL-QA
None specific to this story. No new live BVB/Neon/Vercel/API-key surface: the write path reuses
US-012's already-live-proven `db.batch` (US-013's MANUAL-QA step 4 exercises the real Neon write);
this story only adds a new `status` value (`parse_error`) and new failure branches ahead of that
write, all exercised offline against PGlite and mocked fetch/adapters (no live network, no live DB).

## Non-blocking notes carried from review
- `lib/ingestion/ingest-etf.ts:132-140` — the outer `try/catch` around `ingestReport(...)` inside
  `ingestEtf` (mapping a throw to `persist_error`) is currently unreachable, since `ingestReport`
  already catches everything internally. Not a bug today; worth a heads-up if `ingestReport` is
  later refactored to throw before its own try-block.
- Two of the implementer's own test-authoring bugs were found and fixed while running local
  checks before verification (not code defects): IF-5b's fake adapter left a tracked field
  genuinely missing from `values` (wrong expected message); IF-8a's `no_adapter` trigger reused
  `stubPipelineDeps`'s blind `registry.get` instead of one returning `undefined`, so it
  accidentally exercised the `ok` path. Both fixed before round 1 review/test.

## Files changed
- `lib/ingestion/outcome.ts`, `lib/ingestion/outcome.test.ts`
- `lib/ingestion/ingest-etf.ts`
- `lib/ingestion/select-values.ts` (comment only)
- `lib/ingestion/ingest-etf.test.ts`
- `lib/ingestion/ingest-etf.failures.test.ts`
- `lib/ingestion/ingest-etf.pglite.test.ts`
- `lib/ingestion/store.test.ts`
- `lib/ingestion/store.pglite.test.ts`
- `lib/ingestion/boundaries.test.ts`
- `lib/ingestion/run-daily.test.ts`, `lib/cron/daily-handler.test.ts`, `lib/ingestion/default-deps.cron.test.ts` (vocabulary-only fixture edits)
- `test/helpers/ingest-fakes.ts`
