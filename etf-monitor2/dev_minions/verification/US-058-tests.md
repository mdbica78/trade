# US-058 independent test verdict — Round 1

Verdict: PASS

Independent test run, 2026-10-08. Ran from the established WSL project path
`/mnt/c/_mystaff/myG/trade/etf-monitor2`. Before each command, unset
`DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `AI_KEY_MASTER_KEY`,
`GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`,
`MISTRAL_API_KEY`, `DEEPSEEK_API_KEY`, `CEREBRAS_API_KEY`, and
`TOGETHER_API_KEY`; set `NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt`.
No secret values were read or printed.

## Gate commands

| Command | Exit code | Result |
|---|---:|---|
| `corepack pnpm exec vitest run --reporter=dot` with the 30 focused selectors listed below | 0 | 30 files / 557 tests passed |
| `corepack pnpm typecheck` | 0 | `tsc --noEmit`, no errors |
| `corepack pnpm lint` | 0 | 0 errors, 23 warnings |
| `corepack pnpm test` | 0 | 259 files / 2,799 tests passed |
| `corepack pnpm build` | 0 | Offline build; 12 dynamic routes generated |
| `bash scripts/claude/predeploy-check.sh` | 0 | 259 files / 2,799 tests passed; `PREDEPLOY: PASS — typecheck, lint, build and tests are green. Safe to commit and push.` |

The focused command selectors were:

```text
lib/ai/chat-plan.test.ts
lib/ai/model-call.test.ts
lib/ai/correction.test.ts
lib/ai/chat.correction.test.ts
components/chat/confirm.test.ts
components/chat/transcript.confirm.test.ts
components/chat/ChatPanel.test.tsx
components/chat/ChatReply.test.tsx
components/chat/ChatView.test.tsx
app/chat/actions.test.ts
app/chat/reply-messages.test.ts
app/chat/reply-messages.golden.test.ts
lib/ai/chat.regression.test.ts
lib/ai/chat.conversations.pglite.test.ts
lib/ai/chat.conversation.test.ts
lib/ai/chat.pglite.test.ts
lib/ai/chat.test.ts
lib/ai/key-store.test.ts
lib/ai/provider-deps.test.ts
lib/ai/provider-catalog.test.ts
lib/ai/providers/gemini.test.ts
lib/ai/providers/openai-compatible.test.ts
lib/ai/providers/errors.test.ts
lib/ai/boundaries.test.ts
lib/ai/capabilities/boundaries.test.ts
app/actions.boundary.test.ts
lib/ai/capabilities/registry.test.ts
lib/ai/capabilities/action-list.test.ts
lib/ai/capabilities/action-list.envelope.test.ts
lib/ai/capabilities/widgets/intent.test.ts
```

Vitest summary for the focused command: `Test Files 30 passed (30)`,
`Tests 557 passed (557)`, exit 0. The full-suite command summary was
`Test Files 259 passed (259)`, `Tests 2799 passed (2799)`, exit 0. The
predeploy script reran typecheck, lint, build, and tests and ended with its
PASS line above.

Execution note: an initial attempt to pass `--reporter=dot` through
`pnpm test` exited 2 before running tests because pnpm rejected that option.
The focused run used `pnpm exec vitest run --reporter=dot` successfully, and
the required unmodified `pnpm test` gate passed.

## Acceptance criteria → tests

| AC | Test evidence from this run | Status |
|---|---|---|
| AC1 — typecheck, lint, build, full suite and predeploy gates pass; no test assertion loosened; deliberate changes recorded | All five gates passed above. The plan §3.2 lists the intended test changes, and HANDOVER records the US-058 test changes and their reasons. No tests or code were edited during this verification. | MET |
| AC2 — confirm-category actions are proposed first; yes confirms; no does not execute; single-ETF clear and adds execute immediately | `lib/ai/chat-plan.test.ts` covers `needsConfirmation` cases for removal, untracking, multi-ETF clear/replace, single-ETF clear/replace and adds. `lib/ai/chat.test.ts` and `lib/ai/chat.pglite.test.ts` exercise proposal/confirmation, including no write before confirmation and execution after confirmation. `components/chat/transcript.confirm.test.ts` covers typed confirmation/cancellation and sends only the token to the confirmation action; the conversation PGlite suite includes D13/D14. | MET |
| AC3 — confirmation executes the shown plan; tampered, expired or stale plans are refused | `lib/ai/chat-plan.test.ts` exercises signing/verification, tampering and expiry; `lib/ai/chat.test.ts` confirms the stored plan without a new model interpretation; `lib/ai/chat.pglite.test.ts` exercises proposal-before-write and current-state confirmation behavior. Confirmation/reply UI and conversation tests also passed. | MET |
| AC4 — one correction round, correct action/reply, bounded calls and specific second-failure reason | `lib/ai/chat.correction.test.ts` exercises correction with fake fetch and the capped-call cases; `lib/ai/correction.test.ts` exercises bounded, closed correction text. The conversation and regression tests passed with these flows included. | MET |
| AC5 — provider-family structured modes and rejected-format fallback | `lib/ai/model-call.test.ts` covers mode selection, fallback, downgrade caching and call limits; `lib/ai/provider-catalog.test.ts`, `lib/ai/providers/openai-compatible.test.ts`, `lib/ai/providers/gemini.test.ts`, and `lib/ai/providers/errors.test.ts` cover provider modes, request shapes, and error classification. | MET |
| AC6 — key boundary, sanitised logs and closed operation set remain intact | `lib/ai/boundaries.test.ts`, `lib/ai/capabilities/boundaries.test.ts`, `app/actions.boundary.test.ts`, and `lib/ai/capabilities/registry.test.ts` passed. `lib/ai/key-store.test.ts` and the chat tests passed for signing-key derivation and chat safety paths; action-list and widget-intent tests passed for the closed operation set. | MET |

All AC1–AC6 are MET by the tests and gates run above.

MANUAL-QA/live-provider and Neon steps were not run, as requested; they are
not part of these offline acceptance-criterion gates. No live service, QA
server, deployment, migration, or Git command was used.

Denied or attempted commands: none.

## Round 2 — 2026-10-08

Verdict: **PASS**

Independent re-verification after the Round-1 review findings were fixed. Ran from the Windows
workspace with `corepack pnpm`; the predeploy gate ran under WSL login Bash. Before each gate,
removed `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `VERCEL_URL`, `VERCEL`,
`VERCEL_REGION`, `VERCEL_GIT_COMMIT_SHA`, `AI_KEY_MASTER_KEY`, and all eight configured
provider-key variables (`GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY`,
`OPENROUTER_API_KEY`, `MISTRAL_API_KEY`, `DEEPSEEK_API_KEY`, `CEREBRAS_API_KEY`,
`TOGETHER_API_KEY`). No variable values were read or printed.

### Gate commands

| Command | Exit code | Result |
|---|---:|---|
| `corepack pnpm exec vitest run --reporter=dot` with the US-058 focused selectors (including `lib/ai/chat.conversation.test.ts`, `lib/ai/chat.pglite.test.ts`, and `lib/ai/providers/gemini.test.ts`) | 0 | 30 files / 559 tests passed |
| `corepack pnpm typecheck` | 0 | `tsc --noEmit`; no errors |
| `corepack pnpm lint` | 0 | 0 errors, 23 warnings |
| `corepack pnpm test` | 0 | 259 files / 2,801 tests passed |
| `corepack pnpm build` | 0 | Offline build; migration skipped; all 12 dynamic routes generated |
| WSL login Bash: `bash scripts/claude/predeploy-check.sh` | 0 | Full predeploy PASS; 259 files / 2,801 tests; `PREDEPLOY: PASS — typecheck, lint, build and tests are green. Safe to commit and push.` |

The focused selectors covered the Round-1 fixes as well as the confirmation, correction,
provider-mode/fallback, key-store, operation-registry, and boundary tests. No source or test file
was edited during this verification. The Round-1 review's DEC-028 finding is treated as resolved:
the binding `strict: false` setting remains unchanged.

### Acceptance criteria → tests

| AC | Round-2 evidence | Status |
|---|---|---|
| AC1 — required gates; no behavior test loosened; deliberate changes disclosed | All gates above passed. The plan §3.2 and HANDOVER document the implementation's deliberate test changes. This independent run made no code/test edits and did not skip any test gate. | MET |
| AC2 — protected actions propose first; confirmation executes, cancellation does not; immediate actions remain immediate | `lib/ai/chat-plan.test.ts` exercises the confirmation classification for ETF removal, untracking, multi-ETF clear/replace, single-ETF edits, and additions. `lib/ai/chat.pglite.test.ts` CEP-C1 proves a removal leaves database state unchanged until confirmation and changes it only after confirmation. `components/chat/transcript.confirm.test.ts` covers typed/button confirmation, cancel, and discarding a plan for a new request. `lib/ai/chat.test.ts` and the conversation/PGlite coverage exercise proposal and immediate-action flows. | MET |
| AC3 — the exact shown plan executes; tampered, expired, changed-state and replayed plans are refused without unintended writes/provider calls | `lib/ai/chat.conversation.test.ts` CF-7/CF-8 confirms the signed proposal's exact action executes without a second model call; CF-3/CF-4 asserts changed state returns `state_changed` without execution; CF-9/CF-10 checks tampered and expired tokens are refused before state loading or execution, with provider calls unchanged. `lib/ai/chat.pglite.test.ts` CEP-C1 also verifies replay refusal, an unchanged post-confirm database snapshot, and no additional provider call. | MET |
| AC4 — one self-correction round, bounded model calls, final failure reason preserved | `lib/ai/chat.correction.test.ts` verifies an invalid first answer followed by a valid correction executes the corrected action once; a second invalid answer returns its specific reason without executing; provider failures and key-bearing text do not trigger an unsafe retry. `lib/ai/model-call.test.ts` covers normal/downgrade call caps and budget limits; `lib/ai/correction.test.ts` covers the closed, bounded correction text. **Coverage note:** the chat correction orchestration test injects a fake provider (rather than driving the adapters through fake `fetch`); provider transport/schema behavior is covered separately by the provider tests. | MET |
| AC5 — provider-specific structured output, fallback, and Gemini schema supports `"all"` | `lib/ai/model-call.test.ts` and `lib/ai/provider-catalog.test.ts` cover provider-family mode selection, downgrade/fallback, caching, and limits. `lib/ai/providers/gemini.test.ts` GM-S1 now asserts the converted `slot` is nullable `STRING` both in the converted schema and the actual Gemini request body; this closes the Round-1 schema gap. `lib/ai/providers/openai-compatible.test.ts` covers the OpenAI-compatible request (including DEC-028's `strict: false`), and provider error tests cover unsupported-format classification. | MET |
| AC6 — key boundary, sanitized handling, closed operation set, and boundary tests | `lib/ai/boundaries.test.ts`, `lib/ai/capabilities/boundaries.test.ts`, `app/actions.boundary.test.ts`, and `lib/ai/capabilities/registry.test.ts` passed in the focused and full suites. `lib/ai/key-store.test.ts` covers signing-key derivation; `lib/ai/chat-plan.test.ts`, `lib/ai/chat.test.ts`, action-list, and widget-intent tests cover token/chat safety and the closed action set. | MET |

All six acceptance criteria are MET by this run. No live service, QA server, production migration,
deployment, or Git command was used. Denied or attempted commands: none.

## Round 3 — 2026-10-09 (fallback independent tester; scope: AC4 / Sprint 13 audit C1 only)

Context: the designated `story-tester` alias could not launch, so a separate fallback context ran this round.
It did not write the round-3 fix. The audit's C1 finding was that the correction step sent only the first
validation failure, and that there was no multi-invalid test and no fake-fetch adapter correction test.
This round re-verifies only that fix. No source or test file was edited. Before running, `DATABASE_URL`,
`CRON_SECRET`, `VERCEL_ENV`, `AI_KEY_MASTER_KEY` and every `*_API_KEY` variable were removed from the
process environment; no value was printed.

### Gates run this round (own evidence)
| Command | Exit | Result |
|---|---|---|
| `corepack pnpm exec vitest run lib/ai/chat.correction.test.ts lib/ai/chat.test.ts lib/ai/providers/gemini.test.ts lib/ai/model-call.test.ts lib/ai/correction.test.ts` | 0 | 5 files / 86 tests passed (`chat.correction` 6, `chat` 64, `gemini` 10, `model-call` + `correction` 6) |
| `corepack pnpm typecheck` (`tsc --noEmit`) | 0 | no errors |

The only stderr lines were the two expected sanitised `[load-error] chat name=Error` lines from CE-W1 and CE-W2.

### Code inspection (fix present)
`lib/ai/chat.ts` `evaluateAttempt` (about lines 279-327) no longer returns at the first failure:
- It pushes every malformed, target-resolution and validation failure into `failures`.
- It returns the first failure's index, reason, symbol and field as the user-facing `invalid_action` fields, and all failures in `failures`.
- `handleChatMessage` (about lines 389-392) maps every entry of `eval1.failures` through `describeFailure` into the single `buildCorrectionMessages` call.
- It makes at most one correction request, and only when `caller.remaining() > 0` and the first answer contains no key material.

### AC4 mapping
| AC4 element | Evidence (this run) | Verdict |
|---|---|---|
| Invalid first answer, then a valid corrected answer, gives the correct actions and one reply | `chat.correction.test.ts` test 1: 2 provider calls; the correction carries the original user turn, the assistant answer and the correction message; the corrected action executes exactly once | MET |
| Every validation failure goes into the one correction request (audit C1) | test 2 "includes every validation failure in one correction request": the correction text contains both `action 1: unknown_field (BTBETRETF)` and `action 2: all_not_allowed`; 2 calls; execute called once | MET |
| Model calls never exceed the DEC-027 cap, shown with a fake `fetch` through a real adapter (audit C1) | test 3 drives the real Gemini adapter over a mocked `fetch`: 400 unsupported schema, then the json_object fallback answer with 2 invalid actions, then the valid correction. `fetch` is called exactly 3 times. Request 0 carries `responseSchema`; requests 1-2 do not. The correction lists both failures without the raw unknown field. `model-call.test.ts` covers the 2/3-call caps and the time budget. | MET |
| A second failure ends with the specific reason | test 4: second invalid answer gives `invalid_action` with reason `unknown_field`, 2 calls, no execution | MET |
| No unsafe or extra retry | test 5: a provider failure and an `answered` reply each make 1 call. test 6: a key-bearing answer is never sent for correction (1 call; no key in the outcome) | MET |

**AC4 verdict: MET.** Audit C1's required regression tests (multi-invalid; adapter/fake-fetch correction path with bounded calls) exist and pass in this run.

### Limits of this round
- AC1, AC2, AC3, AC5 and AC6, and the full suite, lint, offline build and predeploy gates, were **not re-run** here.
- Their status rests only on prior recorded evidence: Round 2 above (30 files / 559 tests focused; 259 files / 2,801 tests full; lint, build and predeploy green).
- The implementer's HANDOVER claims (full suite 259 files / 2,803 tests, lint, build, predeploy after the fix) were **not verified by this tester**.
- No live service, QA server, migration, deployment or Git command was used.

Denied or attempted commands: none.
