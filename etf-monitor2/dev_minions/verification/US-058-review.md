# US-058 — Independent review

## Round 1 — 2026-10-08

Verdict: **FAIL**

Reviewer: fresh independent review context, separate from the implementation. Read `AGENTS.md`,
`dev_minions/backlog/stories/US-058.md`, `dev_minions/verification/US-058-plan.md`,
`dev_minions/decisions/DEC-027-conversational-assistant.md`,
`dev_minions/decisions/DEC-028-us-058-json-schema-strictness.md`, the US-058 files-changed
sections in `dev_minions/HANDOVER.md`, and the relevant source/tests cited below. No tests,
typecheck, lint, build, live QA, or predeploy gate were run in this review; gate results below are
identified as implementation-reported, not independent execution.

### Acceptance criteria

- **AC1 — gates green, no weakened tests, deliberate changes disclosed: MET per the recorded
  implementation evidence; not independently re-run.** `HANDOVER.md` reports typecheck, lint,
  the full suite (259 files / 2,797 tests), offline build, and predeploy PASS, and records the
  deliberate call-count/request-format/confirmation test changes. This review did not reproduce
  those gates. No weakening is evident in the tests inspected. The plan/HANDOVER inventories
  `chat.confirm.test.ts`, `chat.confirm.pglite.test.ts`, `action-list.schema.test.ts`,
  `app/chat/reply-messages.confirm.test.ts`, `app/chat/actions.confirm.test.ts`, and
  `components/chat/ChatReply.confirm.test.tsx`, but those files are absent; relevant assertions
  are partly consolidated into other tests. See the coverage notes under AC2/AC3.

- **AC2 — confirmation before protected changes, plan shown, confirmation/cancel behavior:
  MET, with a non-blocking coverage note.** `needsConfirmation` protects `remove_etf` and
  `untrack_field`, and counts distinct ETFs across `widget_clear`/`widget_replace`
  (`lib/ai/chat-plan.ts`). The orchestration returns proposed results and a signed token before
  reaching `executeActions` (`lib/ai/chat.ts`); the PGlite `CEP-C1` test proves an ETF removal
  leaves the database unchanged until confirmation (`lib/ai/chat.pglite.test.ts`). Conversation
  fixtures exercise typed/button confirmation for untrack and multi-ETF clear proposals; the
  transcript tests verify typed confirmation sends only the token and cancel/discard does not
  invoke the confirmation action (`components/chat/transcript.confirm.test.ts`). The `yes`
  vocabulary is exact-match after folding, while other input discards the pending token and is
  treated as a new request (`components/chat/confirm.ts`, `components/chat/transcript.ts`).
  **Note:** the planned dedicated confirmation suite is absent, and there is no direct database
  assertion for the `"nu"`/`"no"` discard path; the client test proves it routes to a new request
  rather than confirming.

- **AC3 — execute the shown plan; refuse tampered, expired, or changed plans: NOT MET on the
  required test evidence.** The implementation is well-shaped on inspection: `confirmChatPlan`
  verifies the token, reloads configuration/widget state, compares the current fingerprint, and
  only then executes the signed plan; it does not resolve a provider or call a model
  (`lib/ai/chat.ts`). `chat-plan.ts` checks the HMAC before parsing/expiry, bounds token length,
  uses `timingSafeEqual`, and fingerprints active ETFs plus tracked fields/widgets for plan
  symbols. `chat-plan.test.ts` tests helper-level tampering/expiry/fingerprint behavior.
  However, the planned confirmation-service tests (`CF-7`/`CF-8`, `CP-5`..`CP-9`) are absent:
  no test calls `confirmChatPlan` with a tampered/expired token or confirms that a changed
  database state returns `state_changed` without writing. The current PGlite confirmation test
  proves the happy-path removal only. The acceptance criterion explicitly requires those refusal
  cases to be tested, so the unit-helper coverage does not close this gap.

- **AC4 — bounded self-correction, safe correction content, correct final outcome: MET, with a
  test-scope note.** `handleChatMessage` attempts correction only after invalid evaluation, only
  when a call remains, a raw response exists, and it does not contain key material. A provider
  failure on the correction preserves the first invalid outcome. `buildCorrectionMessages`
  limits previous output to 4,000 characters, limits failure lines to ten, and uses closed
  reasons/grounded context fields rather than echoing invented symbols, fields, titles, or free
  text (`lib/ai/correction.ts`). `chat.correction.test.ts` covers a corrected valid action, a
  second invalid answer, no retry on provider failure/success, and skipping correction for a
  key-bearing answer. `model-call.ts` enforces two ordinary calls, a third only for
  schema-to-object downgrade, a 45-second budget, and a five-second minimum remaining time;
  `model-call.test.ts` covers ordinary call caps and downgrade behavior. **Note:** the inspected
  correction test uses a fake provider rather than the plan's fake-fetch provider path, and there
  is no direct test combining downgrade plus correction at the three-call boundary. The inspected
  implementation enforces that boundary.

- **AC5 — provider-specific structured output and fallback: NOT MET.** DEC-028 is Decided and
  the implementation's OpenAI-compatible `strict: false` is correct; it must not be treated as a
  defect. The request-body test asserts `strict: false` (`lib/ai/providers/openai-compatible.test.ts`,
  `OC-S1`), and the catalog selects per-provider modes. However, Gemini's converted schema excludes
  a supported action value. `ANSWER_JSON_SCHEMA` declares `slot` as
  `["integer", "string", "null"]` (`lib/ai/capabilities/action-list.ts`), and
  `widget_clear` accepts `slot: "all"` (`lib/ai/capabilities/widgets/intent.ts`). The schema
  converter chooses the first non-null type with `types.find((t) => t !== "null")`, so the
  declared order becomes Gemini `INTEGER`, not the documented `STRING`
  (`lib/ai/providers/gemini.ts`, `toGeminiSchema`). The plan explicitly requires this mixed
  integer/string union to become `STRING`, after which normalisation handles numeric strings
  (`US-058-plan.md`, T-3). Consequently, Gemini's `responseSchema` cannot represent the valid
  `"all"` slot form; the regular widget-clear slot path is constrained even though server-side
  validation accepts it. `GM-S1` checks the envelope and general schema exclusions but never
  asserts the converted `slot` type (`lib/ai/providers/gemini.test.ts`). The JSON-object fallback
  does not address this because Gemini accepts the schema request rather than rejecting it.

- **AC6 — key boundary, sanitized handling, and closed operation set: MET by inspection of
  implementation and boundary tests.** Plan-key derivation uses a separate HKDF info string
  (`chat-plan/v1`) from provider-key encryption and preserves the no-key `null` case
  (`lib/ai/key-store.ts`; `KS-P1..P3` in `lib/ai/key-store.test.ts`). `provider-deps.ts` exposes
  the derived key through `getChatPlanSigningKey`, and `chat.ts` only uses it to sign/verify
  tokens. `lib/ai/boundaries.test.ts` keeps environment access in the existing key-status
  boundary and restricts imports/network primitives; action validation still resolves capability
  and operation through the closed registry before parsing/execution. These tests were inspected,
  not run in this review.

### Findings

1. **Blocking — AC5, Gemini schema conversion loses a valid `slot: "all"` value.** Keep the
   provider mode and the DEC-028 `strict: false` exception. Correct the union conversion (and add
   an assertion for the converted `slot` schema plus a request-body regression test) so Gemini's
   response schema permits `"all"` while numeric slot strings continue through the existing
   normaliser.
2. **AC3 test gap — confirmation refusal path is not exercised end-to-end.** Add the planned
   `confirmChatPlan` tests for tampering, expiry, state change, replay, and unchanged provider-call
   count/no writes. Existing token-helper tests and the happy-path PGlite test do not exercise the
   service refusal behavior required by AC3.

### Notes

- `DEC-028` is Decided: `strict: false` with the envelope-only OpenAI-compatible schema is the
  binding choice, and the current request body matches it.
- The implementation-reported gates in `HANDOVER.md` were not independently rerun for this
  review. No Git, secret, live-service, QA, deploy, or production migration operation was used.

## Round 2 — 2026-10-08

Verdict: **PASS**

Reviewer: independent round-2 source/test review. Read the US-058 story and plan, the Round-1
findings above, DEC-028, current implementation and tests, and the current implementation gate
record in `HANDOVER.md`. No tests or project gates were run by this review; no live QA was run.

### Acceptance criteria

- **AC1 — gates, no weakened behavior tests, deliberate changes disclosed: MET on recorded
  evidence; not independently re-run.** `HANDOVER.md` records the post-fix focused run (3 files /
  48 tests), typecheck, lint (0 errors / 23 warnings), full suite (259 files / 2,801 tests),
  offline build, and predeploy PASS. The independent tester's Round-1 verdict records its own
  complete gate run. I inspected the plan's deliberate-test-change list and the current
  round-2 additions; no weakened assertion is evident. I did not reproduce these gates.
- **AC2 — protected operations propose first; yes confirms, no does not confirm, safe operations
  can run immediately: MET.** `needsConfirmation` classifies removal/untracking and clear/replace
  across distinct ETFs in `lib/ai/chat-plan.ts`; `handleChatMessage` returns a `proposed` result
  before its execution path in `lib/ai/chat.ts`. `chat.test.ts` exercises proposals and
  confirmation, `chat.pglite.test.ts` (`CEP-C1`) snapshots the database before/after proposal and
  then confirms, and `transcript.confirm.test.ts` checks that confirmation submits only the token
  while cancel/discard does not call the confirmation action. The PGlite conversation fixture
  exercises the no-input/D13 and repeated destructive-request/D14 paths.
- **AC3 — execute the displayed plan and refuse tampered, expired, changed-state and replayed
  plans without unintended writes/provider calls: MET; Round-1 gap fixed.** The confirmation
  service verifies the signed token, reloads state and compares its fingerprint before calling
  `executeActions` (`lib/ai/chat.ts`, `lib/ai/chat-plan.ts`). `chat.conversation.test.ts` now
  exercises the service for tampering and expiry (CF-9/CF-10), asserting the specific refusal,
  no additional state load, no executor call, and no additional fake-provider call; it also
  exercises changed state (CF-3/CF-4), asserting `state_changed`, no execution and no additional
  provider call. `chat.pglite.test.ts` (`CEP-C1`) checks the initial proposal leaves the database
  snapshot unchanged, a valid confirmation changes state, and replay returns `state_changed`
  while preserving the post-confirm snapshot and provider-call count. The service has no provider
  resolution/call path.
- **AC4 — single self-correction, valid corrected action, bounded calls and specific second
  failure: MET, with the same non-blocking test-method note as Round 1.** `chat.correction.test.ts`
  verifies correction to a valid action, a second invalid answer's reason and no execution,
  single-call success/provider-failure paths, and suppression for key-bearing output.
  `model-call.test.ts` covers the ordinary two-call cap and three-call cap only for schema
  downgrade. Note: the correction orchestration test uses `createFakeProvider` rather than the
  plan's stated real-provider/fake-fetch setup; separate adapter/fetch tests cover request
  formation. The behavior and call-limit paths are exercised, but that planned integration-test
  shape is not present.
- **AC5 — structured output mode, fallback, and Gemini schema: MET; Round-1 finding fixed.**
  `toGeminiSchema` now maps the integer/string `slot` union to `STRING` independent of union order;
  `GM-S1` asserts both the converted schema and the actual Gemini request body's `slot` schema
  are `{ type: "STRING", nullable: true }`, with no enum restricting string values, so `"all"` is
  representable. `normaliseModelAction` still converts digit-only slot strings to integers
  (`NM-4`), and `NM-9` preserves `slot: "all"`. Provider modes and rejected-schema fallback are
  exercised by `provider-catalog.test.ts`, `model-call.test.ts`, `gemini.test.ts`, and
  `openai-compatible.test.ts`. The OpenAI-compatible `strict: false` request is correct under
  decided DEC-028.
- **AC6 — key boundary, sanitised handling, closed operations: MET by inspection and recorded
  test evidence.** `derivePlanSigningKey` uses the separate `chat-plan/v1` HKDF info and returns
  null without key material (`key-store.ts`); `chat-plan.ts` validates signed plans against the
  existing configuration/widget action lists. `boundaries.test.ts` retains the environment,
  importer, no-console, and network/import restrictions (LB-2/3/4/9/10); `registry.test.ts`
  pins the two capabilities and their closed action lists. The independent tester records these
  boundary/action tests passing.

### Round-2 findings disposition

1. **Round-1 AC5 Gemini slot-union defect — fixed.** The schema converter selects `string` for
   the mixed integer/string union; direct conversion and actual request-body assertions cover it.
   Numeric-string normalization and literal `"all"` preservation remain tested.
2. **Round-1 AC3 service-refusal test gap — fixed.** Service-level tampered, expired and
   changed-state refusals now assert no execution/provider call; the real PGlite test confirms
   replay refusal and no database change on replay.

No new blocking finding. The AC4 fake-provider-versus-fake-fetch test-method note is non-blocking:
the correction/call-budget behavior is asserted, while provider request formats are independently
covered with fake-fetch adapter tests. No Git, secret, live-service, QA, deploy, or production
migration operation was used.

## Round 3 — 2026-10-09

Verdict: **PASS — AC4 only**

Reviewer: independent fallback review after the designated `story-reviewer` alias could not
launch. Scope was limited to the Sprint 13 audit-reopened AC4 fix: the AC4 requirement, the audit
finding, `lib/ai/chat.ts`, `lib/ai/chat.correction.test.ts`, and directly related correction/model
call/Gemini adapter code needed to verify the requested fake-fetch flow. No tests or project gates
were run; no live resource or secret was accessed. This is not a review of other acceptance
criteria or gates.

### AC4 — self-correction: MET

- `evaluateAttempt` validates the full action list and continues after malformed entries,
  `resolveActionTargets` failures, and each expanded target's validation failure
  (`lib/ai/chat.ts`, `evaluateAttempt`). It retains the first failure's 1-based index, reason,
  optional symbol and field as the attempt's user-facing `invalid_action`, while keeping the
  complete failure list for correction. If correction cannot proceed because the provider call
  fails or is unavailable, `finalEval` remains the original evaluation. If the correction answer
  itself fails, its first failure becomes the final specific reason, matching the plan's
  attempt-2 replacement rule.
- The correction instruction is built from failure descriptions, not arbitrary raw action text:
  reasons come from validation, and symbols, field keys, operations, periods and slots are
  restricted to context/closed-set values (`lib/ai/correction.ts`). The previous model answer is
  intentionally retained only as bounded (4,000-character) assistant context; correction is
  suppressed if the first answer contains key material. The 10-line cap and overflow count are
  the plan's specified bounds. Tests assert an invented field is absent from the correction
  instruction, cover line/output bounds, and prevent a key-bearing answer from triggering a
  correction call (`chat.correction.test.ts`, `correction.test.ts`).
- The revised tests cover multiple independent failures in one correction instruction and prove
  the corrected action executes once (`chat.correction.test.ts`, “includes every validation
  failure…”). The added integration uses the actual `geminiProvider` with fake fetch: the first
  schema request receives a synthetic HTTP 400, the adapter/model caller downgrades to
  `json_object`, the second response has two validation failures, and the third request is the
  correction. It asserts the third response is executed, both failure reasons reach that
  correction instruction without echoing the invented field there, and fetch is called exactly
  three times—no fourth call (`chat.correction.test.ts`, “uses the real Gemini adapter…”).

No AC4 finding remains. The prior Sprint 13 audit Critical is closed for this criterion. No
unrelated acceptance criteria or implementation-reported gates are claimed as reviewed here.
