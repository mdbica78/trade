## QA run 1 — 2026-09-28 22:05


### Post-push deployment smoke — 2026-09-28 22:08

- [AUTO-PARTIAL] `curl -sS -L -o /dev/null -w "%{http_code}" --max-time 20 https://etf-monitor2.vercel.app/health` → exit 0 → `200`. The endpoint is reachable after the user’s push. This status-only check cannot establish the Vercel migration-log line, connected database state, or home-page data; those remain the live checks above.
Verdict: PASS

Machine checks: 2/2 AUTO passed. Left for the user: 2 post-push observations.

| # | Check (source) | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | Mocked production migration paths, safe output, destructive-migration guard, PGlite journal application, docs and health wording (AC1–AC7) | AUTO | PASS | `env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY pnpm exec vitest run lib/deploy/migrate.test.ts scripts/migrate-on-deploy.build.test.ts test/helpers/pglite.migrations.test.ts test/readme-deployment.test.ts app/health/page.test.tsx` → 0 → `Test Files 5 passed (5)`, `Tests 32 passed (32)`; PM-4 confirms every schema table exists after journal-order migration. |
| 2 | Offline production-equivalent gate and local migration-script skip (AC4, AC8) | AUTO | PASS | `env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY bash scripts/claude/predeploy-check.sh` → 0 → `migrate-on-deploy: skipped (not a production build)`; lint `0 errors, 9 warnings`; route table includes `ƒ /health`; regression `Test Files 166 passed (166)`, `Tests 1771 passed (1771)`; final `PREDEPLOY: PASS — typecheck, lint, build and tests are green. Safe to commit and push.` |

### For the user (only what a machine could not settle)

- [LIVE-ACCOUNT] After your normal production push, Vercel’s build log should show `migrate-on-deploy: migrations applied` (or the explicit no-`DATABASE_URL` warning), never a URL or driver message.
- [LIVE-DB] After that deploy, confirm `/health` has no stale-schema line and the home page loads rather than showing the generic load error.
- [JUDGMENT] Confirm the agent-drafted AC1–AC8 wording remains the desired push-only migration policy.

### User production confirmation — 2026-09-28

- [LIVE-ACCOUNT/LIVE-DB] User confirmed the production home page and Vercel logs are OK after the push. This closes the post-push observations for this QA run; formal story acceptance remains with the user.

## QA run 2 — 2026-10-02 (Sprint 9 audit C1 fix)

**Verdict: BLOCKED — shared project gates are affected by the in-progress US-040 implementation and the local dependency links became unavailable. No US-048-specific defect was found in its focused checks.**

| # | Check (source) | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | Migration-guard regressions, production-script build guard, journal-order migrations and deployment docs (AC1–AC7; reopened AC5) | AUTO | PASS | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY pnpm exec vitest run lib/deploy/migrate.test.ts scripts/migrate-on-deploy.build.test.ts test/helpers/pglite.migrations.test.ts test/readme-deployment.test.ts'` → **0** → `Test Files 4 passed (4)`, `Tests 47 passed (47)`. The updated migration guard file ran all 37 tests, including the audit regression; PGlite journal tests ran 6 tests.
| 2 | Offline project gates (AC8) | AUTO | BLOCKED | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY bash scripts/claude/predeploy-check.sh'` → **1** → typecheck proceeded; lint stopped at `ProviderKeySaveForm.tsx:33` with `react-hooks/refs` (the active US-040 implementation). After `pnpm install --force --frozen-lockfile`, `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY pnpm lint'` → **1** → `1 error, 9 warnings`, same US-040 file/line. This is not attributed to US-048. |
| 3 | Full offline regression suite (AC8) | AUTO | BLOCKED | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY pnpm test'` → **1** → `lib/ai/capabilities/boundaries.test.ts` CB-3 fails because `lib/ai/key-store.ts` contains `sql`; the run then terminates with `ERR_MODULE_NOT_FOUND` for `@vitest/utils`. Both are outside US-048; the first is in-progress US-040 scope. |
| 4 | Offline production build / migration skip (AC4, AC8) | AUTO | BLOCKED | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY pnpm build'` → **127** → `tsx: not found`. The local pnpm command links were absent after the regression run; no production build or migration was run. |
| 5 | Production Vercel migration log and live `/health`/home observations | LIVE-ACCOUNT / LIVE-DB | NOT RUN | No deployment, Vercel settings, or live database access performed. The previous user confirmation remains recorded above for the original deployment, not for this audit-fix revision. |

`pnpm install --frozen-lockfile` and `pnpm install --force --frozen-lockfile` each exited 0 during diagnosis; no manifest or lockfile changes were requested. Project typecheck passed in the first predeploy run before lint stopped it. Re-run this QA after US-040 is complete and the local dependency installation is stable. No code or tests were edited. Denied or attempted commands: none.
