# US-061 — QA run 1

Date: 2026-10-12. Initial board state: Awaiting QA; no prior QA-run file.

## Result

**BLOCKED — no final QA verdict.** Focused component/theme tests and shared gates passed.
However, US-064 cron work was active and the subsequent QA-server build failed on unresolved
cron imports, so the required live browser checks could not run. No US-061-specific failure
was established.

## Evidence

- Before this story, `bash scripts/claude/dev-loop-status.sh` reported
  `RUNNING 2026-10-12 15:13:10 — run 1`.
- Focused command:
  `wsl bash -lc 'cd /mnt/c/_mystaff/myG/trade/etf-monitor2 && bash scripts/claude/dev-loop-status.sh; env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY corepack pnpm exec vitest run app/admin/ai/page.test.tsx components/admin/AiSettingsAdmin.test.tsx components/admin/AiSettingsForms.test.tsx components/admin/CustomProvidersAdmin.test.tsx app/globals.contrast.test.ts app/globals.tokens.test.ts'`
  — exit 0; `Test Files 6 passed (6)`, `Tests 57 passed (57)`.
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

- **AUTO-PARTIAL, blocked:** provider switching and key-card correspondence, save/reset behavior,
  collapsed custom-provider forms, keyboard use, themes, 375 px layout, and rendered-page
  key-free inspection could not be exercised in a browser.
- **LIVE-ACCOUNT:** actual provider credentials and saved custom providers are user-owned. No
  key was entered, read, or tested.

## Exact unblock

Complete US-064's cron refactor and restore a successful QA-server build, then rerun the RO/EN
browser checks. User-owned key lifecycle/provider checks remain manual and must use the user's
own account without sharing key values. No status-board row was changed; no US-061 failure
was found.

## QA run 2 — 2026-10-13 11:52
Verdict: PASS
Machine checks: 4/4   Left for the user: 2

| # | Check (source) | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | Current provider-card, custom-provider, theme/contrast selectors (AC1–AC5) | AUTO | PASS | `wsl bash -lc 'cd /mnt/c/_mystaff/myG/trade/etf-monitor2 && env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u VERCEL_DEPLOY_HOOK_URL -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY corepack pnpm exec vitest run app/admin/ai/page.test.tsx components/admin/AiSettingsAdmin.test.tsx components/admin/AiSettingsForms.test.tsx components/admin/CustomProvidersAdmin.test.tsx app/globals.contrast.test.ts app/globals.tokens.test.ts'` → 0 → `Test Files 6 passed (6); Tests 57 passed (57)`. |
| 2 | Shared current-tree gates (AC5) | AUTO | PASS | With the same `wsl bash -lc 'cd /mnt/c/_mystaff/myG/trade/etf-monitor2 && env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u VERCEL_DEPLOY_HOOK_URL -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY corepack pnpm` prefix: `typecheck` → 0; `lint` → 0 (`0 errors, 21 warnings`); `test` → 0 (`267 files / 2967 tests passed`); `build` → 0 (`migrate-on-deploy: skipped`, all 12 routes generated). |
| 3 | Romanian `/admin/ai` no-database route | AUTO | PASS | `wsl bash -lc 'cd /mnt/c/_mystaff/myG/trade/etf-monitor2 && bash scripts/claude/qa-serve.sh get /admin/ai'` → 0 → `STATUS 200`; localized provider selector shell, safe settings load error, and no key values. |
| 4 | English `/admin/ai` no-database route | AUTO | PASS | `wsl bash -lc 'cd /mnt/c/_mystaff/myG/trade/etf-monitor2 && bash scripts/claude/qa-serve.sh get /admin/ai NEXT_LOCALE=en'` → 0 → `STATUS 200`; localized provider selector shell, safe settings load error, and no key values. |

### For the user
- [LIVE-DB] With saved settings, switch between preset providers and verify the selected card/status, provider-specific model, save/reload persistence, and custom-provider card/forms in both locales and themes.
- [LIVE-ACCOUNT] If exercising key lifecycle, use the app's write-only form and the user's own provider account; verify no key value appears in rendered page/source or responses. Do not send or paste any real key into chat.

The no-database page could not render saved-provider/custom-provider states; component and action tests cover those paths. No key value, production database, migration, deployment, or Git command was accessed.
