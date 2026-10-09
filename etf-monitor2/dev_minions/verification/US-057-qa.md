# US-057 QA checklist: Custom OpenAI-compatible provider with a URL-bound key

Round 1: independent review/tests PASS (`US-057-review.md`, `US-057-tests.md`).
Round 2 after QA reopen: independent review/tests PASS; both QA findings are addressed. The
missing-database custom-provider read is covered by PDX-8 and PA-C2; shared chat regression
changes pass focused tests and the full current suite. Reviewer notes the accepted single-admin
concurrent add-limit race (plan T-7) and absent file-specific MG-3 assertion; see the Round 2
verdicts for evidence and limitations.

## Offline gates (already run and PASS; Codex should reconfirm)
1. `pnpm typecheck` → 0 errors.
2. `pnpm lint` → 0 errors, 23 warnings (current baseline).
3. `pnpm test` → 259 files / 2798 tests, all green.
4. `pnpm build` (offline) → 12 dynamic routes, `migrate-on-deploy: skipped`.
5. `bash scripts/claude/predeploy-check.sh` → PASS.
6. `env -u DATABASE_URL pnpm db:generate` → "No schema changes, nothing to migrate" (confirms
   `drizzle/0005_ai_custom_providers.sql`/snapshot match `schema.ts`).

All six run with `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `AI_KEY_MASTER_KEY` and every
`*_API_KEY` unset.

## Local no-database route check (Codex QA should reconfirm)
Visit `/admin/ai` in both `en` and `ro` without `DATABASE_URL`. Each request should return HTTP
200 with its localized safe settings-load error, and the rest of the page should render. This
specifically rechecks the QA-reopened custom-provider loader path (PDX-8 / PA-C2). The
**Test connection** button must be absent while settings are unavailable.

## Live/manual checks (from the plan §1, MANUAL-QA — needs the deployed app and a real key)
- **M-1** After the push, `/health` shows no missing-table line (the deploy applied
  `0005_ai_custom_providers`, DEC-023). This is an observation, not a step.
- **M-2** On `/admin/ai` → "Your own providers": add `Groq via custom` with address
  `https://api.groq.com/openai/v1`. Save a real Groq key in that provider's key form. In the
  provider selector choose `Groq via custom`, model `openai/gpt-oss-120b`, Save, then
  **Test connection** → expect "Connection OK". Then `/chat` "add ETF XYZ" works (sanity check).
- **M-3** Edit the address to `https://api.groq.com/openai/v2`. Expect: the page says the stored
  key was removed, the key status shows "No key", and Test connection gives `no_api_key`. Put the
  address back: the key is still gone (enter it again).
- **M-4** Try addresses `http://…`, `https://127.0.0.1`, `https://localhost`, `https://x.internal`,
  and one with `?a=1`: each is refused with the "invalid address" message. Add five providers; the
  sixth is refused (limit message) and the add form is replaced by the limit note.
- **M-5** Delete the provider: its row and key disappear. If it was the active provider, the
  provider card shows the existing "stored provider is no longer in the supported list" notice and
  the chat says no provider is configured correctly (D-2 default).

## PO to confirm (isolated defaults shipped, D-1/D-2/D-3 — plan §6)
- D-1: no uniqueness rule for custom-provider names (a name can duplicate a preset or another
  custom provider).
- D-2: deleting the currently-selected custom provider leaves `settings` untouched (existing
  "stored provider is no longer in the supported list" notice applies; no auto-clear).
- D-3: "Your own providers" section wording/placement and the selector showing the custom name as
  typed with no model suggestions, exactly as drafted in `components/admin/CustomProvidersAdmin.tsx`
  and the `Admin.ai.custom*`/`Admin.messages.customProvider*` message keys.

## Files changed (US-057)
- new (source): `lib/config/custom-providers.ts`, `components/admin/CustomProvidersAdmin.tsx`
- new (migration, generated): `drizzle/0005_ai_custom_providers.sql`, `drizzle/meta/0005_snapshot.json`
- changed (source): `lib/db/schema.ts`, `drizzle/meta/_journal.json`, `lib/ai/key-store.ts`,
  `lib/config/ai-keys.ts`, `lib/config/ai-settings.ts`, `lib/ai/providers/resolve.ts`,
  `lib/ai/providers/openai-compatible.ts`, `lib/ai/provider-deps.ts`, `lib/ai/settings-deps.ts`,
  `app/admin/ai/result-messages.ts`, `app/admin/ai/actions.ts`, `app/admin/ai/page.tsx`,
  `messages/en.json`, `messages/ro.json`
- changed (docs): `dev_minions/architecture/data-model.md`, `README.md`
- new (tests): `lib/config/custom-providers.test.ts`, `lib/config/custom-providers.pglite.test.ts`,
  `lib/config/custom-providers.boundary.test.ts`, `lib/config/ai-keys.custom.test.ts`,
  `lib/config/ai-keys.custom.pglite.test.ts`, `lib/config/ai-settings.custom.test.ts`,
  `lib/ai/key-binding.test.ts`, `lib/ai/key-binding.pglite.test.ts`,
  `lib/ai/providers/resolve.custom.test.ts`, `lib/ai/provider-deps.custom.test.ts`,
  `lib/ai/custom-provider.pglite.test.ts`, `app/admin/ai/custom-provider-actions.test.ts`,
  `components/admin/CustomProvidersAdmin.test.tsx`
- changed (tests, additions): `lib/ai/providers/openai-compatible.test.ts` (OC-3),
  `app/admin/ai/result-messages.test.ts` (RM-CP1..3), `components/admin/ActionMessage.test.tsx`
  (AM-6), `app/admin/ai/page.test.tsx` (PA-C1..3 + deliberate changes 4-5),
  `test/helpers/pglite.migrations.test.ts` (PM-6), `lib/db/schema.test.ts` (SC-CP, MG-3),
  `test/data-model-doc.test.ts` (DM-CP-1)
- process: `dev_minions/HANDOVER.md`, `dev_minions/status.md`, `dev_minions/verification/US-057-plan.md`,
  `dev_minions/verification/US-057-review.md`, `dev_minions/verification/US-057-tests.md`
- QA-reopen remediation in shared tree: `lib/ai/provider-deps.ts`,
  `lib/ai/provider-deps.custom.test.ts` (PDX-8; US-056 fix); chat regression and fixture updates
  recorded under US-058 in `HANDOVER.md` (the shared full-suite QA run covers these paths).

No live resource, secret, git, migration or deploy command was used in delivering this story.
