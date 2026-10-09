# US-006 plan: Deploy to Vercel with a health-check page

Simple story (6 ACs, no schema/adapter/AI/cron/auth change) — planned directly, no story-planner.
`Health.*` and `Nav.health` message keys already exist (seeded by US-004); `Nav.health` link is added to `AppHeader.tsx`.

## Files
- `lib/health.ts` (new): `export type HealthStatus = { dbConnected: true; etfCount: number; fieldCatalogCount: number } | { dbConnected: false; error: string }`. `export async function getHealthStatus(db: Db): Promise<HealthStatus>` — runs `db.select({count: count()}).from(etfs)` and same for `fieldCatalog` inside a `try/catch`; on any thrown error returns `{ dbConnected: false, error: String(error) }` (never rethrows).
- `lib/health.test.ts` (new, AC4): mock a `Db`-shaped object (drizzle query builder chain) — one test where the mock resolves counts (success path, asserts the returned counts), one where the mock's query rejects (asserts `dbConnected: false` and the error message is present, not a raw stack). No live DB.
- `app/health/page.tsx` (new): `async`, calls `getHealthStatus(getDb())` **inside its own try/catch** too (defense in depth — `getDb()` itself throws `MissingDatabaseUrlError` if `DATABASE_URL` is unset, which `getHealthStatus` doesn't cover since it takes a `Db`, not a URL). Renders `Health.title`, then either the connected state (`Health.database`: `Health.dbConnected`, `Health.etfCount`: count, `Health.fieldCatalogCount`: count) or the failure state (`Health.dbUnreachable`, plus `Health.dbError` with `{message}` interpolated via `useTranslations`'s `t.rich`/`t()` with values). Also shows `Health.locale`: `Health.localeName[locale]` via `getLocale()`. Always returns 200 (a normal page render, no thrown error, no `notFound()`/`redirect()`), satisfying AC2.
- `components/AppHeader.tsx` (edit): add a `<Link href="/health">{t("Nav.health")}</Link>` next to the existing home link.
- `vercel.json`: only added if a concrete setting is needed (e.g. cron placeholder) — Sprint 1 has no cron yet, so skip it unless `pnpm build` surfaces a real requirement.
- `README.md` (edit): add a "Deployment" section — env vars (`DATABASE_URL`, `CRON_SECRET` reserved for Sprint 3), `pnpm db:migrate` against Neon, `pnpm db:seed`, Vercel project creation + build command, and the manual `/health` check after deploy.

## Tests → ACs
- AC1 (renders with correct counts) → MANUAL-QA: `pnpm dev`, seeded local/Neon DB, open `/health`, compare counts to `pnpm db:seed`'s known seed (3 ETFs, 8 fields).
- AC2 (unreachable DB → 200 + visible failure, not 500) → `lib/health.test.ts`'s failure-path test proves `getHealthStatus` never throws; MANUAL-QA step also confirms visually with an intentionally bad `DATABASE_URL`.
- AC3 (labels switch RO/EN) → reuse pattern from US-004: `app/health/page.test.tsx` renders with `NextIntlClientProvider` in both locales (mocking `getHealthStatus`'s result shape directly, not the DB), asserts the RO/EN label text from the catalogues.
- AC4 → `lib/health.test.ts` (success + failure, mocked client).
- AC5 → reviewer checks README's new section against the story's three required topics.
- AC6 → `pnpm build`.

## Boundary
No cron, no report ingestion, no auth, no live Neon/Vercel calls in tests or implementation.
