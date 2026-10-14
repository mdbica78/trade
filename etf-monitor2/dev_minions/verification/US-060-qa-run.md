# US-060 — QA run 1

Date: 2026-10-12. Initial board state: Awaiting QA; no prior QA-run file.

## Result

**BLOCKED — no final QA verdict.** Focused tests and shared gates passed, but the shared tree
changed during QA while US-064 cron work was active. The QA server build then failed on
unresolved cron imports, preventing the local RO/EN admin-page interaction checks. No
US-060-specific failure was established.

## Evidence

- Before this story, `bash scripts/claude/dev-loop-status.sh` reported
  `RUNNING 2026-10-12 15:13:10 — run 1`.
- Focused command:
  `wsl bash -lc 'cd /mnt/c/_mystaff/myG/trade/etf-monitor2 && bash scripts/claude/dev-loop-status.sh; env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY corepack pnpm exec vitest run components/admin/EtfAdmin.test.tsx app/admin/etfs/page.test.tsx app/admin/etfs/actions.test.ts app/admin/etfs/result-messages.test.ts lib/extraction/discovery.test.ts lib/config/detect-adapter.test.ts lib/config/etfs.pglite.test.ts lib/ai/chat.pglite.test.ts'`
  — exit 0; `Test Files 8 passed (8)`, `Tests 136 passed (136)`.
- Shared checks used the exact command prefix
  `wsl bash -lc 'cd /mnt/c/_mystaff/myG/trade/etf-monitor2 && env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY corepack pnpm`
  followed by the named script and a closing single quote:
  - `typecheck'` — exit 0; `$ tsc --noEmit`.
  - `lint'` — exit 0; `✖ 21 problems (0 errors, 21 warnings)`.
  - `test'` — exit 0; `Test Files 265 passed (265)`, `Tests 2905 passed (2905)`.
  - `build'` — exit 0; printed
    `migrate-on-deploy: skipped (not a production build)` and generated all 12 routes.
- Runtime check:
  `wsl bash -lc 'cd /mnt/c/_mystaff/myG/trade/etf-monitor2 && bash scripts/claude/qa-serve.sh start'`
  — exit 3; build failed with TS2305 because `app/admin/cron/page.tsx` imports missing
  `effectiveSchedule` and `parseDailySchedule`, and `lib/config/cron.pglite.test.ts` imports
  missing `effectiveSchedule`.
  `wsl bash -lc 'cd /mnt/c/_mystaff/myG/trade/etf-monitor2 && bash scripts/claude/qa-serve.sh stop'`
  — exit 0; `QA server stopped.`

## Remaining checks

- **AUTO-PARTIAL, blocked:** `/admin/etfs` RO/EN selection, actions, no-JavaScript GET
  behavior, themes, keyboard, and narrow viewport could not be exercised in the browser.
- **LIVE-DB:** add/re-detect persistence and the stored BVB-derived name require the user's
  database. Fixture-backed parser tests passed; this does not prove live persistence.
- **LIVE-BVB/LIVE-DB:** no real add/re-detect operation was attempted.

## Exact unblock

After US-064's cron refactor is complete and the shared QA server builds, rerun the local
RO/EN browser checks. The add/re-detect persistence cases remain user-only because QA must
not access Neon. No status-board row was changed; no US-060 failure was found.

## QA run 2 — 2026-10-13 11:52
Verdict: PASS
Machine checks: 4/4   Left for the user: 2

| # | Check (source) | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | Current symbol-only add, BVB-name fallback, re-detect, admin page and chat selectors (AC1–AC5) | AUTO | PASS | `wsl bash -lc 'cd /mnt/c/_mystaff/myG/trade/etf-monitor2 && env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u VERCEL_DEPLOY_HOOK_URL -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY corepack pnpm exec vitest run components/admin/EtfAdmin.test.tsx app/admin/etfs/page.test.tsx app/admin/etfs/actions.test.ts app/admin/etfs/result-messages.test.ts lib/extraction/discovery.test.ts lib/config/detect-adapter.test.ts lib/config/etfs.pglite.test.ts lib/ai/chat.pglite.test.ts'` → 0 → `Test Files 8 passed (8); Tests 136 passed (136)`. |
| 2 | Shared current-tree gates (AC6) | AUTO | PASS | With the same `wsl bash -lc 'cd /mnt/c/_mystaff/myG/trade/etf-monitor2 && env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u VERCEL_DEPLOY_HOOK_URL -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY corepack pnpm` prefix: `typecheck` → 0; `lint` → 0 (`0 errors, 21 warnings`); `test` → 0 (`267 files / 2967 tests passed`); `build` → 0 (`migrate-on-deploy: skipped`, all 12 routes generated). |
| 3 | Romanian `/admin/etfs` no-database route | AUTO | PASS | `wsl bash -lc 'cd /mnt/c/_mystaff/myG/trade/etf-monitor2 && bash scripts/claude/qa-serve.sh get /admin/etfs'` → 0 → `STATUS 200`; localized administration shell and safe Romanian load-error rendered. |
| 4 | English `/admin/etfs` no-database route | AUTO | PASS | `wsl bash -lc 'cd /mnt/c/_mystaff/myG/trade/etf-monitor2 && bash scripts/claude/qa-serve.sh get /admin/etfs NEXT_LOCALE=en'` → 0 → `STATUS 200`; localized administration shell and safe English load-error rendered. |

### For the user
- [LIVE-DB/LIVE-BVB] On the deployed app, select an ETF without JavaScript, verify the query-string selection and selected-only actions, then add a real BVB symbol and confirm the saved name matches BVB. Re-detect with a valid name and with a failure/absent name; confirm refresh versus preservation. Do not send or paste credentials into chat.
- [JUDGMENT] With populated settings, check both themes, keyboard focus/order, and the 375px layout; the database-free page only renders the safe load-error state, so these populated-page interactions were not visible in this QA run.

The no-database QA server built and served the app successfully, then was stopped. No live BVB mutation, Neon/database access, migration, deployment, or Git command was used.
