# US-045 — Multi-action widget chat capability

**Phase:** Plan  
**Round:** 0  
**Planning scope:** Implementation and test plan only; no application, test, status, or handover files changed.

## Binding sources and decisions

- Story: `dev_minions/backlog/stories/US-045.md` (AC1–AC8, drafted for PO confirmation).
- Sprint scope and sequence: `dev_minions/backlog/sprints/sprint-11.md`; approved constraints:
  `dev_minions/verification/SPRINT-11-review.md`, especially “Capability and multi-action chat”
  and “Intent/test migration”.
- Decisions: `dev_minions/decisions/DEC-022-history-widget-definition.md` §§4–7 and
  `dev_minions/decisions/DEC-017-ai-provider-layer.md` §§1–5.
- Requirements: FR17–FR19 in `dev_minions/requirements/etf-monitoring-requirements.md`.
- Existing patterns inspected: `lib/ai/chat.ts`, `lib/ai/capabilities/{types,registry,generate}.ts`,
  `lib/ai/capabilities/configuration/`, `lib/config/{widgets,etfs,tracked-fields,default-deps}.ts`,
  `app/chat/`, `components/chat/`, both message catalogues, and their current unit, PGlite,
  localization, and boundary tests.

DEC-022 settles the closed widget definition/actions, cross-capability 1–5 action list,
validate-before-write rule, input-order execution, stop/report behavior, and atomicity boundaries.
DEC-017 settles the provider/key boundary and capability-plugin boundary. The approved Sprint 11
review confirms these constraints and does not leave a product or technical decision open for
US-045. The raw-field question belongs only to US-046 and does not block this work.

## Bounded design

1. **One model call, shared envelope.** Preserve the existing one-generation-per-chat-message
   path through `bindGenerate`/`runGeneration`. Replace the old single-object / `{kind:"multiple"}`
   contract with one strict JSON envelope containing `actions`, length 1–5. Each entry carries a
   `capability` discriminator (`configuration` or `widgets`) and its closed action name and
   payload. Normalize a valid one-action list into the same execution path as a longer list.
   Reject malformed envelopes, unsupported capability/action names, missing or wrongly typed
   fields, and more than five actions as closed parser outcomes; never retain arbitrary model
   properties or include raw model/provider text in outcomes.
2. **Keep capability ownership explicit.** Extend the shared capability/action types and registry
   so configuration and widgets each own their action schemas, preflight validation, and
   execution mapping. The common interpreter parses the envelope once, then dispatches each
   action by its capability. Keep the existing configuration functions as the only route to
   `lib/config/etfs.ts` and `lib/config/tracked-fields.ts`; the widgets capability calls the
   existing `lib/config/widgets.ts` functions. No SQL, provider wiring, concrete provider, key
   reader, or key-bearing object is introduced into a capability.
3. **Keep model context minimal and validation state server-side.** The generation prompt includes
   only ETF symbols and the relevant adapter-catalogue field keys and RO/EN labels. Do not send
   ETF names, active/tracked state, saved widget definitions, report values/history, provider
   settings, or keys to the model. Keep configuration state, widget definitions, and the numeric
   catalogue available only to server-side grounding/preflight. Reuse `validateWidgetDefinition`
   as the sole definition gate; use config-owned read functions to obtain current widgets and
   available fields rather than adding SQL to AI code. The existing `createWidgetsConfigDeps`
   factory supplies the widget config boundary.
4. **Preflight the complete list before side effects.** Validate every configuration and widget
   action against the same pre-execution state before calling any write function. For widgets,
   check ETF existence, catalogue membership/numeric eligibility, definition shape, update/clear
   slot existence, and capacity/list limits; `widget_clear` accepts one existing slot or `"all"`,
   and `widget_replace` accepts at most six definitions (including an empty list). An invalid
   action identifies its one-based position and safe closed reason; no action executes. Do not
   reinterpret earlier proposed writes as part of later actions' preflight state.
5. **Execute in order and report honest partial results.** Only after all actions pass preflight,
   run them sequentially in input order using the existing `lib/config` functions. Mark completed
   actions `done`; on a thrown write/runtime error mark that action `failed`, stop, and mark every
   later action `not run`. Do not roll back earlier independent writes or imply a rollback.
   Preserve the `replaceWidgets` single-batch atomicity. Catch runtime failures at the orchestration
   boundary and expose only a fixed safe failure result, never the exception, SQL, URL, provider
   body, or secret.
6. **Render per-action outcomes and refresh changed ETF pages.** Extend the key-free chat outcome
   and reply-state shape to carry the ordered action results; render each result's `done`, `failed`,
   or `not run` status with localized messages. Preserve the existing single-action reply behavior
   and field-label locale selection. Revalidate each distinct ETF detail/configuration route whose
   action actually changed data; a failed or not-run action must not be reported as changed.
7. **Update supported-request help.** Extend the existing RO/EN instruction area with the four
   widget operations and the 1–5 action behavior/cap. Keep the existing key guidance and the
   deterministic pre-provider key-request refusal untouched. Do not alter provider presets,
   write-only key storage, model selection, schema/migrations, or raw-field/PDF extraction scope.

## Acceptance-criterion and test matrix

| AC | Planned evidence |
|---|---|
| **AC1 — closed widget capability (FR18, DEC-022 §§4, 6)** | Table-driven widget parser/preflight tests cover valid `widget_add`, `widget_update`, `widget_clear` for a slot and `"all"`, and `widget_replace`; reject each unknown operation/property, malformed/missing/wrongly typed value, unsupported field, invalid slot, missing ETF, nonnumeric/unknown catalogue field, and over-capacity definitions with closed outcomes. PGlite tests prove each valid action uses `lib/config/widgets.ts`, persists the expected result, and leaves tables unchanged on validation failure. |
| **AC2 — safe model boundary (FR18, DEC-022 §6; DEC-017)** | Prompt/context tests assert the model gets only symbols plus catalogue keys/labels needed for interpreting commands; seeded ETF names, active/tracked state, saved widget definitions, report values/history, settings, provider IDs/model, sentinel keys, and raw provider response text are absent. Mocked-provider end-to-end tests assert one generation call, structured JSON only, no eval/HTML rendering, no live fetch, and no SQL import from capabilities. |
| **AC3 — shared 1–5 action list (FR18, DEC-022 §7)** | Shared parser/interpreter tests cover one, two mixed-capability, and five ordered actions; six actions get the fixed split-request refusal. Preserve a single-action configuration command and verify it takes the same one-item path. Inventory and update only obsolete `{kind:"multiple"}` expectations; malformed output remains a closed error and is not mislabeled as a valid multi-action request. |
| **AC4 — validate-all-before-write (FR18, DEC-022 §7)** | Orchestrator tests put an invalid action first, middle, and last, including valid configuration/widget actions earlier in the list; assert zero config write calls and zero PGlite changes, and that the reply identifies the invalid one. A fully valid mixed list reaches execution only after every preflight passes. |
| **AC5 — ordered runtime results (FR18, DEC-022 §§5, 7)** | Fake-dependency tests assert input-order call sequence and `done` for each success. Inject a failure at each action position and assert prior `done`, current `failed`, later `not run`, stop-after-failure, sanitized reply, and no claimed cross-action rollback. Widget PGlite tests confirm `replaceWidgets` remains atomic within its write; existing config atomicity tests remain green. |
| **AC6 — configuration and widget composition (FR18, DEC-022 §7)** | Mixed lists exercise configuration→widget and widget→configuration success in the stated order, plus a later invalid action preventing all writes. A PGlite chat-path test observes both tracked-field/ETF state and `etf_widgets` state through the actual chat orchestrator. |
| **AC7 — localized instructions (FR17–FR18, DEC-022 §§6–7)** | RO/EN message-catalogue parity tests verify the four widget operations and 1–5 limit are present and agree with the closed set. `ChatView` tests render all instruction entries in both locales; ensure no claim about raw fields, arbitrary operations, or more than five actions. |
| **AC8 — offline regression and scope (FR18–FR19; DEC-016, DEC-022 §§7, 9; DEC-023)** | Focused intent/capability/chat/UI/boundary tests use fake providers and obvious fake keys only. PGlite is local; global/injected fetch is asserted unused. Boundary tests preserve no-SQL-in-actions, config-only writes, no provider/key access by capabilities, and key-status/key-store rules. Retain the one-action regression; assert no migration, dependency, raw-field, or extraction change. Final gates: `pnpm typecheck`, `pnpm lint`, focused story suite, full `pnpm test`, and offline `pnpm build`, with database/deployment/provider variables unset. |

## Implementation sequence

1. Inventory all `multiple`, single-action-shape, single-execution, and reply-union assertions in
   `lib/ai/capabilities/configuration/`, `lib/ai/chat*`, `lib/ai/capabilities/registry.test.ts`,
   `app/chat/`, and `components/chat/`; classify each as still-valid single-action regression or
   behavior intentionally replaced by DEC-022.
2. Define the common action envelope, closed 1–5 parser outcome, per-action validated intent, and
   ordered execution-result types. Update the shared prompt/schema to tag configuration and widget
   actions, preserving the user message as `user` data and preserving one provider generation.
3. Add the widgets capability and register it. Implement widget action parsing/grounding and
   server-side preflight through existing config interfaces; do not copy or bypass the widget
   validator or write functions.
4. Update configuration intent parsing/grounding to return the same shared list contract. Build a
   two-pass orchestrator in `lib/ai/chat.ts`: parse and validate every action first, then execute
   the validated list sequentially with stop-on-failure status reporting.
5. Adapt chat replies and Server Action cache revalidation for multiple results. Add bilingual
   supported-request and result/status strings; retain safe fixed handling for key requests and
   runtime errors.
6. Update import/safety boundary tests, old exact intent tests, chat tests and fixtures; add focused
   parser, widget capability, preflight/ordering, PGlite, reply-rendering, and RO/EN instruction
   cases. Run focused tests first, then typecheck, lint, full suite and offline build. Do not run
   live providers, BVB, Neon, Vercel, or migrations.

## Expected files

**New**

- `lib/ai/capabilities/action-list.ts`
- `lib/ai/capabilities/action-list.test.ts`
- `lib/ai/capabilities/widgets/capability.ts`
- `lib/ai/capabilities/widgets/context.ts`
- `lib/ai/capabilities/widgets/intent.ts`
- `lib/ai/capabilities/widgets/intent.test.ts`
- `lib/ai/capabilities/widgets/execute.ts`
- `lib/ai/capabilities/widgets/execute.test.ts`
- `lib/ai/capabilities/widgets/execute.pglite.test.ts`

**Changed — shared capability and chat path**

- `lib/ai/capabilities/types.ts`, `lib/ai/capabilities/registry.ts`
- `lib/ai/capabilities/configuration/{intent,grounding,prompt,interpret,capability,execute}.ts`
- `lib/ai/chat.ts`
- `lib/ai/capabilities/registry.test.ts`
- `lib/ai/capabilities/configuration/{intent,grounding,prompt,interpret,interpret.pglite}.test.ts`
- `lib/ai/chat.test.ts`, `lib/ai/chat.pglite.test.ts`
- `test/helpers/ai-config-context.ts`

**Changed — reply/UI/locales and boundaries**

- `app/chat/reply-messages.ts`, `app/chat/reply-messages.test.ts`
- `app/chat/actions.ts`, `app/chat/actions.test.ts`
- `components/chat/chat-state.ts`, `components/chat/ChatReply.tsx`, `components/chat/ChatReply.test.tsx`
- `components/chat/ChatView.tsx`, `components/chat/ChatView.test.tsx`
- `messages/en.json`, `messages/ro.json`
- `lib/ai/capabilities/boundaries.test.ts`, `lib/ai/boundaries.test.ts`

Existing `lib/config/widgets.ts`, its validator/write functions, `lib/config/default-deps.ts`
(`createWidgetsConfigDeps`), schema/migrations, provider/key modules, extraction code, and chat
key-request protection are reused and are not expected to change. No new dependency, live QA step,
source implementation, status-board, or HANDOVER edit is authorized by this plan. If implementation
proves a config-owned read/preflight helper is necessary, add its narrowly scoped test and update
the expected-file list before editing that file; do not put SQL or duplicate widget validation in
`lib/ai`.
