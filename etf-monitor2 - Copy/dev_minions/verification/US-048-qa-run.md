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
