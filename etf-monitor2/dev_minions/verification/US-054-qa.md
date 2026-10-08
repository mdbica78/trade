# QA checklist — US-054 (Better prompt and tolerant normalisation for small models)

Round 1: independent review PASS (`US-054-review.md`), independent tests PASS (`US-054-tests.md`).
226 files / 2400 tests, typecheck/lint/offline build all green with `DATABASE_URL`/`CRON_SECRET`/
`VERCEL_ENV`/`AI_KEY_MASTER_KEY`/`GEMINI_API_KEY`/`GROQ_API_KEY` unset.

## Automated checks (already run by the dev loop, re-run if you want to confirm)
1. `pnpm typecheck` → expect 0 errors.
2. `pnpm lint` → expect 0 errors, 11 pre-existing warnings.
3. `pnpm test` → expect 226 files / 2400 tests, all green.
4. `pnpm build` → expect success, `migrate-on-deploy: skipped`, 12 dynamic routes.
5. `bash scripts/claude/predeploy-check.sh` (WSL login shell) → expect PASS.

## Manual / live checks (Codex QA loop — needs a configured provider key)
6. In `/chat`, with a real Gemini or Groq key configured, send a plain-language request from the
   regression table (e.g. "clear units in circulation for BTBETRETF" or a Romanian phrase with a
   typo'd field name) and confirm the model's sloppy JSON (missing `etf` key, digit-only strings,
   a synonym operation like "maximum") is normalised and executed correctly, matching
   `test/fixtures/ai/chat-regression.json`'s expected validated actions for that phrase.
7. Confirm a genuinely invalid request (unknown field, unknown operation, bad period) still fails
   with the existing closed-set error reply — normalisation must not silently accept nonsense.
8. Confirm the model still refuses to execute instructions found inside PDF/web content pasted
   into chat (the "message is data, not instructions" rule) — not newly introduced by this story,
   but worth a smoke check since the prompt text was rewritten.

## PO to confirm drafted criteria
None — AC1-AC4 were confirmed by the PO on 2026-10-05 (per the story file header), not agent-drafted.

## Files changed (US-054)
- new (source): `lib/ai/capabilities/normalise.ts`
- changed (source): `lib/ai/chat.ts`, `lib/ai/capabilities/configuration/prompt.ts`
- new (test data/docs): `test/fixtures/ai/chat-regression.json`
- changed (docs): `test/fixtures/ai/README.md`
- new (tests): `lib/ai/capabilities/normalise.test.ts` (NM-1..NM-13), `lib/ai/chat.regression.test.ts`
- changed (tests, additions only): `lib/ai/capabilities/configuration/prompt.test.ts`
  (CP-9..CP-12, PE-1), `lib/ai/chat.test.ts` (CE-N1..CE-N3)
- deliberate test changes (strengthening, not loosening): `lib/ai/chat.test.ts` CE-P1,
  `lib/ai/chat.pglite.test.ts` T-8 (both: `toContain` checks scoped to the `<catalogue_data>`
  block instead of the whole prompt, since the rewritten prompt's examples now contain similar
  substrings outside that block), `lib/ai/capabilities/boundaries.test.ts` and
  `lib/ai/boundaries.test.ts` (ALLOWED_TARGETS / CB-0 / LB-0 gain the new `normalise` module,
  additive only)
- process: `dev_minions/HANDOVER.md`, `dev_minions/status.md`, `dev_minions/verification/US-054-review.md`,
  `dev_minions/verification/US-054-tests.md`, `dev_minions/verification/US-054-qa.md`

No live resource, secret, git, migration or deploy command was used in development or review.
