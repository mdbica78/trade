## QA run 1 — 2026-10-04 23:59
Verdict: BLOCKED
Machine checks: 6/7 (full suite blocked by concurrent US-050 work)   Left for the user: 1

| # | Check (source) | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | Frozen install (QA setup) | AUTO | PASS | `pnpm install --frozen-lockfile` → 0 → `Lockfile is up to date` (observed earlier in this run). |
| 2 | Focused ingestion/extraction/cron/health tests (AC2–AC5) | AUTO | PASS | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u AI_KEY_MASTER_KEY -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY pnpm exec vitest run lib/ingestion/ingest-reads.test.ts lib/ingestion/ingest-etf.test.ts lib/ingestion/ingest-etf.failures.test.ts lib/ingestion/ingest-filing.test.ts lib/ingestion/ingest-filing.pglite.test.ts lib/ingestion/store.test.ts lib/ingestion/store.pglite.test.ts lib/extraction/discovery.test.ts lib/extraction/discovery.filing.test.ts lib/extraction/fixtures.test.ts lib/extraction/adapters/report-date-errors.test.ts lib/cron/fetch-detail.test.ts lib/cron/daily-handler.test.ts lib/cron/daily-job.test.ts lib/health.test.ts lib/health.pglite.test.ts'` → 0 (2026-10-05 00:01) → `Test Files 16 passed (16)`, `Tests 283 passed (283)`. An earlier 16-file selection passed 246 tests but its exact selector was not retained, so it is not used as proof. |
| 3 | Typecheck (qa.md #1, AC1) | AUTO | PASS | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u AI_KEY_MASTER_KEY -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY pnpm typecheck'` → 0 → `$ tsc --noEmit`. |
| 4 | Lint (qa.md #2, AC1) | AUTO | PASS | Same `bash -lc 'env -u ... pnpm lint'` variable-removal prefix as #3 → 0 → `✖ 12 problems (0 errors, 12 warnings)`; two current warnings occur in `lib/ingestion/ingest-etf.ts`. |
| 5 | Full regression (qa.md #3, AC1) | AUTO | BLOCKED | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u AI_KEY_MASTER_KEY -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY pnpm test'` → 1 → `Test Files 2 failed \| 218 passed (220)`, `Tests 3 failed \| 2229 passed (2232)`. All failures are newly added **US-050 B3/B5** tests in `lib/monitoring/home-display.pglite.test.ts` (HD-H5, HD-H6) and `lib/monitoring/home.pglite.test.ts` (AC2/US-050 B3), while US-050 is in progress. Do not attribute these failures to US-049. Re-run after US-050 stabilizes. |
| 6 | Offline build (qa.md #4, AC1) | AUTO | PASS | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u AI_KEY_MASTER_KEY -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY pnpm build'` → 0 → `migrate-on-deploy: skipped (not a production build)`, `✓ Compiled successfully`, 12 dynamic routes including `/`, `/chat`, `/etf/[symbol]`, `/health`. |
| 7 | Safe RO/EN no-DB home, ETF detail, admin and chat (qa.md #5, AC1) | AUTO | PASS | `bash -lc 'bash scripts/claude/qa-serve.sh start'` → 0 → `QA server ready on http://127.0.0.1:3100 (database: none)`; `foreach ($locale in @('ro','en')) { foreach ($route in @('/','/etf/BTBETRETF','/admin','/admin/etfs','/admin/ai','/admin/cron','/admin/operations','/chat')) { $out = & bash -lc "bash scripts/claude/qa-serve.sh get $route NEXT_LOCALE=$locale"; $exit = $LASTEXITCODE; Write-Output "$locale $route exit=$exit"; $out \| ForEach-Object { $_.Substring(0,[Math]::Min(360,$_.Length)) } } }` → 0, all 16 routes `STATUS 200`; RO `/` says `Datele nu au putut fi încărcate`, EN `/` says `Could not load the data`; admin/ETF show matching translated no-DB states and chat shows translated instructions. `bash -lc 'bash scripts/claude/qa-serve.sh stop'` → 0 → `QA server stopped.` Initial plain `bash scripts/claude/qa-serve.sh start` → 4 (`env: 'pnpm': No such file or directory` in non-login shell); retry used the WSL login-shell toolchain, without altering project files. |

### For the user
- [JUDGMENT] Confirm agent-drafted AC1–AC6 at the demo (story and QA checklist request PO confirmation). No production resources were touched.
- Optional post-deployment observation of sanitized failed-fetch details (qa.md #6) is not a release gate; offline fetch tests passed in the focused suite.

### Blocker
- A concurrent, in-progress US-050 change adds three failing monitoring tests to the shared full suite. A current all-green full regression is required before US-049 can receive QA PASS. Re-run this gate when US-050 stabilizes; do not reopen US-049 for unrelated US-050 expectations.

Files changed by QA: `dev_minions/verification/US-049-qa-run.md`, US-049 row of `dev_minions/status.md`, and the `## QA/Deploy log (Codex)` append in `dev_minions/HANDOVER.md`.
Denied or attempted commands: none.

## QA run 2 — 2026-10-05 00:36
Verdict: PASS
Machine checks: 7/7   Left for the user: 1

The previous US-050 B3/B5 failures are gone in the current worktree. This round rechecked
the shared gates and all RO/EN routes; the 16-file US-049-focused selector passed in run 1
and was not re-run after the monitoring changes (see its exact command and 283-test result above).

| # | Check (source) | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | Frozen install (setup) | AUTO | PASS | `pnpm install --frozen-lockfile` → 0 → `Lockfile is up to date` (run 1, not re-run this round; no manifest change). |
| 2 | Focused ingestion/extraction/cron/health (AC2–AC5) | AUTO | PASS | Run 1 exact 16-file `pnpm exec vitest run` selector → 0, `Test Files 16 passed (16)`, `Tests 283 passed (283)`; not re-run this round. |
| 3 | Typecheck (qa.md #1, AC1) | AUTO | PASS | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u AI_KEY_MASTER_KEY -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY pnpm typecheck'` → 0 → `$ tsc --noEmit`. |
| 4 | Lint (qa.md #2, AC1) | AUTO | PASS | Same `bash -lc 'env -u ... pnpm lint'` variable-removal prefix as #3 → 0 → `✖ 11 problems (0 errors, 11 warnings)`. |
| 5 | Full regression (qa.md #3, AC1) | AUTO | PASS | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u AI_KEY_MASTER_KEY -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY pnpm test'` → 0 → `Test Files 220 passed (220)`, `Tests 2232 passed (2232)`. An earlier retry with this same command → 1 (`1 failed, 2231 passed`): existing US-030 `app/chat/add-paths.pglite.test.ts` timed out in `beforeEach` at 30 seconds under full-suite concurrency; isolated `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u AI_KEY_MASTER_KEY -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY pnpm exec vitest run app/chat/add-paths.pglite.test.ts'` → 0, `1 file/1 test passed` in 12 seconds. No assertion failure; clean full rerun establishes current pass. |
| 6 | Offline build (qa.md #4, AC1) | AUTO | PASS | `bash -lc 'env -u DATABASE_URL -u CRON_SECRET -u AI_KEY_MASTER_KEY -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY pnpm build'` → 0 → `migrate-on-deploy: skipped (not a production build)`, `✓ Compiled successfully in 9.9s`, 12 dynamic routes. |
| 7 | RO/EN no-DB routes (qa.md #5, AC1) | AUTO | PASS | `bash -lc 'bash scripts/claude/qa-serve.sh start'` → 0 → `QA server ready ... (database: none)`; same PowerShell `foreach ($locale ... $route ...)` command as run 1 (output clipped to 190 characters per visible-text line) → 0, each of 16 `/`, `/etf/BTBETRETF`, `/admin`, `/admin/etfs`, `/admin/ai`, `/admin/cron`, `/admin/operations`, `/chat` requests `exit=0`, `STATUS 200`, RO and EN headings and safe no-DB messages. `bash -lc 'bash scripts/claude/qa-serve.sh stop'` → 0 → `QA server stopped.` |

### For the user
- [JUDGMENT] Confirm the agent-drafted AC1–AC6 at the demo. Optional live confirmation of sanitized fetch-error details remains non-gating; no live resource or key was used in QA.

Files changed by QA: this report, US-049 Story board row, and an append to the HANDOVER QA log.
Denied or attempted commands: none.
