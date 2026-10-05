## QA run 1 — 2026-10-04 18:05
Verdict: BLOCKED
Machine checks: 7/8   Left for the user: 3

| # | Check (source) | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | Frozen install (qa.md #1) | AUTO | PASS | `pnpm install --frozen-lockfile` (Windows installed pnpm.cmd, eight DB/deploy/key variables removed) → 0 → `Lockfile is up to date, resolution step is skipped`; `Done in 1.1s using pnpm v12.5.1`. |
| 2 | Focused provider/model/action/settings/UI suite (qa.md #2; AC1–AC5) | AUTO | PASS | `pnpm test lib/ai/provider-catalog.test.ts lib/ai/providers/registry.test.ts lib/ai/providers/gemini.test.ts lib/ai/providers/groq.test.ts lib/config/ai-settings.test.ts lib/config/ai-settings.pglite.test.ts components/admin/AiProviderModelFields.test.tsx components/admin/AiSettingsAdmin.test.tsx app/admin/ai/page.test.tsx app/admin/ai/actions.test.ts` (eight variables removed) → 0 → `Test Files 10 passed (10); Tests 84 passed (84)`. |
| 3 | Typecheck (qa.md #1) | AUTO | PASS | `pnpm typecheck` (eight variables removed) → 0 → `$ tsc --noEmit`. |
| 4 | Lint (qa.md #1) | AUTO | PASS | `pnpm lint` (eight variables removed) → 0 → `✖ 9 problems (0 errors, 9 warnings)`. |
| 5 | Full suite (qa.md #1) | AUTO | PASS | `pnpm test` (eight variables removed) → 0 → `Test Files 214 passed (214); Tests 2203 passed (2203)`. |
| 6 | Offline build (qa.md #1) | AUTO | PASS | `pnpm build` (eight variables removed) → 0 → `migrate-on-deploy: skipped (not a production build)`; `✓ Compiled successfully`; 12 dynamic routes including `/admin/ai`. No migration was run. |
| 7 | RO/EN no-database page and fixed roster/key-free state (qa.md #3; AC1, AC4) | AUTO-PARTIAL | PASS | `bash -lc 'bash scripts/claude/qa-serve.sh start'` (eight variables removed) → 0 → `QA server ready ... (database: none)`; `bash -lc 'bash scripts/claude/qa-serve.sh get /admin/ai'` → 0 → `STATUS 200`, RO `Datele nu au putut fi încărcate`, Gemini/Groq statuses `nesetată`; `bash -lc 'bash scripts/claude/qa-serve.sh get /admin/ai NEXT_LOCALE=en'` → 0 → `STATUS 200`, EN `Could not load the data`, Gemini/Groq statuses `not set`. Browser on the served page: `meta[name=robots]` = `noindex, nofollow`, URL inputs 0, password inputs 0. `bash -lc 'bash scripts/claude/qa-serve.sh stop'` → 0 → `QA server stopped.` |
| 8 | Switch Gemini → Groq and observe suggestions in running page (qa.md #3; AC3) | AUTO-PARTIAL | BLOCKED | Browser snapshot of `http://127.0.0.1:3100/admin/ai` showed an AI-settings load-error alert under intentionally absent `DATABASE_URL`. Browser locator query for `select[name="provider"]` returned `0`; with no selector rendered, there was nothing to click. Component/page offline tests passed but are not evidence of the live interaction. |

### For the user (only what a machine couldn't settle)
- [JUDGMENT] Confirm the drafted AC1–AC5 and whether Sprint 10 D-1 should add named providers beyond Gemini/Groq; static suggestions do not guarantee a provider supports a model.
- [LIVE-DB] After the normal push, choose both presets on `/admin/ai` and verify suggestions update, free-text model remains editable, saved provider/model survives reload, and translated validation errors do not mutate settings. The no-database QA instance could not render the form.
- [LIVE-ACCOUNT] Do not enter a real provider key into chat, tests or an agent transcript. Provider endpoints/keys were exercised only by mocks, not live calls.

### Failures (if any)
- No confirmed product defect. Check #8 was blocked by the prescribed no-database local server state; the form requires loaded settings. It must be observed in an allowed database-backed environment or with a dedicated safe fixture; QA did not access Neon or alter code/tests.

No git command, real database, provider call, credential file or secret value was accessed. No implementation or tests edited.
