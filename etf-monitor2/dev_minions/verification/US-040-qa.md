# US-040 QA checklist — encrypted provider keys

Development round 1: independent review PASS (`US-040-review.md`); independent
tests PASS (`US-040-tests.md`). Reviewer inspected AC1–AC8 as MET and left AC9
to the tester; tester reports AC1–AC9 MET (focused 26 files/291 tests,
typecheck, lint 0 errors/9 warnings, full 203 files/2046 tests, offline build
12 routes). Reviewer note: a persisted `cron_derived` row lifecycle test would
provide more direct coverage; it is non-blocking. No production migration or
provider call was made by the development checks.

## Codex offline checks

1. With `DATABASE_URL`, `CRON_SECRET`, `AI_KEY_MASTER_KEY`, `VERCEL_ENV` and
   all provider-key variables absent from the process (do not display their
   values), run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`,
   `pnpm test`, `pnpm build`. Expect exit 0 throughout; the migration runner
   must say it skipped a non-production build. Never simulate production
   deployment or migrate a live database.
2. Run the focused files enumerated in `US-040-tests.md` with `pnpm test
   <files>`; expect the crypto, PGlite, provider-wiring, actions, UI, schema,
   health and boundary checks to pass. Tests use obvious fake material only.
   Do not read, print, select or seed real `ai_provider_keys` rows.
3. Inspect the locally served `/admin/ai` and `/chat` in RO and EN with
   deliberately absent database/key configuration. Expect translated safe
   states, disabled storage note without an input, existing AI-settings
   display with the provider key unset, and no raw error or key material. Check `/admin`
   and `/chat` noindex metadata. Stop the local server after the check.

## MANUAL-QA after the user's normal push (no prerequisite for development)

4. In the existing production deployment's build logs, check that
   `0003_ai_provider_keys.sql` was applied by the deploy migration path
   (without printing a connection string or a row). Open
   `https://etf-monitor2.vercel.app/health`: the required table should not
   appear in the missing-schema list. If it does, report the failure; do not
   run a migration manually against Neon.
5. In `/admin/ai`, for each configured provider, verify that only
   `stored` / `environment` / `none` and storage availability are shown;
   never submit a real key in chat, a test, or an agent transcript. The PO
   may enter a real key **only in the deployed app's password field**:
   confirm save shows `stored`, the field is blank after save and reload,
   replacement succeeds, and clear restores `environment` or `none` without
   exposing any key. Never inspect real table rows or logs containing key
   material. Test normal provider use via `/chat` only if the PO has elected
   to configure a key; do not spend provider quota solely to gate the story.
6. Where the deployed instance lacks valid storage material, confirm the
   password form is absent, the bilingual disabled note is shown, and any
   existing environment-provided key remains usable. Do not change Vercel
   settings or request a secret from the user to create this condition.
   Confirm `/admin/ai` still renders safely if the table is missing during
   rollout; `/health` should name that table without returning row contents.
7. Confirm the action cannot redirect a provider to a user-supplied
   `baseUrl`; application tests cover the injected-form-field case. Observe
   that `/admin` and `/chat` are noindex. Same-origin enforcement is Next.js
   framework behavior and was not independently exercised over HTTP by the
   offline tester; record any live verification separately, without
   bypassing framework protections.

PO to confirm the agent-drafted AC1–AC9 at demo (FR16 / FR8.1). No login,
rate limiting, live migration, account creation, or new key entry is required
to close the development loop.

## Files changed

- Plan/process: `dev_minions/verification/US-040-plan.md`,
  `dev_minions/verification/US-040-review.md`,
  `dev_minions/verification/US-040-tests.md`,
  `dev_minions/verification/US-040-qa.md`, `dev_minions/HANDOVER.md`,
  `dev_minions/status.md`.
- Schema/migration/health: `lib/db/schema.ts`, `lib/db/schema.test.ts`,
  `test/helpers/pglite.migrations.test.ts`, `lib/health.test.ts`,
  `app/health/page.schema.pglite.test.tsx`,
  `drizzle/0003_ai_provider_keys.sql`, `drizzle/meta/0003_snapshot.json`,
  `drizzle/meta/_journal.json`.
- Key handling/wiring: `lib/ai/key-status.ts`, `lib/ai/key-status.test.ts`,
  `lib/ai/key-store.ts`, `lib/ai/key-store.test.ts`,
  `lib/ai/key-store.pglite.test.ts`, `lib/config/ai-keys.ts`,
  `lib/config/ai-keys.test.ts`, `lib/config/ai-keys.pglite.test.ts`,
  `lib/ai/provider-deps.ts`, `lib/ai/provider-deps.test.ts`,
  `lib/ai/provider-deps.interchange.test.ts`,
  `lib/ai/provider-deps.pglite.test.ts`, `lib/ai/chat.test.ts`,
  `lib/ai/chat.pglite.test.ts`, `lib/ai/settings-deps.ts`,
  `lib/ai/boundaries.test.ts`, `lib/ai/capabilities/boundaries.test.ts`,
  `lib/config/boundaries.test.ts`.
- Action/UI/localization: `app/admin/ai/actions.ts`,
  `app/admin/ai/actions.test.ts`, `app/admin/ai/result-messages.ts`,
  `app/admin/ai/result-messages.test.ts`, `app/admin/ai/page.tsx`,
  `app/admin/ai/page.test.tsx`, `components/admin/AiSettingsAdmin.tsx`,
  `components/admin/AiSettingsAdmin.test.tsx`,
  `components/admin/ProviderKeySaveForm.tsx`, `app/admin/layout.tsx`,
  `app/admin/layout.test.tsx`, `app/chat/page.tsx`,
  `app/chat/page.test.tsx`, `messages/en.json`, `messages/ro.json`.
- Documentation/guards: `.env.example`, `README.md`,
  `dev_minions/architecture/data-model.md`, `test/data-model-doc.test.ts`,
  `test/readme-deployment.test.ts`, `lib/ai/env-example.test.ts`.

No dependency manifest or lockfile change.
