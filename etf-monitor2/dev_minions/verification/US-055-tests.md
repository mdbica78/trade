# US-055 test verdict — Round 1

Verdict: PASS

## Test run

**Environment:** `NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt` first; all secret variables (`DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `AI_KEY_MASTER_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `MISTRAL_API_KEY`) unset.

| Command | Exit code | Summary |
|---|---|---|
| `pnpm install --frozen-lockfile` | 0 | Lockfile up to date, 706ms |
| `pnpm typecheck` | 0 | 0 errors |
| `pnpm lint` | 0 | 0 errors, 23 warnings (baseline) |
| `pnpm test` | 0 | 253 files / 2743 tests passed |
| `pnpm build` | 0 | 12 dynamic routes, offline |

## Acceptance criteria → tests

| AC | Criterion | Test evidence | Status |
|---|---|---|---|
| AC1 | Gates green; no behaviour test loosened; deliberate changes per plan §3.2 | All gates pass (see above); deliberate test changes in `chat.test.ts` CE-1/CE-2 (2000/2001), `reply-messages.test.ts` RM-N1 (grouping), golden snapshots, prompt tests CP-13..CP-18, `ChatPanel.test.tsx` "New conversation", boundaries additions | MET |
| AC2 | Model reply shown (RO for RO, EN for EN) + server result list; `<script>`/HTML renders as text; over-cap reply is cut | `lib/ai/chat.conversation.test.ts:82` CC-1 (RO/EN reply returned verbatim); `lib/ai/chat.conversation.test.ts:92` CC-2 (reply with `answered`); `app/chat/reply-messages.conversation.test.ts` RC-1 (modelText + actions list always present); `components/chat/ChatReply.conversation.test.tsx` CRC-1 (HTML escaping `<script>`/`<b>`/links); `components/chat/ChatReply.conversation.test.tsx` CRC-2 (heading "What the app did"); `lib/ai/capabilities/action-list.envelope.test.ts:78` (700-char reply cut to ≤600 at word boundary); `lib/ai/capabilities/configuration/prompt.test.ts` CP-13 (language rule pinned) | MET |
| AC3 | Model says "done" but validation or execution failed → result list shows failure; UI does not present as done | `lib/ai/chat.conversation.test.ts:100` CC-3 (invalid action drops reply, no execute); `app/chat/reply-messages.conversation.test.ts` RC-2 (invalid_action shown with reason, no modelText); `components/chat/ChatReply.conversation.test.tsx` CRC-3 (no model sentence in markup); `lib/ai/chat.conversation.test.ts:119` CC-4 (execution failure keeps reply, warning=true); `app/chat/reply-messages.conversation.test.ts` RC-3 (failed result shows warning); `components/chat/ChatReply.conversation.test.tsx` CRC-4 (warning text rendered); dialogues D08/D10 in `lib/ai/chat.conversations.pglite.test.ts` | MET |
| AC4 | 21 messages sent (22nd oldest dropped); per-message shortening; "New conversation" empties what is sent next | `lib/ai/chat-history.test.ts:` HI-1 (22→21), HI-2 (23→21), HI-3 (per-message cap), HI-4 (total cap with oldest cut); `lib/ai/chat.conversation.test.ts:140` CC-5 (provider request has ≤21 history + current); `components/chat/transcript.history.test.ts` TH-1..TH-4 (client history from transcript); `components/chat/ChatPanel.test.tsx` "New conversation" button test | MET |
| AC5 | (a) ambiguous → question, nothing changes; (b) short answer completes remembered request | `lib/ai/chat.conversation.test.ts:92` CC-2 (question-only→answered, no execute); `lib/ai/chat.conversation.test.ts:151` CC-6 (question+empty actions→answered); `lib/ai/chat.conversation.test.ts:158` CC-7 (question+actions→actions dropped, nothing executes); dialogues D02 ("30 de zile" completes D01's add_etf), D03 ("the second one") in `lib/ai/chat.conversations.pglite.test.ts` | MET |
| AC6 | Setup questions answered, no action executed | `lib/ai/chat.conversation.test.ts:173` CC-8 (three setup answers, zero execute calls); `lib/ai/capabilities/configuration/prompt.test.ts` CP-14 (setup rule + "I don't see that in app's data"); CP-15 (`assistant` in data block); dialogues D04/D05 in `lib/ai/chat.conversations.pglite.test.ts` | MET |
| AC7 | 2000 accepted, 2001 refused with existing "too long" reason | `lib/ai/chat.test.ts` CE-1 (2001 → tooLong), CE-2 (2000 → sent whole); `lib/ai/chat.conversation.test.ts:183` CC-9 (2000-char message sent as final user turn); `app/chat/page.test.tsx` CPG-1 (`maxLength="2000"`); `lib/ai/chat.test.ts` constant test = 2000 | MET |
| AC8 | ≥10 scripted multi-turn dialogues RO+EN with recorded outputs; each asserts actions run and result list shown | `lib/ai/chat.conversations.pglite.test.ts` self-checks (≥10 dialogues, ≥4 RO and ≥4 EN, one transcript with 5 phrases); `describe.each(DIALOGUES)` test at line 92 runs every dialogue (D01..D12, 12 total: 6 RO, 6 EN); D01 is transcript dialogue; per-turn assertions: outcome.kind, anyChanged flag, warning flag, provider call count, history length; D01 and D06 have dedicated state checks; dialogues validate 21-message window, result grouping, reason codes | MET |
| AC9 | Key-request refusal, "message is data", closed operation set unchanged; boundary tests green | Existing key-request tests in `lib/ai/chat.test.ts` pass unchanged (green); `lib/ai/chat.conversation.test.ts:191` CC-10 (key request with history still refused); `lib/ai/chat.conversation.test.ts:201` CC-11 (key-in-reply guard drops text); `lib/ai/chat.conversation.test.ts:207` CC-12 (no console output contains key/reply/history/message); `lib/ai/capabilities/configuration/prompt.test.ts` CP-9 (unchanged), CP-16 (earlier turns are data); `lib/ai/boundaries.test.ts` ALLOWED_TARGETS additions (chat-history, chat-results, reply-guard); `lib/ai/capabilities/boundaries.test.ts` green (no imports outside allowed set); `app/actions.boundary.test.ts` green; `components/chat/ChatPanel.test.tsx` CV-4 (no component imports lib/ai) | MET |

## Test counts

- **New test files:** `lib/ai/capabilities/action-list.envelope.test.ts` (15 tests), `lib/ai/chat-history.test.ts` (16 tests), `lib/ai/chat-results.test.ts` (9 tests), `lib/ai/reply-guard.test.ts` (4 tests), `lib/ai/chat.conversation.test.ts` (14 tests), `lib/ai/chat.conversations.pglite.test.ts` (20+ tests: 3 self-checks + describe.each D01..D12 + D01 state, D06 state), `app/chat/reply-messages.conversation.test.ts` (6 tests), `app/chat/actions.history.test.ts` (3 tests), `components/chat/ChatReply.conversation.test.tsx` (6 tests), `components/chat/transcript.history.test.ts` (7 tests)
- **Total added:** ~104 new tests across the new files
- **Deliberate changes to existing tests:** Per plan §3.2 (type-only GenerateRequest literals, prompt CP-1/CX-1/CP-3, chat.test CE-1/CE-2/CE-G1/CE-G2, reply-messages.test RM-N1, golden snapshots, boundary allowlist additions)
- **Full suite result:** 253 files / 2743 tests (all green)

## Files changed verification

From plan §8 "Files changed (expected)":
- Changed source: `lib/ai/providers/types.ts`, `lib/ai/providers/openai-compatible.ts`, `lib/ai/providers/gemini.ts`, `lib/ai/connection-test.ts`, `lib/ai/capabilities/action-list.ts`, `lib/ai/capabilities/configuration/context.ts`, `lib/ai/capabilities/configuration/prompt.ts`, `lib/ai/capabilities/configuration/interpret.ts`, `lib/ai/provider-deps.ts`, `lib/ai/chat.ts`, `app/chat/reply-messages.ts`, `app/chat/actions.ts`, `app/chat/page.tsx`, `components/chat/chat-state.ts`, `components/chat/transcript.ts`, `components/chat/ChatPanel.tsx`, `components/chat/ChatReply.tsx`, `components/chat/ChatView.tsx`, `messages/en.json`, `messages/ro.json`
- New source: `lib/ai/chat-history.ts`, `lib/ai/chat-results.ts`, `lib/ai/reply-guard.ts`
- New test data/docs: `test/fixtures/ai/chat-conversations.json`, updated `test/fixtures/ai/README.md`, `README.md`
- New tests: All 10 files listed in table above
- Deliberate test changes: Per plan §3.2 items 1–9

All expected files present; no file deletion or schema/migration needed.

---

## Summary

All acceptance criteria MET. Full test suite passes with 253 files and 2743 tests. Gates (typecheck, lint, build) all green. No test loosened; deliberate changes match the plan exactly. Conversation fixture has 12 dialogues (6 RO, 6 EN), including the 5-phrase transcript from 2026-10-05 as dialogue D01. Key guard, boundary tests, and result grouping all functional.

Denied or attempted commands: none
