# US-055 QA run 1 — 2026-10-08

Verdict: BLOCKED

QA continued under the user's explicit override although
`bash scripts/claude/dev-loop-status.sh` returned exit 1:
`STOPPED 2026-10-08 03:57:41 — usage limit resets 2026-10-10 19:00:00, too far away to wait`.
The development loop was not restarted. No secret values were printed; all database, cron,
master-key and provider-key variables were unset for `pnpm` checks.

## Machine checks

| Check | Result | Exact command and evidence |
|---|---|---|
| Development-loop gate | Override used | `bash scripts/claude/dev-loop-status.sh` → exit 1 → `STOPPED 2026-10-08 03:57:41 — usage limit resets 2026-10-10 19:00:00, too far away to wait`. Rechecked before this story. |
| Focused US-055 conversation regression | BLOCKED by US-058 work in progress | `bash -lc 'set -o pipefail; env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY pnpm exec vitest run lib/ai/capabilities/action-list.envelope.test.ts lib/ai/chat-history.test.ts lib/ai/chat-results.test.ts lib/ai/reply-guard.test.ts lib/ai/chat.conversation.test.ts lib/ai/chat.conversations.pglite.test.ts app/chat/reply-messages.conversation.test.ts app/chat/actions.history.test.ts components/chat/ChatReply.conversation.test.tsx components/chat/transcript.history.test.ts lib/ai/providers/gemini.test.ts lib/ai/providers/openai-compatible.test.ts lib/ai/provider-deps.test.ts lib/ai/provider-deps.custom.test.ts lib/ai/chat.test.ts lib/ai/chat.pglite.test.ts app/chat/reply-messages.golden.test.ts 2>&1 | tail -n 30'` → exit 1 → `Test Files 1 failed | 16 passed (17); Tests 4 failed | 244 passed (248)`. D08 and D10 in `lib/ai/chat.conversations.pglite.test.ts` expect one provider call but observe two, matching the US-058 confirmation/correction work still recorded as in progress. |
| Shared full regression | FAIL; not a US-055-only defect established | The current-tree full run in US-057 QA above was `pnpm test` with the same unset-variable prefix → exit 1 → 2 files failed, 251 passed; 14 tests failed, 2739 passed. The failures include the known in-progress US-058 chat call-count and plan-refusal changes. |
| Shared typecheck / lint / build | PASS, reused from the same unchanged-tree QA run | Typecheck exit 0; lint exit 0 with 23 warnings; offline build exit 0 with 12 dynamic routes. Exact commands and output are recorded in `US-057-qa-run.md`. |
| `/chat`, RO/EN, no database | PASS | `bash -lc 'QA_PORT=3101 bash scripts/claude/qa-serve.sh get /chat NEXT_LOCALE=en; QA_PORT=3101 bash scripts/claude/qa-serve.sh get /chat NEXT_LOCALE=ro'` → exit 0 → `STATUS 200` for both, with translated safe load-error states and the 21-message/New conversation guidance. Server setup and cleanup limitation are recorded in `US-057-qa-run.md`. |
| Live-provider manual checks | NOT RUN | These require a deployed account, configured live provider and Neon state; no provider keys or production resources were accessed. |

## Blocker and exact next step

US-058 is the shared AI/chat story currently recorded in `HANDOVER.md` as implementation in
progress. Its planned confirmation and self-correction behavior intentionally changes provider
call counts and introduces `plan_refused`; US-055's current scripted tests have not yet received
those deliberate updates. Complete US-058 and its planned test updates first, then rerun the
focused conversation tests, `pnpm test`, and `bash scripts/claude/predeploy-check.sh`. After those
pass on the stable tree, rerun US-055 QA. The evidence does not establish a US-055 production
defect, so the story remains Awaiting QA rather than being reopened.

## For the user

- M-1: with Groq `openai/gpt-oss-120b` and Neon configured, exercise the six-step conversation in
  `US-055-qa.md`; verify natural replies, result lists match stored state, and ambiguous actions
  ask before changing anything.
- M-2: repeat on Gemini `gemini-2.5-flash` for at least 12 turns; confirm no provider error from
  multi-turn role merging.
- M-3: request HTML/link output and verify it is literal, non-clickable text.
- M-4: start a new conversation and send a context-dependent follow-up; confirm it asks rather
  than guessing from cleared history.
- M-5: run a normal six-turn Groq conversation and confirm no `rate_limited` result.

No Git, live provider, real key, Neon, Vercel, migration, or deployment command was used. Files
changed by QA: this report, the US-055 status-board row, and the Codex QA log section in
`HANDOVER.md`.

## QA run 2 — 2026-10-09
Verdict: PASS
Machine checks: focused regression and bilingual no-database `/chat` checks PASS; shared current-tree
predeploy gates PASS. Live provider/database steps remain for the user.

The user-authorized QA override was used although the dev-loop status printed
`STOPPED 2026-10-08 03:57:41 — usage limit resets 2026-10-10 19:00:00, too far away to wait`.
The dev loop was not restarted. Database, cron, master-key and provider-key environment variables
were unset for checks; no values were printed.

| Check | Result | Exact command → exit code → output |
|---|---|---|
| Development-loop gate | Override used | `bash -lc 'bash scripts/claude/dev-loop-status.sh; printf "GATE_EXIT=%s\n" "$?"'` → 0 (wrapper; inner status printed STOPPED) → `STOPPED 2026-10-08 03:57:41 — usage limit resets 2026-10-10 19:00:00, too far away to wait`. |
| Focused US-055 dialogue/correction/conversation suite | PASS | `bash -lc 'set -o pipefail; env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY pnpm exec vitest run lib/ai/capabilities/action-list.envelope.test.ts lib/ai/chat-history.test.ts lib/ai/chat-results.test.ts lib/ai/reply-guard.test.ts lib/ai/chat.conversation.test.ts lib/ai/chat.conversations.pglite.test.ts app/chat/reply-messages.conversation.test.ts app/chat/actions.history.test.ts components/chat/ChatReply.conversation.test.tsx components/chat/transcript.history.test.ts lib/ai/providers/gemini.test.ts lib/ai/providers/openai-compatible.test.ts lib/ai/provider-deps.test.ts lib/ai/provider-deps.custom.test.ts lib/ai/chat.test.ts lib/ai/chat.pglite.test.ts app/chat/reply-messages.golden.test.ts 2>&1 \| tail -n 30'` → 0 → `Test Files 17 passed (17); Tests 258 passed (258)`. |
| Full shared predeploy gate | PASS (same unchanged current tree) | `bash -lc 'set -o pipefail; env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u AI_KEY_MASTER_KEY -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u MISTRAL_API_KEY -u DEEPSEEK_API_KEY -u CEREBRAS_API_KEY -u TOGETHER_API_KEY bash scripts/claude/predeploy-check.sh 2>&1 \| tail -n 20'` → 0 → `Test Files 259 passed (259); Tests 2803 passed (2803); PREDEPLOY: PASS — typecheck, lint, build and tests are green. Safe to commit and push.` This was run earlier in this QA cycle after the same app/test tree was confirmed stable; only QA documentation/status entries changed since. |
| English/Romanian `/chat` without database | PASS | `bash -lc 'set -o pipefail; echo "START"; bash scripts/claude/qa-serve.sh start; echo "GET_EN"; bash scripts/claude/qa-serve.sh get /chat NEXT_LOCALE=en; echo "GET_RO"; bash scripts/claude/qa-serve.sh get /chat NEXT_LOCALE=ro; echo "STOP"; bash scripts/claude/qa-serve.sh stop'` → 0 → server ready/stopped; both requests `STATUS 200`, translated safe load-error message and localized instructions show the 21-message memory, "New conversation", setup questions, and no-key guidance. |
| Live-provider/Neon steps M-1 through M-5 | NOT RUN | Require deployed provider configuration, user-owned credentials and/or Neon data; QA did not access these resources. |

### Failures
None. The round-1 D08/D10 call-count failures and shared chat regression failures are fixed in the
redelivered tree: all 17 focused files passed, including the per-turn conversation fixture and
correction-path coverage.

### For the user
- **M-1/M-2**: use your configured Groq and Gemini providers to perform the bilingual conversation
  in `US-055-qa.md`, including the clarifying follow-up; confirm the result list matches persisted
  state and that a 12-turn Gemini conversation has no provider error.
- **M-3**: ask for HTML/link output and confirm it is literal, non-clickable text.
- **M-4**: click “New conversation” and send a context-dependent follow-up; confirm the assistant
  asks rather than using cleared history.
- **M-5**: complete a normal six-turn Groq interaction and check there is no `rate_limited` result.

No application code or tests were changed. No live provider, real key, Neon, Vercel, migration,
deployment or Git operation was used. Denied or attempted prohibited commands: none in this run.
