# US-028 — QA checklist: chat surface wired to the configuration actions (RO and EN)

Round 1: review PASS (`US-028-review.md`, 4 non-blocking Notes, no Critical), tests PASS
(`US-028-tests.md`, 229-230/230 and 1475/1475 full suite respectively — one isolated flaky timeout
under concurrent PGlite load, confirmed passing in isolation). All 11 acceptance criteria MET with
file:line evidence from both verifiers independently. This is the last story of Sprint 6.

**Round 2 (this checklist's current state):** the Sprint 6 tech-lead audit (`SPRINT-06-audit.md`)
reopened this story for C1 (AC2's loaders weren't re-run/checked after each chat command in the
PGlite tests), C2 (the action-boundary relative-import guard test passed a path that couldn't
resolve outside `lib/`, so it never caught the bug it claimed to catch), W4 (AC6 chat-level tested
only 2 of 5 `ChatUnavailableReason`s) and N4 (README not updated for `/chat`). All four are fixed
test-only, no application code changed — round 2 review PASS (no Critical, no new Warning) and
round 2 tests PASS (typecheck/lint/build green, full suite 1478/1478; the single full-run timeout
in `app/chat/page.safety.test.tsx` CPS-1 is the same known flaky-under-concurrent-load pattern seen
on US-024/US-026, reproduced passing 5/5 in isolation, and that file was untouched this round).
Both verifiers independently re-derived the fix evidence (file:line) rather than trusting each
other's or the audit's claims. Story → Awaiting QA.

## PO to confirm — acceptance criteria were agent-drafted
All 11 acceptance criteria (AC1–AC11) in `dev_minions/backlog/stories/US-028.md` are
`DRAFTED BY AGENT — PO to confirm`. Please confirm they match your intent, in particular the three
`NEEDS USER` product decisions this story ships isolated defaults for (also listed under
HANDOVER.md "Waiting on the user"):
- **Decision #10** — when no name is given, `name = symbol` for `add_etf`.
- **Decision #11** — commands execute immediately, no confirmation step.
- **Decision #12** — `/chat` lives in the user area with a header link (not admin-only).

Also flagged by the tech-lead's sprint-06 review (information item, not a blocker): once this ships,
anyone with the `/chat` URL can spend the user's free-tier AI quota — no login, per requirements §6.

## Automated checks already run (by story-reviewer / story-tester, not to repeat live)
1. `pnpm install --frozen-lockfile` — exit 0.
2. `pnpm typecheck` — exit 0.
3. `pnpm lint` — exit 0 (0 errors; 5 pre-existing warnings, none in new code).
4. `pnpm test` — exit 0, 1478/1478 across 136 files after round-2 fixes (up from 1475/1475 in round
   1 due to `it.each` expansion of the unavailable-reason coverage), including:
   - `app/chat/page.test.tsx` (AC1, AC6), `components/AppHeader.test.tsx` (AC1)
   - `lib/ai/chat.pglite.test.ts` (AC2, AC3, AC5, AC6)
   - `app/chat/actions.test.ts`, `app/chat/actions.pglite.test.ts` (AC2, AC7, AC8)
   - `lib/ai/capabilities/configuration/execute.test.ts`, `execute.pglite.test.ts` (AC3, AC5)
   - `app/chat/reply-messages.test.ts` (AC4, AC5)
   - `components/chat/ChatReply.test.tsx`, `ChatPanel.test.tsx`, `ChatView.test.tsx` (AC4, AC8)
   - `lib/ai/chat.test.ts` (AC4, AC7, AC8)
   - `app/chat/page.safety.test.tsx` (AC7)
   - `app/actions.boundary.test.ts` (AC9)
   - `app/admin/ai/page.test.tsx` (AC10)
5. `pnpm build` — exit 0, `/chat` listed as a dynamic route.
6. `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY pnpm build` — exit 0, offline, `/chat`
   still listed.
7. No schema change, no new dependency (AC11) — confirmed by both verifiers via
   `lib/ai/boundaries.test.ts` / `lib/ai/capabilities/boundaries.test.ts` and the absence of
   `package.json`/`pnpm-lock.yaml` from "Files changed", without running git.

## Live / manual steps (deferred to the user, sprint-06.md steps 2–8)
This story cannot prove real model language-understanding or a real browser session on its own:
1. **sprint-06.md step 2** — open `/chat` in a real browser, RO and EN, and confirm the header link,
   composer and translated copy render as expected.
2. **sprint-06.md steps 3–5** — send real natural-language RO/EN messages to the deployed chat
   (live Gemini/Groq call) and confirm the resulting configuration change and reply wording; also
   send an out-of-scope message and confirm the generic "unsupported" reply (deferred from US-027,
   since this is the first story with a chat UI to exercise it through).
3. **sprint-06.md step 6** — confirm the home page and `/admin/etfs` reflect a chat-made change
   without a manual reload (live revalidation, not just the mocked-`revalidatePath` test).
4. **sprint-06.md step 7** — trigger each provider error path live (bad key, bad model name) and
   confirm the reply wording points to Administration → AI without leaking provider text.
5. **sprint-06.md step 8** — confirm `/admin/ai`'s new link to `/chat` works end to end, live.

## Non-blocking review notes (do not affect PASS)
- N1: the plan named PGlite tests `CEP-7`/`CEP-10` that don't exist verbatim; the properties they
  were meant to prove are covered indirectly elsewhere (`execute.test.ts`, `reply-messages.test.ts`
  CRM-2). Plan/implementation naming mismatch only, no AC gap.
- N2: the plan promised `expectTypeOf` type-pinning tests for `ChatUnavailableReason` vs
  `ActiveProviderFailureReason`; not implemented. The two unions are identical today — a missing
  future regression guard, not a live gap.
- N3: the plan's promised one-line README.md addition for `/chat` was not shipped; not required by
  any AC.
- N4: `app/chat/page.safety.test.tsx` (`CPS-1`) timed out once under concurrent PGlite load across
  the full changed-file set, passed cleanly in isolation — matches this repo's known
  "flaky under concurrent load" pattern, not a code defect.

## Files changed (US-028, round 2 additions on top of "final" below)
- `lib/ai/chat.pglite.test.ts` (CEP-1..4 now also call `createHomeTableLoader`/`createDrizzleEtfLoader`
  and assert on their output — C1)
- `app/actions.boundary.test.ts` (line 76 now passes `` `app/${file}` ``; new AB-4 case with a real
  `app/chat/actions.ts` relative-import path — C2)
- `lib/ai/chat.test.ts` (`it.each(CHAT_UNAVAILABLE_REASONS)` over all five reasons — W4)
- `app/chat/page.test.tsx` (CPG-2 asserts translated `Chat.replies.unavailable*` text per reason — W4)
- `README.md` (`/chat` behaviour documented under "Administration" — N4)
- `dev_minions/verification/US-028-review.md`, `US-028-tests.md` (Round 2 sections appended)

## Files changed (US-028, final)
- `dev_minions/verification/US-028-plan.md` (story-planner), `US-028-review.md`, `US-028-tests.md`, `US-028-qa.md` (new)
- new: `lib/ai/capabilities/configuration/execute.ts`, `lib/ai/chat.ts`, `app/chat/page.tsx`,
  `app/chat/actions.ts`, `app/chat/reply-messages.ts`, `app/actions.boundary.test.ts`,
  `components/chat/chat-state.ts`, `components/chat/transcript.ts`, `components/chat/ChatReply.tsx`,
  `components/chat/ChatPanel.tsx`, `components/chat/ChatView.tsx`
- new tests: `lib/ai/capabilities/configuration/execute.test.ts`, `execute.pglite.test.ts`,
  `lib/ai/chat.test.ts`, `lib/ai/chat.pglite.test.ts`, `app/chat/reply-messages.test.ts`,
  `app/chat/actions.test.ts`, `app/chat/actions.pglite.test.ts`, `app/chat/page.test.tsx`,
  `app/chat/page.safety.test.tsx`, `components/chat/ChatReply.test.tsx`,
  `components/chat/ChatPanel.test.tsx`, `components/chat/ChatView.test.tsx`,
  `components/chat/transcript.test.ts`
- changed: `components/AppHeader.tsx` (+`/chat` nav link), `components/AppHeader.test.tsx` (AH-1),
  `components/admin/AiSettingsAdmin.tsx` (chatUnavailableNote → chatLink), `app/admin/ai/page.test.tsx`
  (PA-5 updated, PA-10 new), `messages/en.json`, `messages/ro.json` (`Nav.chat`, `Chat.*`,
  `Admin.ai.chatLink`; `Admin.ai.chatUnavailableNote` removed), `lib/ai/boundaries.test.ts` (LB-0
  count 24, `chat.ts`/`execute.ts` added; LB-2 `ALLOWED_TARGETS` gains `lib/config/default-deps`,
  `lib/ai/provider-deps`, `lib/ai/capabilities/{generate,registry,configuration/execute}`),
  `lib/ai/capabilities/boundaries.test.ts` (CB-0 count 10, CB-4 exempts `execute.ts` + new
  CB-4-execute positive check)
