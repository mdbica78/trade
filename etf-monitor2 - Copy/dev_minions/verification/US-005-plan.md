# US-005 plan: Seed ETF registry and field catalogue

Simple story (no schema change, no adapter/AI/cron/auth, ≤6 ACs) — planned directly, no story-planner.

## Files
- `lib/db/seed-data.ts` (new): plain exported arrays/objects — the 3 ETFs, 8 field-catalogue rows, tracked-field keys per ETF (`units_in_circulation` order 0, `nav_per_unit` order 1), settings row (`id:1, default_locale:"ro"`). No DB import — pure data, so AC4 tests it without a connection.
- `lib/db/seed.ts` (new): `export async function seed(db: Db)` — upserts via drizzle `.insert(...).values(...).onConflictDoUpdate/onConflictDoNothing` on each table's unique constraint (etfs.symbol; field_catalog (adapter_key,field_key); tracked_fields (etf_id,field_key) — resolve etf_id from the symbol just inserted; settings id=1). Idempotent by construction (upsert, not delete+insert).
- `scripts/db-seed.ts` (new): thin CLI entry — `import { getDb } from "@/lib/db"; import { seed } from "@/lib/db/seed"; seed(getDb()).then(...)`. Add `"db:seed": "tsx scripts/db-seed.ts"` to package.json (add `tsx` devDependency — small, justified, needed to run TS outside Next/Vitest).
- `lib/db/seed-data.test.ts` (new, AC4): every tracked-field `fieldKey` exists in the field catalogue; every ETF's `adapterKey` appears in the field catalogue's `adapterKey` set. Pure data assertions, no DB.

## Tests → ACs
- AC1, AC2 (exact counts, idempotent) → **MANUAL-QA**: needs a live Neon DB (`pnpm db:seed` twice, inspect row counts). Not unit-testable without a live resource per AGENTS.md.
- AC3 (reads `DATABASE_URL` from env, nothing committed) → code review: `seed.ts`/CLI never hardcodes a connection string; `getDb()` already throws `MissingDatabaseUrlError` if unset (US-003).
- AC4 → `lib/db/seed-data.test.ts`.
- AC5 → `pnpm test && pnpm lint && pnpm build` (build must stay green with no `DATABASE_URL` set, since `scripts/db-seed.ts` is never imported by app code).

## Boundary
No UI, no ICBETNETF, no report/value tables touched.
