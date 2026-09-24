# US-012 QA checklist — Ingestion pipeline: discover → download → extract → persist, per ETF

Round 1: review PASS (`US-012-review.md`), tests PASS (`US-012-tests.md`), 443/443 tests. No fix loop.

## Automated (already run by the dev loop)
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all green.
- Clean install proof: `rm -rf node_modules && pnpm install --frozen-lockfile` — exit 0 (package.json changed: `@electric-sql/pglite` devDependency added, `unpdf` pinned exactly).

## Manual / live checks
None specific to this story. `ingestEtf` is not called from anywhere in production yet — nothing wires it into a route or cron job until US-013. The live write to Neon (proving the Neon HTTP `db.batch` transaction really is atomic, R6 in the plan) is proven by US-013's AC9 and `sprint-03.md` QA steps 4–5, not here.

## PO to confirm at the demo
- Both PRODUCT decisions in `backlog/stories/US-012.md` are non-blocking and this story ships the literal FR3 reading:
  1. Persist tracked fields only (not every extracted field) — planner recommendation was "every field", not applied without the PO.
  2. Newest report link only per ETF per day (catch-up filings, e.g. a Monday row holding Friday+Saturday, only give the newest) — planner recommendation was to ingest every link in the newest filing row as a follow-up story, not applied without the PO.

## Files changed
- New: `lib/ingestion/select-values.ts`, `lib/ingestion/select-values.test.ts`
- New: `lib/ingestion/store.ts`, `lib/ingestion/store.test.ts`, `lib/ingestion/store.pglite.test.ts`
- New: `lib/ingestion/ingest-etf.ts`, `lib/ingestion/ingest-etf.test.ts`, `lib/ingestion/ingest-etf.pglite.test.ts`
- New: `lib/ingestion/default-deps.ts`, `lib/ingestion/default-deps.test.ts`
- New: `lib/ingestion/boundaries.test.ts`
- New: `test/helpers/pglite.ts`
- Modified: `package.json` (added devDependency `@electric-sql/pglite@0.5.8` exact pin; `unpdf` pinned `^0.11.0` → `0.11.0`), `pnpm-lock.yaml` (regenerated)
- No `pnpm-workspace.yaml` change, no schema/migration change.
