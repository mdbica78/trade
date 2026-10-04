## QA run 1 — 2026-10-03 00:19
Verdict: BLOCKED
Machine checks: 5/8   Left for the user: 3

| # | Check (source) | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | Frozen dependency install (US-040-qa.md #1) | AUTO | PASS | `NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt pnpm install --force --frozen-lockfile` → 0 → `repaired/recreated 722 package links`; TLS verification remained enabled. |
| 2 | Focused US-040 schema/crypto/config/provider/action/UI/privacy suite (US-040-qa.md #2) | AUTO | PASS | `pnpm test lib/db/schema.test.ts test/helpers/pglite.migrations.test.ts lib/health.test.ts app/health/page.schema.pglite.test.tsx lib/ai/key-status.test.ts lib/ai/key-store.test.ts lib/ai/key-store.pglite.test.ts lib/config/ai-keys.test.ts lib/config/ai-keys.pglite.test.ts lib/ai/provider-deps.test.ts lib/ai/provider-deps.interchange.test.ts lib/ai/provider-deps.pglite.test.ts lib/ai/chat.test.ts lib/ai/chat.pglite.test.ts lib/config/boundaries.test.ts app/admin/ai/actions.test.ts app/admin/ai/result-messages.test.ts app/admin/ai/page.test.tsx components/admin/AiSettingsAdmin.test.tsx app/admin/layout.test.tsx app/chat/page.test.tsx lib/ai/boundaries.test.ts app/actions.boundary.test.ts test/data-model-doc.test.ts test/readme-deployment.test.ts lib/ai/env-example.test.ts` → 0 → `26 files / 291 tests passed`. |
| 3 | TypeScript typecheck (US-040-qa.md #1) | AUTO | PASS | `pnpm typecheck` → 0 → `tsc --noEmit` completed without errors. |
| 4 | Lint (US-040-qa.md #1) | AUTO | PASS | `pnpm lint` → 0 → `0 errors, 10 warnings`. |
| 5 | Full regression suite (US-040-qa.md #1) | AUTO | BLOCKED | `env -u DATABASE_URL -u CRON_SECRET -u AI_KEY_MASTER_KEY -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY pnpm exec vitest run --maxWorkers=2` → 1 → `ERR_MODULE_NOT_FOUND: Cannot find package '@vitest/utils'`; the earlier `pnpm test` also exited 1 without producing a final Vitest summary. |
| 6 | Offline production build (US-040-qa.md #1) | AUTO | BLOCKED | `env -u DATABASE_URL -u CRON_SECRET -u AI_KEY_MASTER_KEY -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY pnpm build` → 127 → migration runner correctly printed `migrate-on-deploy: skipped (not a production build)`, then `next` failed because `next/dist/bin/next` was not found. |
| 7 | No-database `/admin/ai` and `/chat` route checks; noindex (US-040-qa.md #3) | AUTO | BLOCKED | `env -u DATABASE_URL -u CRON_SECRET -u AI_KEY_MASTER_KEY -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY bash scripts/claude/qa-serve.sh start` → 3 → build failed loading `next.config.ts`: `Cannot find module '@parcel/watcher'`; no route responses or metadata were inspected. |
| 8 | Stop local QA server after attempt (US-040-qa.md #3) | AUTO | PASS | `bash scripts/claude/qa-serve.sh stop` → 0 → `QA server stopped.` |

### For the user (only what a machine couldn't settle)
- [JUDGMENT] Confirm the agent-drafted AC1–AC9 in `backlog/stories/US-040.md` at demo review.
- [LIVE-DB] After the user's normal push, confirm the production build log applied `0003_ai_provider_keys.sql` and `/health` no longer lists the table as missing. QA did not access Neon or run a migration.
- [LIVE-ACCOUNT] The post-push UI/key lifecycle checklist remains for the PO only if they elect to configure a real provider key. QA did not enter or inspect any real key.

### Failures (if any)
- No product failure was established. Checks 5–7 are blocked by missing local dependency files/modules (`@vitest/utils`, Next's executable, and `@parcel/watcher`). Repair/reinstall the shared WSL dependency tree, then rerun the full suite, offline build, and RO/EN route checks before recording QA PASS.

No real database, provider, Vercel resource, migration, or secret was accessed. No application code or tests were modified. No git or credential-file command was run.
