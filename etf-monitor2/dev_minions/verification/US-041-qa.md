# US-041 QA checklist — provider presets and model picker

Development round 1: independent review PASS (`US-041-review.md`), independent
tests PASS (`US-041-tests.md`), AC1–AC5 MET. Reviewer noted two non-blocking
test-coverage gaps: generic config-test fixtures still mention retired provider
IDs, and the provider-switch datalist interaction lacks a browser interaction
assertion. Neither changes the shipped Gemini/Groq-only catalogue or endpoint
boundary. The tester independently ran focused 10 files / 84 tests, typecheck,
lint (0 errors / 9 warnings), full 204 files / 2057 tests, and offline build
(12 dynamic routes), all PASS.

## Codex offline checks

1. Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`,
   `pnpm test`, `pnpm build` with `DATABASE_URL`, `CRON_SECRET`,
   `AI_KEY_MASTER_KEY`, `VERCEL_ENV` and provider-key variables removed from
   the process without printing values. Expect exit 0; migration runner skips
   the non-production build. No live migration/provider call.
2. Run the focused files enumerated in `US-041-tests.md` via `pnpm test
   <files>`; check roster/registry parity, static model suggestions, action
   ignoring posted `baseUrl`, fixed outbound mocked provider endpoints, saved
   model persistence, RO/EN render and preserved US-040 write-only key input.
3. Serve `/admin/ai` locally in RO and EN with test-only/unset configuration.
   Select Gemini, then Groq: confirm the model suggestions change with the
   selected provider, the model text remains editable, there is no URL input,
   and neither key values nor key prefill appear. Confirm ordinary settings
   errors remain translated. Stop the local server afterward.

## MANUAL-QA after the user's normal push

4. In `/admin/ai`, select a preset and enter a permitted model name, then
   reload: the provider/model selection should persist. Check that each
   suggested model is a *static suggestion*, not a guarantee that a live
   provider currently supports it; no live model discovery is implemented.
   Do not enter a real API key in chat or tests, inspect key rows or change
   Vercel settings as part of this check.
5. Verify the two fixed presets are Google Gemini and Groq. The user may
   answer Sprint 10 D-1 at demo if additional **named** presets are desired;
   that needs separately scoped fixed-endpoint adapters. No arbitrary
   endpoint or free-form base URL is supported.

PO to confirm drafted AC1–AC5 (FR16 / FR8.1). Codex QA may be behind; its
status is not a development gate.

## Files changed

- `dev_minions/verification/US-041-plan.md`,
  `dev_minions/verification/US-041-review.md`,
  `dev_minions/verification/US-041-tests.md`,
  `dev_minions/verification/US-041-qa.md`,
  `dev_minions/HANDOVER.md`, `dev_minions/status.md`
- `lib/ai/provider-catalog.ts`, `lib/ai/provider-catalog.test.ts`,
  `lib/ai/providers/gemini.test.ts`, `lib/ai/providers/groq.test.ts`
- `components/admin/AiProviderModelFields.tsx`,
  `components/admin/AiProviderModelFields.test.tsx`,
  `components/admin/AiSettingsAdmin.tsx`,
  `components/admin/AiSettingsAdmin.test.tsx`
- `app/admin/ai/page.tsx`, `app/admin/ai/page.test.tsx`,
  `app/admin/ai/actions.test.ts`

No schema, migration, runtime dependency, lockfile or provider endpoint change.
