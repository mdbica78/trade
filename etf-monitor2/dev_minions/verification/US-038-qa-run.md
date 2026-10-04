# US-038 QA run — 2026-10-02

**Verdict: BLOCKED.** The focused chart suite could not complete because the current pnpm installation is missing `@vitest/utils`; the project-wide lint/full-suite gates also encounter in-progress US-040 changes. No US-038 defect was established, but QA cannot claim PASS.

## Acceptance criteria and checks

| # | Check (source) | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | Per-chart selector, type rendering, localStorage identity, single-value labels, gaps, tokens, bilingual labels (AC1–AC7) | AUTO | BLOCKED | `bash -lc 'set -e; pnpm install --frozen-lockfile; env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY pnpm exec vitest run components/chart-type.test.ts components/FieldChart.test.tsx components/FieldChart.palette.test.tsx components/FieldChart.smoke.test.tsx components/EtfDetail.test.tsx components/EtfDetail.chart-types.test.tsx i18n/messages.test.ts lib/monitoring/chart-series.test.ts'` → **1** → `chart-type.test.ts` 5/5, `chart-series.test.ts` 13/13 and `i18n/messages.test.ts` 4/4 passed; Vitest then stopped with `ERR_MODULE_NOT_FOUND: Cannot find package '@vitest/utils'` from the Vitest worker before completing the remaining files. |
| 2 | Typecheck (AC8) | AUTO | PASS | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY bash scripts/claude/predeploy-check.sh'` → **1** overall; its typecheck phase ran `tsc --noEmit` and proceeded to lint, so typecheck exited 0. |
| 3 | Lint and full-suite gate (AC8) | AUTO | BLOCKED | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY bash scripts/claude/predeploy-check.sh'` → **1** at lint; current `components/admin/ProviderKeySaveForm.tsx:33` triggers `react-hooks/refs` in the in-progress US-040 implementation. `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY pnpm test'` → **1**; additionally, US-040 boundary test CB-3 reports `lib/ai/key-store.ts contains sql`, then the worker terminates because `@vitest/utils` is missing. |
| 4 | Offline build / route smoke (AC8) | AUTO | BLOCKED | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY pnpm build'` → **127** → `tsx: not found`. The QA server was not started because the build could not run. |
| 5 | Chart controls, palette, and one-point rendering with populated data (FR8.2) | LIVE-DB / JUDGMENT | NOT RUN | Requires the populated database-backed deployment after the user's push. No live database or deployment was accessed; the shared browser page is not a populated ETF detail chart. |
| 6 | Safe unavailable-database detail page in RO and EN | AUTO-PARTIAL | NOT RUN | `qa-serve.sh` could not be started because the offline build failed; no route result is claimed. |

The focused run completed only three of eight requested test files. `pnpm install --frozen-lockfile` exited 0 immediately before that run, but the Vitest worker still could not resolve the locked `@vitest/utils` package. The earlier dependency-link failures and US-040 gate failures are recorded in `US-048-qa-run.md`. Retry after the shared implementation and local installation are stable.

No code, tests, package manifests, or lockfiles were edited. No database, deployment, Vercel settings, git command, or secret was accessed. Denied or attempted commands: none.
