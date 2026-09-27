# US-027 — QA checklist: intent extraction, natural language → configuration action

Round 1: review PASS (`US-027-review.md`), tests PASS (`US-027-tests.md`). Both verdicts agree:
1330/1330 tests, typecheck/lint/build all green, offline build (no DATABASE_URL/GEMINI_API_KEY/
GROQ_API_KEY) green. This story executes nothing and writes nothing to the database — it only
turns a message + context into a validated `ConfigurationOutcome`. There is no route, no UI, no
schema change to exercise live. No live BVB/Neon/Vercel step is needed for this story itself.

## PO to confirm — acceptance criteria were agent-drafted
All 9 acceptance criteria (AC1–AC9) in `dev_minions/backlog/stories/US-027.md` are
`DRAFTED BY AGENT — PO to confirm`. Please confirm they match your intent for FR1, FR2, FR5,
FR8.1 and requirements §2.2/§5, in particular:
- the grounding rules in AC6 (symbol must literally occur in the message for `add_etf`; field
  must be in the ETF's available/tracked fields);
- the scope boundary in AC7 (only the four actions; everything else — including value queries
  like "what is today's VUAN?" — is `unsupported`);
- sprint-06 decision #9 (one action per message, no isolated multi-action support) — isolated
  default shipped, listed under HANDOVER.md "Waiting on the user".

## Automated checks already run (by story-reviewer / story-tester, not to repeat live)
1. `pnpm install --frozen-lockfile` — exit 0.
2. `pnpm typecheck` — exit 0.
3. `pnpm lint` — exit 0 (0 errors; pre-existing warnings only, none in new code).
4. `pnpm test` — exit 0, 1330/1330 across 122 files, including:
   - `lib/ai/capabilities/registry.test.ts`, `generate.test.ts`, `boundaries.test.ts` (AC1)
   - `lib/ai/capabilities/configuration/context.pglite.test.ts` (AC2)
   - `lib/ai/capabilities/configuration/prompt.test.ts` (AC3)
   - `lib/ai/capabilities/configuration/interpret.test.ts`, `interpret.pglite.test.ts` (AC4, AC8)
   - `lib/ai/capabilities/configuration/intent.test.ts` (AC5)
   - `lib/ai/capabilities/configuration/grounding.test.ts` (AC6)
5. `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY pnpm build` — exit 0, offline, no new
   route (this story adds no `app/` files).
6. No new runtime dependency: `package.json` / `pnpm-lock.yaml` untouched (confirmed by
   `story-reviewer` without running git — via `lib/ai/boundaries.test.ts` LB-7 passing and the
   files not appearing in "Files changed").

## Live / manual steps (deferred, per the story's own "Notes for verification")
This story cannot be exercised live on its own — there is no chat UI yet (that is US-028). The
following remain manual QA once US-028 ships a chat surface wired to this capability:
1. **sprint-06.md step 3** — send a real natural-language RO message to the deployed chat and
   confirm the intent extracted matches the message (live Gemini/Groq call).
2. **sprint-06.md step 4** — same in EN.
3. **sprint-06.md step 5** — send an out-of-scope message (e.g. a value question) and confirm
   `unsupported`, live.

These measure a real model's language understanding, which only a live call can prove (this
story's own tests only prove the pipeline with canned model outputs).

## Non-blocking review notes (do not affect PASS)
- N1: the plan promised each new test file asserts `fetch` was never reached in an `afterEach`;
  none add that explicit assertion, but the fake provider structurally never calls `fetch`, so
  AC9 still holds. Cosmetic plan/implementation mismatch only.
- N2: HANDOVER.md said "6 pre-existing warnings"; the reviewer's own `pnpm lint` run counted 5.
  Corrected in this round's HANDOVER.md log line.

## Files changed (US-027, final)
- `dev_minions/verification/US-027-plan.md` (story-planner), `US-027-review.md`, `US-027-tests.md`, `US-027-qa.md` (new)
- new: `lib/ai/capabilities/types.ts`, `lib/ai/capabilities/generate.ts`, `lib/ai/capabilities/registry.ts`,
  `lib/ai/capabilities/configuration/{context,intent,grounding,prompt,interpret,capability}.ts`,
  `test/helpers/ai-config-context.ts`
- new tests: `lib/ai/capabilities/registry.test.ts`, `lib/ai/capabilities/generate.test.ts`,
  `lib/ai/capabilities/boundaries.test.ts`, `lib/ai/capabilities/configuration/context.pglite.test.ts`,
  `lib/ai/capabilities/configuration/prompt.test.ts`, `lib/ai/capabilities/configuration/intent.test.ts`,
  `lib/ai/capabilities/configuration/grounding.test.ts`, `lib/ai/capabilities/configuration/interpret.test.ts`,
  `lib/ai/capabilities/configuration/interpret.pglite.test.ts`
- changed: `lib/ai/boundaries.test.ts` (LB-0 count 13→22 + new expected files, LB-2 `ALLOWED_TARGETS`
  gains `lib/config/etfs`, `lib/config/tracked-fields` and the 7 internal capability-file targets)
