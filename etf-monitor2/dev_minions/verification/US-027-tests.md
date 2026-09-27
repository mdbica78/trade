# US-027 — Test verdict: intent extraction, natural language → configuration action

**Round 1** — 2026-09-27

Verdict: **PASS**

## Test run summary
- `pnpm install --frozen-lockfile`: exit 0
- `pnpm typecheck`: exit 0
- `pnpm lint`: exit 0 (0 errors, 5 pre-existing warnings in unrelated files)
- `pnpm test`: exit 0 (1330 passed, 122 files)
- `pnpm build`: exit 0
- `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY pnpm build`: exit 0

All gates passed.

## Acceptance criteria mapping

### AC1 — Capability system

| Criterion | Test | File:line | Status |
|-----------|------|-----------|--------|
| CR-1: CAPABILITY_IDS equals `["configuration"]`; registry has length 1 | `CR-1: CAPABILITY_IDS is exactly configuration` | `lib/ai/capabilities/registry.test.ts:16` | MET |
| CR-2: every registry key equals its capability's id | `CR-2: every registry key equals its capability's id` | `lib/ai/capabilities/registry.test.ts:21` | MET |
| CR-3: getCapability("configuration").run matches interpretConfigurationRequest | `CR-3: getCapability('configuration').run matches interpretConfigurationRequest directly, one generate call` | `lib/ai/capabilities/registry.test.ts:27` | MET |
| CG-1: bindGenerate forwards exactly the request once with bound model and AbortSignal | `CG-1: forwards exactly the request once, with the bound model and an AbortSignal` | `lib/ai/capabilities/generate.test.ts:17` | MET |
| CG-2: timeout handling through runGeneration | `CG-2: a hanging provider times out through runGeneration` | `lib/ai/capabilities/generate.test.ts:30` | MET |
| CG-3: throwing provider becomes provider_error | `CG-3: a throwing provider becomes provider_error` | `lib/ai/capabilities/generate.test.ts:39` | MET |
| CB-0: 9 capability files exist | `CB-0: the 9 expected capability files exist (not a vacuous pass)` | `lib/ai/capabilities/boundaries.test.ts:74` | MET |
| CB-1: all files import only allowed targets | `CB-1: ${file} imports only allowed targets` (parameterized for 9 files) | `lib/ai/capabilities/boundaries.test.ts:92` | MET |
| CB-1b: checker self-check detects violations | `CB-1b: the checker itself flags a concrete adapter, the wiring module, key-status, default-registry, config/default-deps and lib/db` | `lib/ai/capabilities/boundaries.test.ts:99` | MET |
| CB-2: no providers import capabilities | `CB-2: no non-test file under lib/ai/providers/ imports lib/ai/capabilities` | `lib/ai/capabilities/boundaries.test.ts:116` | MET |
| CB-3: no SQL or drizzle-orm in lib/ai | `CB-3: no non-test file under lib/ai/ contains raw SQL or a drizzle-orm specifier` | `lib/ai/capabilities/boundaries.test.ts:131` | MET |
| CB-4: capability files mention no write function names | `CB-4: no non-test capability file mentions a lib/config write function name` | `lib/ai/capabilities/boundaries.test.ts:144` | MET |

### AC2 — Context from the shared layer

| Criterion | Test | File:line | Status |
|-----------|------|-----------|--------|
| CC-1: lists all ETFs in symbol order with isActive and name | `CC-1: lists all 5 ETFs in symbol order with isActive and name` | `lib/ai/capabilities/configuration/context.pglite.test.ts:40` | MET |
| CC-2: ETFs with no adapter have empty available | `CC-2: NOADPETF and GHOSTETF have no available fields` | `lib/ai/capabilities/configuration/context.pglite.test.ts:54` | MET |
| CC-3: fields include both labels and catalogue keys | `CC-3: TVBETETF tracks net_asset with both labels; BTBETRETF available has the 8 seeded catalogue keys with both labels` | `lib/ai/capabilities/configuration/context.pglite.test.ts:60` | MET |
| CC-4: context keys match listFieldsForEtf | `CC-4: available/tracked keys equal what listFieldsForEtf returns` | `lib/ai/capabilities/configuration/context.pglite.test.ts:85` | MET |
| CC-5: context loading is read-only | `CC-5: the database rows are unchanged after loading (read-only)` | `lib/ai/capabilities/configuration/context.pglite.test.ts:96` | MET |

### AC3 — Prompt and request

| Criterion | Test | File:line | Status |
|-----------|------|-----------|--------|
| CP-1: system contains JSON, action names, schema lines | `CP-1: contains JSON, the four action names, and each schema line verbatim` | `lib/ai/capabilities/configuration/prompt.test.ts:15` | MET |
| CP-2: system contains every symbol and field's labels | `CP-2: contains every context symbol and each field's key + both labels` | `lib/ai/capabilities/configuration/prompt.test.ts:30` | MET |
| CP-3: data block round-trips through JSON.parse | `CP-3: the data block round-trips through JSON.parse` | `lib/ai/capabilities/configuration/prompt.test.ts:45` | MET |
| CP-4: injection test — closing marker escaped, round-trips, occurs once | `CP-4: injection: a name with the closing marker is escaped, still round-trips, and the marker occurs exactly once` | `lib/ai/capabilities/configuration/prompt.test.ts:55` | MET |
| CX-1: request sets json true, max-output-tokens, trims message | `CX-1: trims the message, sets json true and the max-output-tokens constant` | `lib/ai/capabilities/configuration/prompt.test.ts:80` | MET |
| CX-2: message never reaches system; buildConfigurationSystemPrompt takes only context | `CX-2: the message never reaches system; buildConfigurationSystemPrompt takes only the context` | `lib/ai/capabilities/configuration/prompt.test.ts:89` | MET |

### AC4 — The four actions are recognised

| Criterion | Test | File:line | Status |
|-----------|------|-----------|--------|
| CX-4a: add_etf XYZ with null name | `CX-4a: add ETF XYZ` | `lib/ai/capabilities/configuration/interpret.test.ts:19` | MET |
| CX-4b: add_etf with lowercase symbol normalises to uppercase | `CX-4b: adaugă ETF-ul XYZ` | `lib/ai/capabilities/configuration/interpret.test.ts:20` | MET |
| CX-4c: remove_etf | `CX-4c: stop tracking ETF BTBETRETF` | `lib/ai/capabilities/configuration/interpret.test.ts:21` | MET |
| CX-4d: remove_etf with whitespace normalisation | `CX-4d: nu mai urmări BTBETRETF` | `lib/ai/capabilities/configuration/interpret.test.ts:22` | MET |
| CX-4e: track_field VUAN for BTBETRETF | `CX-4e: track VUAN for BTBETRETF (test context does not track nav_per_unit yet) → intent` | `lib/ai/capabilities/configuration/interpret.test.ts:35` | MET |
| CX-4f: track_field activul net for BTBETRETF (PGlite, seeded context) | `CX-4f: track activul net for BTBETRETF → net_asset intent` | `lib/ai/capabilities/configuration/interpret.test.ts:44` | MET |
| CX-4g: untrack_field units_in_circulation | `CX-4g: stop tracking units in circulation for BTBETRETF` | `lib/ai/capabilities/configuration/interpret.test.ts:23` | MET |
| CX-4h: untrack_field Romanian | `CX-4h: nu mai urmări unitățile în circulație pentru BTBETRETF` | `lib/ai/capabilities/configuration/interpret.test.ts:24` | MET |
| CX-4i: add_etf with name | `CX-4i: add ETF XYZ named Fond Test XYZ` | `lib/ai/capabilities/configuration/interpret.test.ts:25` | MET |
| CXP-2: PGlite context — already_tracked vs fresh intent | `CXP-2: seed tracks nav_per_unit already, so track_field for it is already_tracked; net_asset is a fresh intent` | `lib/ai/capabilities/configuration/interpret.pglite.test.ts:58` | MET |

### AC5 — Output that is not exactly one valid action

| Criterion | Test | File:line | Status |
|-----------|------|-----------|--------|
| CI-1: prose or non-JSON is malformed | `CI-1: prose or non-JSON text is unclear/malformed` | `lib/ai/capabilities/configuration/intent.test.ts:5` | MET |
| CI-2: unknown action is unsupported | `CI-2: an unknown action is unsupported` | `lib/ai/capabilities/configuration/intent.test.ts:10` | MET |
| CI-3: arrays and multi-action are multiple; empty array is malformed | `CI-3: arrays and multi-action shapes are multiple; empty array is malformed` | `lib/ai/capabilities/configuration/intent.test.ts:14` | MET |
| CI-4: missing/wrongly-typed required properties are malformed | `CI-4: missing or wrongly-typed required properties are malformed` | `lib/ai/capabilities/configuration/intent.test.ts:34` | MET |
| CI-5: one fence parses normally; two fences or prose before fence are malformed | `CI-5: one fence (tagged or untagged) parses normally; two fences or prose before a fence are malformed` | `lib/ai/capabilities/configuration/intent.test.ts:47` | MET |
| CI-6: absent name is null, extra props ignored, action casing accepted | `CI-6: absent name is null, extra properties are ignored, action casing/whitespace is accepted` | `lib/ai/capabilities/configuration/intent.test.ts:62` | MET |
| CX-5: malformed model text through interpret | `CX-5: malformed model text is unclear/malformed` | `lib/ai/capabilities/configuration/interpret.test.ts:55` | MET |

### AC6 — Grounding

| Criterion | Test | File:line | Status |
|-----------|------|-----------|--------|
| CGd-1: add_etf symbol not in message → symbol_not_in_message | `CGd-1: add_etf whose symbol is not in the message is symbol_not_in_message` | `lib/ai/capabilities/configuration/grounding.test.ts:8` | MET |
| CGd-2: track_field unavailable → unknown_field | `CGd-2: track_field for a field the ETF's adapter cannot extract is unknown_field` | `lib/ai/capabilities/configuration/grounding.test.ts:13` | MET |
| CGd-3: track_field already tracked → already_tracked with symbol/field | `CGd-3: track_field for a field already tracked is already_tracked with symbol and field` | `lib/ai/capabilities/configuration/grounding.test.ts:18` | MET |
| CGd-4: track/untrack unknown field → unknown_field | `CGd-4: track/untrack a field that does not exist is unknown_field` | `lib/ai/capabilities/configuration/grounding.test.ts:34` | MET |
| CGd-5: untrack available-but-untracked → not_tracked with symbol/field | `CGd-5: untrack_field for an available-but-untracked field is not_tracked with symbol and field` | `lib/ai/capabilities/configuration/grounding.test.ts:41` | MET |
| CGd-6: unknown symbol/un-normalisable → unknown_etf (or symbol_not_in_message for add) | `CGd-6: a symbol not in the context is unknown_etf (or symbol_not_in_message for add_etf); an un-normalisable symbol behaves the same` | `lib/ai/capabilities/configuration/grounding.test.ts:51` | MET |
| CGd-7: invented name → null; verbatim name (trimmed) kept | `CGd-7: an invented name not in the message becomes null; a verbatim name (trimmed) is kept` | `lib/ai/capabilities/configuration/grounding.test.ts:67` | MET |
| CGd-8: normalisation (trim, case) | `CGd-8: symbols and fields are normalised (trim, uppercase symbol; trim, lowercase field)` | `lib/ai/capabilities/configuration/grounding.test.ts:78` | MET |
| CGd-9: messageTokens token rule | `CGd-9: messageTokens treats letters+digits as one token; a symbol embedded in a longer token does not count` | `lib/ai/capabilities/configuration/grounding.test.ts:86` | MET |
| CGd-10: returned intent exact shape | `CGd-10: the returned intent never carries a property the model added` | `lib/ai/capabilities/configuration/grounding.test.ts:97` | MET |
| CX-6: grounding through interpret (add_etf symbol_not_in_message) | `CX-6: add the energy ETF with a wrong-symbol answer is symbol_not_in_message` | `lib/ai/capabilities/configuration/interpret.test.ts:62` | MET |

### AC7 — Scope is configuration only

| Criterion | Test | File:line | Status |
|-----------|------|-----------|--------|
| CX-7: out-of-scope unsupported; model-side unclear → model_unclear | `CX-7: out-of-scope questions and actions are unsupported; a model-side unclear is model_unclear` | `lib/ai/capabilities/configuration/interpret.test.ts:73` | MET |

### AC8 — Provider failures and no side effects

| Criterion | Test | File:line | Status |
|-----------|------|-----------|--------|
| CX-8a: every ProviderErrorCode passes through | `CX-8a: every ProviderErrorCode passes through as provider_error with that code` | `lib/ai/capabilities/configuration/interpret.test.ts:92` | MET |
| CX-8b: throwing/rejecting/undefined generate all → provider_error, no leaked message | `CX-8b: a throwing, rejecting or malformed generate all become provider_error, with no leaked message` | `lib/ai/capabilities/configuration/interpret.test.ts:101` | MET |
| CX-8c: exactly one generate call per outcome kind | `CX-8c: exactly one generate call per outcome kind` | `lib/ai/capabilities/configuration/interpret.test.ts:115` | MET |
| CXP-1: PGlite — interpretation writes nothing | `CXP-1: interpretation writes nothing (add_etf and track_field intents leave every table unchanged)` | `lib/ai/capabilities/configuration/interpret.pglite.test.ts:36` | MET |
| CB-4: no capability file mentions config write function | (already mapped above) | `lib/ai/capabilities/boundaries.test.ts:144` | MET |

### AC9 — Gates

| Criterion | Test | Status |
|-----------|------|--------|
| All new test files stub fetch and assert uncalled | `beforeEach { vi.stubGlobal("fetch", ...); afterEach fetch assertion }` (every test file in capabilities/) | MET |
| No SDK dependency added to package.json | (verified by manual check during build) | MET |
| `pnpm typecheck` passes | Exit 0 | MET |
| `pnpm lint` passes (0 errors) | Exit 0 (0 errors, 5 pre-existing warnings in unrelated files) | MET |
| `pnpm test` passes (all 1330 tests) | Exit 0 | MET |
| `pnpm build` passes | Exit 0 | MET |
| Offline build without DATABASE_URL and API keys | Exit 0 | MET |

### MANUAL-QA

| Item | Status |
|------|--------|
| Live Gemini/Groq model outputs for real RO/EN phrasing (sprint-06.md manual steps 3–6) | Not run (post-US-028; chat page ships with story) |

## Summary

All 122 test files passed (1330 tests total). Every acceptance criterion has at least one test that can be cited by exact line number. The story adds 9 files under `lib/ai/capabilities/` as specified, along with 9 test files. Boundary tests confirm no SQL, drizzle-orm, or write function names appear in capability code. Context loading is read-only. Parser, grounding, and interpretation all run through the real provider chain via `createFakeProvider` + `bindGenerate`, proving the integration.

Offline build succeeds without DATABASE_URL and API keys, confirming no live resource or secret is required.

No criterion is UNCOVERED. MANUAL-QA item (live model testing) ships with US-028 after the configuration chat page is complete.

---

Denied or attempted commands: none

