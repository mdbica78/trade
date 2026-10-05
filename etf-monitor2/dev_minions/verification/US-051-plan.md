# US-051 plan: simplify the AI chat, capabilities, keys and widgets code

> story-planner, 2026-10-05. Binding text: `backlog/stories/US-051.md`, `verification/CODE-REVIEW-20261004.md`
> ("Rules for every Sprint 12 story" and §C items 1-14), DEC-016 §1-§2, DEC-017 §2/§4/§5, DEC-019, DEC-021 §5/§9,
> DEC-022 §7. No schema change, no migration, no new dependency, no message-key change, no route rename.
> Depends on US-050 being finished first (sequential sprint; nothing in this story touches US-050's files).

Nothing TECHNICAL is open. Planner-level points PL-1..PL-8 (§5) are settled here; the tech-lead can overrule any of
them at the sprint audit. There is no PRODUCT item: the one behaviour change (C10) is named as allowed in the story.
**Not blocked.** None of C1-C14 is blocked on a decision; five are partly or fully skipped because a test pins the
code (§0), which the story allows.

## 0. What the code and tests show (this shapes the plan)

1. **C11 "inline both entries in `registry.ts`" (deleting the two `capability.ts` files) is skipped (PL-1).** Four
   tests pin the files:
   - `lib/ai/capabilities/boundaries.test.ts` CB-0 requires `configuration/capability.ts` and `widgets/capability.ts`
     to exist; `lib/ai/boundaries.test.ts` LB-0 requires `capabilities/configuration/capability.ts`. AC3 says the
     boundary tests pass **unchanged**.
   - `lib/ai/capabilities/registry.test.ts` and `components/chat/ChatView.test.tsx` import `WIDGET_ACTIONS` from
     `widgets/capability`; both tests also import `CONFIGURATION_ACTIONS` from `configuration/intent`. Moving either
     constant means editing behaviour tests whose code is not deleted (rule 2). A local re-export is no way out:
     LB-2 forbids `export {…} from` in `lib/ai`.
   What C11 still does: delete `Capability.id` and `CAPABILITY_IDS`. Both have no production reader; only CR-1/CR-2
   read them. That is the only test edit in C11 (§3).
   HANDOVER line: `skipped: C11 inline capability files into registry.ts, reason: CB-0/LB-0 require both
   capability.ts files; registry.test.ts and ChatView.test.tsx import WIDGET_ACTIONS/CONFIGURATION_ACTIONS from
   their current files (rule 2, AC3)`.
2. **C12 `ai-keys.ts` `operations?` is a deliberate test seam: skipped.** `lib/config/ai-keys.pglite.test.ts`
   AK-P1..AK-P3 pass it to inject fake encryption material (`MATERIAL`) into `writeStoredProviderKey`. Without it the
   PGlite test would need `AI_KEY_MASTER_KEY`/`CRON_SECRET` in the environment, which DEC-015 forbids in tests.
   `lib/config/ai-keys.ts` is **not touched**. HANDOVER line: `skipped: C12 ai-keys operations? seam, reason:
   AK-P1..P3 inject fake encryption material through it (deliberate seam, DEC-015)`.
3. **C7 "`AiAvailability.providerId/model` never read" is skipped.** Three tests deliberately pin the key-free shape:
   `lib/ai/providers/resolve.test.ts` AR-9 ("exposes exactly the expected keys", a DEC-017 §4 key-boundary shape
   test), `lib/ai/provider-deps.test.ts` PD-3 and `lib/ai/provider-deps.pglite.test.ts` (both
   `toEqual({ available: true, providerId, model })`). HANDOVER line: `skipped: C7 drop AiAvailability.providerId/model,
   reason: AR-9/PD-3/provider-deps.pglite pin the exact key-free availability shape (key-boundary tests, AC3)`.
   The other C7 parts are done (§2).
4. **C8 "keep one of `storingEnabled` / `getProviderKeyStorageEnabled`" is skipped.** Each side of the LB-4 boundary
   needs its own name. LB-4 requires the exact `key-status` importer list `[key-store, provider-deps, settings-deps]`,
   so `settings-deps.ts` must keep importing `storingEnabled` from `key-status`. `app/admin/ai/page.tsx` must not
   import `key-status` (LB-4), and `app/admin/ai/page.test.tsx` mocks `getProviderKeyStorageEnabled` from
   `provider-deps`. The wrapper is already one line. HANDOVER line: `skipped: C8 merge storingEnabled /
   getProviderKeyStorageEnabled, reason: LB-4 importer list + page.test mock need both names`. The other C8 parts are
   done.
5. **C6 "trim once at the entry": the trim in `prompt.ts` stays.** `prompt.test.ts` CX-1 pins that
   `buildConfigurationRequest("  add ETF XYZ \n", …).user === "add ETF XYZ"`. So `chat.ts` keeps its entry trim (it
   needs it for the length check) and `prompt.ts` keeps its trim (CX-1). Only the middle trim in `interpret.ts` goes.
   HANDOVER line: `C6 done (partial): interpret.ts trim removed; prompt.ts trim kept, reason: CX-1 pins it`.
6. **Test-only exports.** The review's "Not in Sprint 12" list says "test-only exports … stay", while C3, C8 and C11
   name test-only exports to delete (`parseConfigurationOutput`, `encryptProviderKey`, `CAPABILITY_IDS`,
   `Capability.id`). Reading: a test-only export **named in a §C finding** is deleted (rule 2 allows it, with the test
   change listed); every other test-only export stays (PL-2). `encryptProviderKey` has no caller anywhere, tests
   included, so deleting it needs no test change.
7. **The shared `isRecord`/`hasOnlyKeys`/`validSlot`/`mergeWidgetChanges` helpers must live in
   `lib/config/widgets.ts`, not in a new `lib/config` file (PL-3).** The allowlists in CB-1 (`lib/config/etfs`,
   `tracked-fields`, `widgets`) and LB-2 (the same plus `default-deps`, `ai-settings`, `ai-keys`) are the only
   `lib/config` targets that capability files and `chat.ts` may import. A new file would fail CB-1/LB-2.
   `lib/config/home-display.ts`'s own `isRecord` copy is left alone: that file is outside this story's file list
   (US-052 owns it, and may import the helper from `./widgets`). Helper names must not contain any CB-4 write-function
   name (`addWidget`, `updateWidget`, `clearWidget`, `replaceWidgets`, `addEtf`, `trackField`, `untrackField`,
   `moveField`, …), because the non-execute capability files that import them are scanned for those substrings.
8. **C10: `listWidgetsForEtf` only ever returns `unknown_etf` as an error**, so `loadWidgetContext`'s
   `throw new Error("widget context unavailable")` cannot fire today. It is kept as a guard against the wider
   `WidgetError` type (it is not named in the review). No test calls `loadWidgetContext` directly; it is exercised
   through the `chat.pglite.test.ts` US-045 cases (real PGlite) and mocked in `chat.test.ts`.
9. **C4 under mocks.** `chat.test.ts` mocks `executeConfigurationIntent` to return `field: null`. Today, for a mocked
   `track_field`, `ChatActionResult.field` is still filled by `fieldForConfigurationIntent`. After C4 it is absent,
   because it now comes from the executed outcome. No `chat.test.ts` assertion reads `field`. In production both paths
   give the same object: `execute.ts` `fieldFromContext` does the same lookup on the same, unmutated context.
   `chat.pglite.test.ts` CEP-3 (real execute) asserts
   `field: { fieldKey: "net_asset", labelRo: "Activ net", labelEn: "Net asset" }`, which proves C4 end to end.
10. **C13 tone rule.** `isSuccess = capability === "widgets" || code ∈ {added, added_no_adapter, reactivated, removed,
    tracked, untracked}`. `execute.ts` sets `changed: true` for exactly those six codes and `false` for the rest, and
    `chat.ts` copies `configurationResult.changed` into `ChatActionResult.changed`. So `isSuccess =
    result.capability === "widgets" || result.changed`. The `reply-messages.test.ts` fixtures use `changed: false`
    for every code, but no assertion there checks a success tone (CRM-1 checks keys only; the "preserves a single
    configuration failure" case expects `info` for `not_tracked`, which stays `info`). A golden test with consistent
    fixtures is written first (§1 AC4) to pin the tone.
11. **No exact-markup test covers `ChatReply`** (`ChatReply.test.tsx` uses `toContain`). A golden snapshot is written
    and run **before** C13 (§1 AC4). This is the same method as US-050 (Vitest `toMatchSnapshot`, `.snap` committed).
12. **`noUncheckedIndexedAccess` is off** (`tsconfig.json`: `strict`, `target ES2017`, `lib esnext`). So
    `WIDGET_KEYS[result.action]` already types as `ChatReplyKey`, and the unreachable `?? "actionFailed"` can go with
    no cast. `Object.hasOwn` is available (lib esnext; server-only code, Node 24).
13. **Boundary/scope pins that the refactor must keep** (all pass unchanged):
    - LB-E3 (`app/load-error.boundary.test.ts`): `lib/ai/chat.ts` keeps the literal `logLoadError("chat"`.
    - LB-2: no `export {…} from` in any `lib/ai` file; every new import must be on its allowlist.
    - LB-5: `app/`/`components/` never mention `loadActiveProvider`, `resolveActiveProvider`, `ActiveProviderCall`,
      `ActiveProviderResolution`, `ProviderCallInput`, `ProviderCallContext`, and never import `providers/resolve`.
    - LB-4/LB-10: the importers of `key-status` and `key-store` are unchanged.
    - CV-4 (`components/chat/ChatPanel.test.tsx`): no file under `components/chat/` imports `lib/ai`.
    - `chat.test.ts` mocks `./capabilities/configuration/execute` and re-exports the real `configurationOutcomeFailed`
      from it. So `configurationOutcomeFailed` stays exported from `execute.ts`, and `chat.ts` keeps importing it from
      there.
    - `provider-deps.test.ts` PD-8 pins the order `settings` → `stored-start` → `stored-ready`, so `loadSettings` and
      `loadStoredKeys` stay **sequential** inside the shared helper (C7).

## 1. Acceptance criteria → tests

| AC | Proof |
|---|---|
| AC1 no behaviour change beyond C10 | `pnpm typecheck`, `pnpm lint`, offline `pnpm build`, full `pnpm test`, `bash scripts/claude/predeploy-check.sh`, all with `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `AI_KEY_MASTER_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY` unset. HANDOVER lists exactly the deliberate test changes in §3 and nothing else. New test files and new cases may be added. |
| AC2 multi-action behaviour (DEC-022 §7) | Unchanged and green: `lib/ai/chat.test.ts` (preflight at every position, both mixed orders, runtime failure at each position, four returned config failures, three no-ops, CE-7), `lib/ai/chat.pglite.test.ts` (CEP-*, both US-045 cases), `lib/ai/capabilities/action-list.test.ts` (max 5), `interpret.test.ts` ("accepts five … refuses six"), `app/chat/actions*.test.ts`, `app/chat/add-paths.pglite.test.ts`. **New, in `chat.test.ts`, written and run before C1/C2/C4 (must pass on old and new code):** **CE-G1**: list `[remove_etf BTBETRETF, widget_add BTBETRETF, remove_etf BTBETRETF]`, with `executeWidgetIntent` resolving `{ ok: false }` (the returned widget failure; today only thrown failures are tested). Exact `toEqual` on `outcome.results`: done (configuration, mock outcome), failed (widgets, `changed:false`, no `widget`), not_run (configuration, `changed:false`), indexes 1..3. **CE-G2**: the same list with the first `executeConfigurationIntent` rejecting. Exact `toEqual`: failed, not_run, not_run, with `executeWidgetIntent` not called. Use only `remove_etf`/`widget_*` actions in CE-G1/CE-G2, so §0.9's mock-only `field` difference cannot show up. |
| AC3 key boundary unchanged | Unchanged and green: `lib/ai/boundaries.test.ts` (LB-0..LB-11), `lib/ai/capabilities/boundaries.test.ts` (CB-0..CB-4-execute), `lib/config/boundaries.test.ts` (incl. BC-11), `app/actions.boundary.test.ts`, `lib/ai/providers/resolve.test.ts` AR-9, `provider-deps.test.ts` PD-1..PD-10, `provider-deps.pglite.test.ts`, `provider-deps.interchange.test.ts`, `key-status.test.ts`, `key-store*.test.ts`, `components/chat/ChatPanel.test.tsx` CV-4. No `boundaries.test.ts` file is edited. |
| AC4 chat replies identical (C13) | Unchanged and green: `app/chat/reply-messages.test.ts`, `components/chat/ChatReply.test.tsx`, `ChatView.test.tsx`, `ChatPanel.test.tsx`, `transcript.test.ts`, `app/chat/page*.test.tsx`. **New golden tests, written and run before any C13 edit; after the refactor they must match with no `-u`:** **G-R1** `app/chat/reply-messages.golden.test.ts`: `expect(chatOutcomeToReply(o)).toMatchSnapshot()` for: every `EXECUTION_CODES` single action with **consistent** fixtures (`changed: true` exactly for the six changing codes; `field` for the four field codes; `adapterKey` for `added`; `detectionReason` for `added_no_adapter`); single widget done with `changed:true, slot:1` and with `widget_clear` `changed:false, slot:null`; single thrown failure (configuration undefined); a 3-item list done/failed/not_run; a 2-item list with a returned config failure; every `interpreted` kind (each provider error, unsupported, too_many, malformed, model_unclear); `invalid_action`; `key_request`; every `unavailable` reason; `error`. **G-R2** (same file): `changedActions` for the 3-item list. **G-C1** `components/chat/chat-markup.golden.test.tsx`: `renderToStaticMarkup` of `ChatReply` in `ro` and `en` (with `NextIntlClientProvider`, as `ChatReply.test.tsx` does) → `toMatchSnapshot()`, for: single reply with `values`+`field`+`detectionReason`; `adminLink`; error tone; an `actions` list where one action has `field` and one has `detectionReason`, statuses done/failed/not_run. Commit both `.snap` files under `__snapshots__/`. |
| AC5 one registry, lookup used by `validateAction` | Unchanged and green: `registry.test.ts` CR-1 (as edited in §3: registry keys are exactly `["configuration","widgets"]`, actions equal the two closed sets). `chat.ts` `validateAction` calls `isCapabilityId` + `getCapability(id).actions` once (code review). **New, in `chat.test.ts`, before C3:** **CE-V1**: an action with capability `"widgets"` and action `"widget_delete"` gives `{ kind: "invalid_action", index: 1, reason: "unknown_operation" }`. An action with capability `"configuration"` and action `"set_cron_hour"` gives `reason: "unsupported"`. Capability `"toString"` (a prototype key) or `"cron"` gives `reason: "unsupported"`. A configuration action `"ADD_ETF"` gives `reason: "unsupported"` (proves §2 C3's dead trim/lowercase is unreachable). No write in any case. |
| AC6 HANDOVER record | One line per finding C1..C14 (`done`, `done (partial): …` or `skipped: <reason>`, using §0's exact lines for C6/C7/C8/C11/C12). Add `wc -l` before and after for every source file in §2. Take the "before" counts **before the first edit**. Documentation check, no test. |

Other new small tests (additions only, written before the change they guard, passing on old and new code):
- **IN-1** (`interpret.test.ts`): a generate double that resolves a malformed result (`null`, `{ ok: true, text: 5 }`,
  `{ ok: false, error: "weird_code" }`) gives `{ kind: "provider_error", error: "provider_error" }` (C6).
- **WI-1** (`widgets/intent.test.ts`): `widget_update` with slot `0`, `7`, `1.5` and `widget_clear` with slot `0`, `7`,
  `"2"` each give `{ ok: false, reason: "malformed" }` (C9 `validSlot` equivalence).
- **KS-6** (`key-status.test.ts`): `getEncryptionKeyMaterial` prefers a valid master key over a valid cron secret,
  falls back to cron when the master key is malformed, and returns `null` when both are invalid (C8). Add only the
  sub-cases not already in the existing material tests (lines ~60-76).
- **C10 allowed change, in `chat.test.ts`:** **CE-W1**: configuration-only list `[remove_etf BTBETRETF]` with
  `loadWidgetContext` mocked to reject → `executed_actions` with one `done` result, and `loadWidgetContext` not
  called. This **fails on the old code** (expected: it is the allowed change). **CE-W2**: list
  `[remove_etf BTBETRETF, widget_add …]` with `loadWidgetContext` rejecting → `{ kind: "error" }`, and no execute
  call. This passes on old and new code.

No criterion needs a live resource. The Codex QA spot-check is in the story.

## 2. Files and the change per finding (order of work)

**Step 0.** Run `wc -l` on every source file in the table below and record the counts in HANDOVER.
**Step 1.** Write G-R1/G-R2/G-C1, CE-G1/CE-G2, CE-V1, IN-1, WI-1, KS-6, CE-W2 and run them on the **unchanged** code
(all pass; the `.snap` files are created). Write CE-W1 (fails until C10 lands). Record in HANDOVER that the snapshots
predate the refactor.
**Step 2.** Apply the findings in this order: C9 (helpers first, others use them), C3, C11, C14, C1/C2/C4/C10
(`chat.ts`, one pass), C5, C6, C7, C8, C12, C13.

| File | Change |
|---|---|
| `lib/config/widgets.ts` | **C9.** Export `isRecord(value): value is Record<string, unknown>`, add and export `hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean` (`Object.keys(value).every(k => keys.includes(k))`), export the existing `validSlot`, and add and export `mergeWidgetChanges(existing: WidgetDefinition, changes: Record<string, unknown>): Record<string, unknown>`. Its body is today's literal `{ operation, fieldKey, periodUnit, periodAmount, ...(title === undefined ? {} : { title }), ...changes }`: copy the five definition fields explicitly, never spread `existing` (a `Widget` also carries `id/etfId/slot/updatedAt`). `updateWidget` uses `mergeWidgetChanges`. `validateWidgetDefinition`'s key check becomes `!hasOnlyKeys(input, [...])` (same as `Object.keys(…).some(k => !keys.includes(k))`). **C10.** `listWidgetsForEtf` no longer calls `resolveEtf`. It normalises the symbol, runs one statement `select "id" from "etfs" where "symbol" = ${normalised}` through `deps.run`, returns `unknown_etf` when there is no row, then calls `readWidgets`. `resolveEtf` (still used by add/update/clear/replace) is unchanged. `widgets.pglite.test.ts`'s faulty runner only wraps batches longer than 2 statements, so it is unaffected. |
| `lib/ai/capabilities/action-list.ts` | **C9.** Delete the local `isRecord` and import it from `../../config/widgets` (CB-1 allows it; server-only module). |
| `lib/ai/capabilities/configuration/intent.ts` | **C3.** Delete `parseConfigurationOutput`, `ConfigurationActionListOutcome` and the `ParsedActionListOutcome`/`ProviderErrorCode` imports. `ParsedOutput` becomes `{ kind: "action"; … } \| { kind: "unclear"; reason: "malformed" }`. `ConfigurationOutcome` becomes `{ kind: "intent"; intent } \| { kind: "unclear"; reason: UnclearReason; symbol?; field? }` (drop `unsupported`, `provider_error`, `too_many`). `parseConfigurationAction`: drop `.trim().toLowerCase()` and the `"unsupported"`/`"unclear"` action branches. Keep `if (!CONFIGURATION_ACTIONS.includes(value.action)) return malformed` (CI-2 pins `action: "widget_add"` → malformed), then `const action = value.action as ConfigurationAction`. Keep `UNCLEAR_REASONS` unchanged (`reply-messages` uses `model_unclear` from the action-list parser). **C9.** Import `isRecord`, `hasOnlyKeys` from `../../../config/widgets`; delete the local copies. |
| `lib/ai/capabilities/configuration/grounding.ts` | **C3.** Delete the `parsed.kind === "unsupported"` line. The `unclear` (malformed) line stays: it is reachable from `validateAction` through a structurally bad configuration action. Return type `ConfigurationOutcome` (now intent \| unclear). |
| `lib/ai/capabilities/widgets/intent.ts` | **C3.** Delete `widgetForSlot` (no caller), the identity `widgetError` (use `result.error` directly; `WidgetError` is assignable to `WidgetIntentError`), and the unused `Widget`, `WidgetError`, `WIDGET_OPERATIONS`, `WIDGET_PERIOD_UNITS` imports. The final fall-through becomes `return { ok: false, reason: "unknown_operation" };`: unknown actions never reach it from `chat.ts`, and the only test that reaches it ("widget_delete") expects `unknown_operation`. **C9.** Import `isRecord`, `hasOnlyKeys`, `validSlot`, `mergeWidgetChanges` from `../../../config/widgets`; delete the local `isRecord`/`hasOnlyKeys`. The update check uses `!validSlot(raw.slot)` in place of the three-part integer/range test. The clear check becomes `raw.slot !== "all" && !validSlot(raw.slot)`. The four per-action `Object.keys(raw).some(k => ![…].includes(k))` checks become `!hasOnlyKeys(raw, […])`. `merged` = `mergeWidgetChanges(existing, raw.changes)`. Error codes and their order are unchanged. |
| `lib/ai/capabilities/registry.ts`, `types.ts`, `configuration/capability.ts`, `widgets/capability.ts` | **C11 (partial, §0.1).** `Capability` = `{ readonly actions: readonly string[] }` (drop `id`). Remove `id:` from both capability objects. Delete `CAPABILITY_IDS`. **C3.** Add `export function isCapabilityId(value: unknown): value is CapabilityId { return typeof value === "string" && Object.hasOwn(CAPABILITY_REGISTRY, value); }`. `hasOwn`, not `in`: `"toString" in …` is true and would crash the lookup (CE-V1 pins it). |
| `lib/ai/providers/resolve.ts` | **C14.** `export const ACTIVE_PROVIDER_FAILURE_REASONS = ["not_configured", "unknown_provider", "not_implemented", "no_api_key", "no_model"] as const;` (same order as today's `CHAT_UNAVAILABLE_REASONS`) and `export type ActiveProviderFailureReason = (typeof ACTIVE_PROVIDER_FAILURE_REASONS)[number];`. |
| `lib/ai/chat.ts` | **C14.** `export const CHAT_UNAVAILABLE_REASONS = ACTIVE_PROVIDER_FAILURE_REASONS;` (exported name kept, no `export … from`), `ChatUnavailableReason` unchanged in meaning. **C3.** `validateAction`: `if (!isRecord(raw)) return malformed;` then `const { capability, action } = raw;` and one lookup `if (!isCapabilityId(capability) \|\| typeof action !== "string" \|\| !getCapability(capability).actions.includes(action)) return { ok: false, reason: capability === "widgets" ? "unknown_operation" : "unsupported" };`. Configuration branch: `grounded.kind === "intent" ? ok : { ok: false, reason: grounded.reason }`. Widgets branch unchanged. **C4.** Delete `fieldForConfigurationIntent`. **C1.** `actionDescriptor` returns `{ capability: action.capability, action: action.intent.action, symbol: action.intent.symbol }` (one branch). `executeActions` becomes one loop: for each action, if an earlier action failed, push `{ index, status: "not_run", ...descriptor, changed: false }`; otherwise `const step = await runAction(action, deps, configuration).catch(() => FAILED)`, push `{ index, ...descriptor, ...step }` and stop after a failed step. A private `runAction` returns, for configuration, `{ status: configurationOutcomeFailed(c.code) ? "failed" : "done", changed: c.changed, ...(c.field === null ? {} : { field: c.field }), configuration: c }` (one `configurationOutcomeFailed` call); for widgets, `w.ok ? { status: "done", changed: w.outcome.changed, widget: w.outcome } : FAILED`, where `FAILED = { status: "failed", changed: false }`. Object key order is not observable (`toEqual`/`toMatchObject`/snapshot formatting ignore it); keep `index, status, capability, action, symbol, changed, …` where free. **C2/C10.** `handleChatMessage` keeps the input checks and the key-request refusal before the try. Then **one** `try { … } catch { return { kind: "error" }; }` around: `depsFactory()`, `loadActiveProvider` (+ `unavailable` return), `loadConfigurationContext`, `interpretConfigurationRequest` (+ `interpreted` return), the widget context, validation of every action (+ `invalid_action` return), `executeActions`. Widget context: `const widgets = outcome.actions.some((a) => isRecord(a) && a.capability === "widgets") ? await loadWidgetContext(context, deps.widgets) : { etfs: [] };`. It is computed over the whole list before validating the first action, exactly where today's unconditional load sits, so a widget-containing list keeps today's failure behaviour. `getChatAvailability` is unchanged (keeps `logLoadError("chat"`). Imports: add `isRecord` from `../config/widgets`, `isCapabilityId` from `./capabilities/registry` and `ACTIVE_PROVIDER_FAILURE_REASONS` from `./providers/resolve` (it replaces the `ActiveProviderFailureReason` type import). Keep `ContextField` (still the type of `ChatActionResult.field`) and `ConfigurationContext` (still used by `validateAction`/`executeActions`). Drop the `ConfigurationIntent` type import only if it is no longer used. |
| `lib/ai/capabilities/widgets/context.ts` | **C10.** `const results = await Promise.all(configuration.etfs.map((etf) => listWidgetsForEtf(etf.symbol, deps)));`, then build `etfs` in configuration order: skip `unknown_etf`, and throw the same `Error("widget context unavailable")` on any other error (§0.8). |
| `lib/ai/capabilities/widgets/execute.ts` | **C5.** A local `done(intent, changed, slot): WidgetExecutionResult` builds `{ ok: true, outcome: { action: intent.action, symbol: intent.symbol, changed, slot } }`. Each case is `const result = await …; return result.ok ? done(intent, …) : { ok: false };`, with the same `changed`/`slot` values as today (`true`/`result.value.slot`; `true`/`intent.slot`; `result.value > 0`/`intent.slot === "all" ? null : intent.slot`; `true`/`null`). CB-4-execute still finds the four write-function names. |
| `lib/ai/providers/run-generation.ts` | **C6.** Export `normaliseResult` (body unchanged). CB-1/CB-2 allow capabilities → `providers/run-generation`. |
| `lib/ai/capabilities/configuration/interpret.ts` | **C6.** Delete `isGenerateResult` and the `PROVIDER_ERROR_CODES` import. `const request = buildConfigurationRequest(message, context);` (no local trim, §0.5). `let result: GenerateResult; try { result = normaliseResult(await generate(request)); } catch { return { kind: "provider_error", error: "provider_error" }; }`, then `if (!result.ok) return { kind: "provider_error", error: result.error }; return parseActionListOutput(result.text);`. The try/catch around `parseActionListOutput` goes: that function catches everything itself. A malformed result or an unknown code becomes `provider_error`/`provider_error`, as today (IN-1). |
| `lib/ai/provider-deps.ts` | **C7.** A private `async function resolveFromDeps(deps: ProviderDeps): Promise<ActiveProviderResolution>` holds the sequential `loadSettings` → `loadStoredKeys` → `resolveActiveProvider({ …, readApiKey: (id) => storedKeys.get(id)?.key ?? deps.readApiKey(id) })` (PD-8 order kept). `loadActiveProvider` and `getAiAvailability` call it. `ActiveProviderResolution` is imported as a type from `./providers/resolve` (LB-5 only scans `app/`/`components/`). `getKeyStatuses(env)` with no ternary (a default parameter applies on `undefined`). `export type ProviderKeyStatusView = ProviderKeyStatus & { source: "stored" \| "environment" \| "none"; updatedAt: string \| null };`, with `ProviderKeyStatus` type-imported from `./key-status` (already imported). The view mapping stays explicit, field by field. `getProviderKeyStorageEnabled` stays (§0.4). |
| `lib/ai/key-status.ts` | **C8.** `getEncryptionKeyMaterial(env)` = `getEncryptionMaterialForSource("master", env) ?? getEncryptionMaterialForSource("cron_derived", env)`. `getKeyStatuses`: `isSet: readApiKey(provider.id, env) !== null` (same trim/blank rule; KS-1/KS-2 green). Keep the file's doc comments, and keep `process.env` only here (LB-3). |
| `lib/ai/key-store.ts` | **C8.** Delete `encryptProviderKey` (no caller, tests included). Everything else is unchanged; `getEncryptionKeyMaterial` is still used as `writeStoredProviderKey`'s default. |
| `lib/config/ai-settings.ts` | **C12.** One private `normaliseOptionalText(raw: unknown, accept: (trimmed: string) => boolean)`: `null`/`undefined`/blank after trim → `{ ok: true, value: null }`; non-string or `!accept(trimmed)` → `{ ok: false }`; else `{ ok: true, value: trimmed }`. Provider: `accept = (v) => providerIds.includes(v)`. Model: `accept = (v) => v.length <= AI_MODEL_MAX_LENGTH`. `setAiSettings` is unchanged otherwise (AV-1..AV-5 green). |
| `components/chat/chat-state.ts` | **C13.** `type ChatReplyValues = { symbol?: string; adapter?: string; max?: number; index?: number; slot?: number };` and `type ChatReplyContent = { messageKey: ChatReplyKey; values?: ChatReplyValues; field?: { ro: string; en: string }; detectionReason?: Exclude<DetectionReason, "detected"> };`. `ChatReplyState = ChatReplyContent & { tone; adminLink?: true; actions?: readonly ChatActionReplyState[] }`. `ChatActionReplyState = ChatReplyContent & { index: number; status: "done" \| "failed" \| "not_run" }`. Export `ChatReplyContent`. This is a type-only change; every existing fixture still type-checks (action values only gain two optional keys). |
| `components/chat/ChatReply.tsx` | **C13.** One local helper `const textOf = (item: ChatReplyContent): [string, string] => { const field = item.field?.[locale]; return [t(item.messageKey, { ...item.values, ...(field !== undefined ? { field } : {}) }), item.detectionReason !== undefined ? \` (${tReason(item.detectionReason)})\` : ""]; }`. Top level: `const [text, reasonText] = textOf(reply);` and the same `<p>{text}{reasonText}…`. Each action: `const [actionText, actionReason] = textOf(action);` then `{actionText}{actionReason}`. Both places keep exactly two string children (the second is `""` when there is no reason), as today, so the markup is identical (G-C1). `actionStatuses`, `<span>`, `<strong>`, the `key` and `role` are unchanged. |
| `app/chat/reply-messages.ts` | **C13.** `WIDGET_KEYS: Record<string, ChatReplyKey>` lookup without `?? "actionFailed"` (§0.12; that branch is only reached for widget `done` results, whose `action` is always one of the four keys). Single-action branch: `const isSuccess = result?.capability === "widgets" \|\| result?.changed === true;` (§0.10), replacing the six-code array. Nothing else changes; every message key, the tone order and `changedActions` are unchanged. |
| `components/admin/AiSettingsAdmin.tsx` | **C7.** Delete the `ProviderOption` alias (use `AiProviderOption`) and the local `KeyRow` type. `keyRows: readonly ProviderKeyStatusView[]`, via `import type { ProviderKeyStatusView } from "@/lib/ai/provider-deps";`. It is a type-only import, erased at build. `AiSettingsAdmin` is a server component. LB-4 only flags `key-status`/`key-store` specifiers, and LB-5 does not forbid this name. Markup is unchanged. |

Not touched, with the reason (for the HANDOVER record):
- `lib/config/ai-keys.ts`: §0.2.
- `lib/monitoring/widget-engine.ts`: no §C finding names it (its two functions have no duplicate of a C9 helper).
- `components/admin/ProviderKeySaveForm.tsx`: no §C finding names it. Its local action type is one of the 13 copies in
  review D2 (US-052).
- `app/admin/ai/*`: no §C finding. `page.tsx` keeps `getProviderKeyStorageEnabled` (§0.4); `actions.ts` is D1 (US-052).
- `lib/ai/capabilities/configuration/prompt.ts`: §0.5 (CX-1).
- `lib/ai/capabilities/configuration/execute.ts`: `configurationOutcomeFailed` and `fieldFromContext` stay (§0.13,
  C4 reads its output).
- `lib/ai/settings-deps.ts`, `components/chat/ChatView.tsx`, `ChatPanel.tsx`, `transcript.ts`, `app/chat/actions.ts`,
  `app/chat/page.tsx`, `components/admin/AiProviderModelFields.tsx`: no finding.
- `lib/config/home-display.ts`: §0.7 (US-052's file).

## 3. Deliberate test changes (the only edits to existing tests)

1. `lib/ai/capabilities/configuration/intent.test.ts`, **CI-4** "parses a tagged single JSON action …". Reason: C3
   deletes the test-only `parseConfigurationOutput`. The edit keeps both object assertions, calling
   `parseConfigurationAction` on the object literal instead of on its JSON text: a missing `name` gives `name: null`,
   and an extra `"extra"` key gives malformed. It drops the `"prose"` assertion, which only exercised the deleted
   `JSON.parse` wrapper; invalid JSON at the real entry is still covered by `interpret.test.ts` ("not json") and
   `action-list.test.ts`. The import drops `parseConfigurationOutput`.
2. `lib/ai/capabilities/registry.test.ts`, **CR-1**. Reason: C11 deletes the test-only `CAPABILITY_IDS`.
   `expect(CAPABILITY_IDS).toEqual(["configuration", "widgets"])` and `toHaveLength(2)` become one assertion of the
   same strength, `expect(Object.keys(CAPABILITY_REGISTRY)).toEqual(["configuration", "widgets"])`. The import drops
   `CAPABILITY_IDS`. All other CR-1 lines are unchanged.
3. `lib/ai/capabilities/registry.test.ts`, **CR-2** "every registry key equals its capability's id": deleted. Reason:
   C11 deletes the test-only `Capability.id`. CR-1 still pins the keys.

No other existing test is edited, deleted or loosened. In particular, no `boundaries.test.ts`, `chat.test.ts`,
`reply-messages.test.ts`, `widgets/intent.test.ts`, `provider-deps*.test.ts` or `resolve.test.ts` line changes (only
new cases are appended, §1). If one fails, the refactor is wrong. Fix the code, not the test.

## 4. Data model / migration

None. One read changes its statement list: `listWidgetsForEtf` drops the unused `field_catalog` join (C10, one
statement in its first batch instead of two). No schema change, no `pnpm db:generate`. `data-model.md` is
unaffected. It documents widget writes (BC-11) and the key table (LB-11), and neither changes.

## 5. Risks and planner-level points (settled)

- **PL-1** C11 keeps both `capability.ts` files and the two constants' locations (§0.1). **PL-2** Only the test-only
  exports named in a §C finding are deleted (§0.6). **PL-3** The shared validators go in `lib/config/widgets.ts`
  (§0.7). **PL-4** `isCapabilityId` uses `Object.hasOwn` (CE-V1). **PL-5** C13's tone rule is
  `widgets || result.changed` (§0.10), pinned by G-R1. **PL-6** Golden snapshots first (§0.11), the only way to prove
  "identical replies/markup" where no exact test exists. **PL-7** `loadSettings`/`loadStoredKeys` stay sequential
  (PD-8). **PL-8** The widget context is loaded when **any** action in the list has `capability: "widgets"`, before
  validation starts, so only all-configuration lists change behaviour (the allowed C10 change).
- **Risk: parallel widget reads under PGlite.** The test runner wraps each batch in `pg.transaction`. PGlite runs
  transactions exclusively, so `Promise.all` over several `listWidgetsForEtf` calls is serialised safely in tests. In
  production, neon-http batches are independent HTTP requests. If the US-045 `chat.pglite.test.ts` cases fail only
  because of concurrency, the fallback is to keep the sequential loop (still dropping the join) and log
  `C10 done (partial): parallel load reverted, reason: <the error>`. Do not change the test helper.
- **Risk: the golden snapshots are generated after a source edit, so they prove nothing.** Mitigation: step 1 runs
  them first, and HANDOVER records it. The reviewer checks that the `.snap` files predate the source edits (file
  times in `.files-touched.log`/`.checkpoint.md`).
- **Risk: the single `try` in `handleChatMessage` swallows a programming error in validation.** That is the same as
  today: validation was already inside the last try.
- **Risk: CB-4 substring scan.** A new helper name containing a write-function name (e.g. `updateWidgetSlot`) would
  fail CB-4 in `widgets/intent.ts`. Use the names in §2.
- **Smallest design.** One new private function each in `chat.ts` (`runAction`) and `provider-deps.ts`
  (`resolveFromDeps`); four exported helpers in `lib/config/widgets.ts`; one exported guard in `registry.ts`; one
  exported constant in `resolve.ts`; one exported type in `chat-state.ts`. No new file except the two golden tests.
  Expected line drop: `chat.ts` about 60-75, `widgets/intent.ts` about 20, `interpret.ts` about 15,
  `configuration/intent.ts` about 20, `execute.ts` (widgets) about 15, `provider-deps.ts` about 15,
  `ai-settings.ts` about 12, others about 30. That is about 180-200 in total, under the review's estimate of 230
  because of the §0 skips.

## 6. Decisions needed

None. Every item is TECHNICAL and settled by the code review and §5. There is no PRODUCT item: the only behaviour
change (C10) is named as allowed in the story. Nothing is BLOCKED ON A DECISION.

## 7. Files changed (expected)

- new tests: `app/chat/reply-messages.golden.test.ts`, `app/chat/__snapshots__/reply-messages.golden.test.ts.snap`,
  `components/chat/chat-markup.golden.test.tsx`, `components/chat/__snapshots__/chat-markup.golden.test.tsx.snap`
- changed (source): `lib/ai/chat.ts`, `lib/ai/capabilities/registry.ts`, `lib/ai/capabilities/types.ts`,
  `lib/ai/capabilities/configuration/capability.ts`, `lib/ai/capabilities/widgets/capability.ts`,
  `lib/ai/capabilities/action-list.ts`, `lib/ai/capabilities/configuration/intent.ts`,
  `lib/ai/capabilities/configuration/grounding.ts`, `lib/ai/capabilities/configuration/interpret.ts`,
  `lib/ai/capabilities/widgets/intent.ts`, `lib/ai/capabilities/widgets/execute.ts`,
  `lib/ai/capabilities/widgets/context.ts`, `lib/ai/providers/run-generation.ts`, `lib/ai/providers/resolve.ts`,
  `lib/ai/provider-deps.ts`, `lib/ai/key-status.ts`, `lib/ai/key-store.ts`, `lib/config/widgets.ts`,
  `lib/config/ai-settings.ts`, `app/chat/reply-messages.ts`, `components/chat/chat-state.ts`,
  `components/chat/ChatReply.tsx`, `components/admin/AiSettingsAdmin.tsx`
- changed (tests, additions only): `lib/ai/chat.test.ts` (CE-G1, CE-G2, CE-V1, CE-W1, CE-W2),
  `lib/ai/capabilities/configuration/interpret.test.ts` (IN-1), `lib/ai/capabilities/widgets/intent.test.ts` (WI-1),
  `lib/ai/key-status.test.ts` (KS-6)
- deliberate test changes: `lib/ai/capabilities/configuration/intent.test.ts` (CI-4),
  `lib/ai/capabilities/registry.test.ts` (CR-1, CR-2), §3
- not touched: `lib/config/ai-keys.ts`, `lib/monitoring/widget-engine.ts`, `components/admin/ProviderKeySaveForm.tsx`,
  `app/admin/ai/*`, `lib/ai/capabilities/configuration/prompt.ts`, `lib/ai/capabilities/configuration/execute.ts`,
  every `boundaries.test.ts`, `messages/*.json`, `drizzle/`, `lib/db/schema.ts`, `package.json`, lockfile
