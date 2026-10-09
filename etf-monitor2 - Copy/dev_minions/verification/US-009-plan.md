# US-009 plan: Adapter interface and registry

Planned by story-planner (opus), 2026-09-23.

Not blocked. No decision is needed (section 5).

Sources read: story US-009, downstream stories US-010 and US-011 (the first consumers of this
contract), sprint-02.md, SPRINT-02-review.md, requirements section 3 and FR3, FR4, FR5, FR10,
FR13, `architecture/data-model.md` (`etfs.adapter_key`, `field_catalog`, `reports.report_date`,
`report_values.numeric_value`/`raw_value`, and the note that `field_key` is not an FK),
`lib/db/seed-data.ts`, the delivered `lib/extraction/{http,pdf,discovery}.ts` (for code style
and module boundaries), `package.json`, `tsconfig.json`, `vitest.config.ts`,
`eslint.config.mjs`, and US-008-plan.md (the format reference).

This story adds pure TypeScript only. It adds no dependency and changes no config. It touches
no DB, UI, route or migration.

---

## 1. Acceptance criteria and the tests that prove them

All new code lives in `lib/extraction/adapters/`. The fake adapters are defined in the test
files (story Task 4). Shared test helper, local to each test file:
`fakeAdapter({ key, fieldKeys, marker })`. Its `canHandle` is `vi.fn((t) => t.includes(marker))`
and its `extract` is `vi.fn(() => ({ ok: false, error: "fake" }))`, so each test can check
which methods were called.

| AC | Criterion (restated) | Proof |
|---|---|---|
| AC1 | The contract (`ExtractionAdapter`, `ExtractedValue`, `ExtractionResult`) exists and is exported, with the story's semantics: `reportDate` is `YYYY-MM-DD`, each field has a canonical `numericValue` plus a verbatim `rawValue`, unfound fields go in `missingFields`, and unusable text gives `ok: false` with `error`. | `types.test.ts` › "contract (AC1)". **Compile-time part**, proved by `pnpm typecheck`, which includes test files because tsconfig covers `**/*.ts`. (a) A fake adapter declared with `satisfies ExtractionAdapter` compiles. (b) `// @ts-expect-error` on an `ok: true` result with no `reportDate`, on one with no `missingFields`, on an `ok: false` result with no `error`, and on an `ExtractedValue` with no `rawValue`. If a required member is dropped from the types, the directive becomes unused and typecheck fails. (c) `expectTypeOf<ExtractionAdapter["fieldKeys"]>().toEqualTypeOf<readonly string[]>()` and `expectTypeOf<Parameters<ExtractionAdapter["extract"]>>().toEqualTypeOf<[string]>()`. The second one pins "text only" at the type level. **Runtime part**: narrowing on `result.ok` gives access to `values` and `missingFields` in one branch and to `error` in the other. **Semantics**: the reviewer checks that the JSDoc on each type states the rules from story Task 1 (canonical format, verbatim raw, every extractable field returned, which fields to persist is the caller's choice, `ok: false` when there is no report date, adapters are pure and must not throw). The rules themselves are enforced by `validateExtractionResult` (AC5). |
| AC2 | `get(registeredKey)` returns that adapter. `get(null)`, `get(undefined)` and `get("unknown-key")` return `undefined`, never throw, and never fall back to another adapter. | `registry.test.ts` › "get (AC2)". Use a registry of two fakes `fake-a` and `fake-b`. `get("fake-a")` `toBe` the fake-a object (same identity), and likewise for `fake-b`. Each of these returns `undefined`, wrapped in `expect(() => …).not.toThrow()`: `null`, `undefined`, `"unknown-key"`, `""`, `"FAKE-A"` (no case folding), `" fake-a"` and `"fake-a "` (no trimming), and the prototype keys `"constructor"`, `"__proto__"`, `"toString"` and `"hasOwnProperty"` (R1). An **empty registry** returns `undefined` for `get("fake-a")`, which is the "no fallback even when there is exactly one candidate" case. Also check that `get` never calls `canHandle` or `extract` (the `vi.fn`s were not called), which proves `get` is a lookup and not detection. |
| AC3 | `createAdapterRegistry` throws a clear error when two adapters share a key. | `registry.test.ts` › "duplicate key (AC3)". `expect(() => createAdapterRegistry([fakeA, fakeA2])).toThrow(/duplicate.*"fake-a"/i)`, where `fakeA2` is a different object with the same key. The message must name the key. Also test three adapters with the duplicate in positions 1 and 3. Hardening (not an AC; see section 2): an empty key throws, and an adapter whose `fieldKeys` repeats a key throws. Both errors name the adapter. |
| AC4 | `detect(text)` returns the single adapter that claims the text. It returns `undefined` when none claims it and when two or more do. | `registry.test.ts` › "detect (AC4)". Fakes use markers `A`, `B` and `C`. (1) Text containing only `A` returns fakeA (identity). (2) Text with no marker returns `undefined`. (3) Text with `A` and `B` returns `undefined`. (4) Three adapters, text with `A` and `C`, returns `undefined`. (5) An empty registry returns `undefined`. (6) In case (1), **every** adapter's `canHandle` was called exactly once with the text. This proves detection does not stop at the first match, which is what makes ambiguity detectable (R2). (7) `extract` is never called by `detect`. |
| AC5 | `validateExtractionResult` reports a violation for each broken rule (one test per rule) and none for a valid result. | `validate.test.ts` › "validateExtractionResult (AC5)". Baseline: adapter `fieldKeys = ["a", "b", "c"]`, with a valid result where `a` and `b` are in `values` and `c` is in `missingFields`. Its result is `toEqual([])`. More valid cases, each giving `[]`: all fields present; all fields missing; the `ok: false` baseline. **One test per rule.** Each test breaks exactly one rule and asserts `violations.map(v => v.rule)` `toEqual` exactly one code, so no rule fires as a side effect of another. The rule codes are listed in section 2: `unknown_field` (a key not in `fieldKeys`, in `values` in one test and in `missingFields` in another); `duplicate_field` (the same key twice in `values`, twice in `missingFields`, and once in each: three tests); `uncovered_field` (a key in neither list); `invalid_report_date`; `invalid_numeric_value`. Each field-related violation carries `fieldKey`. **Date table** (`it.each`). Valid: `2026-09-21`, `2028-02-29`, `2000-02-29`. Invalid: `2026-02-29`, `2100-02-29`, `2026-09-31`, `2026-13-01`, `2026-00-10`, `2026-09-00`, `0000-01-01`, `21.09.2026`, `2026-9-21`, `2026-09-21T00:00:00Z`, ` 2026-09-21`, `""`. **Numeric table** (`it.each`). Valid: `0`, `77`, `37470000`, `8640000.00`, `11.091`, `-12.5`. Invalid: `37,470,000`, `1.234,56`, `1 234`, `+5`, `.5`, `5.`, `1e5`, `NaN`, `--5`, ` 5`, `5 `, `""`, `١٢` (non-ASCII digits). The two extra hardening rules from section 2 also get one test each: `empty_raw_value` and `empty_error`. |
| AC6 | The contract and registry modules import no database, network or PDF-library code. Adapters work on text only. Checked by review of the imports. | **Review** (the AC's own method): the reviewer reads the import lines of the four production files. **Mechanised as well** (`boundaries.test.ts` › "adapter modules are text-only (AC6)"), so the guard also covers US-010 and later adapters. The test lists every non-test `.ts` file under `lib/extraction/adapters/` (`readdirSync(dir, { recursive: true })`) and asserts at least 4 files were found, so the test cannot pass vacuously. For each file it extracts the module specifiers of static imports and exports (multi-line), side-effect imports, dynamic `import(…)` and `require(…)`. Every specifier must (a) start with `./` or `../`, so no package, no `node:` builtin and no `@/` alias; (b) not start with `../../`, so it cannot leave `lib/extraction/`; (c) not be `../http`, `../pdf` or `../discovery` (with or without `.ts`), the network and PDF modules. The source must also not match `/\bfetch\s*\(/` or `/\bprocess\.env\b/`. A **positive control** runs the same specifier extractor on an inline sample containing `import { x } from "unpdf"`, a multi-line `import {\n a,\n b\n} from "../../db"`, `await import("node:fs")` and `require("drizzle-orm")`, and asserts all four specifiers are found. Without it, an extractor that finds nothing would pass silently. |
| AC7 | `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build` pass. | story-tester runs all four with `NODE_EXTRA_CA_CERTS` exported (DEC-002, DEC-008). No route imports these modules yet, so `build` only proves that nothing else broke. `typecheck` also carries the compile-time half of AC1. |
| extra: default registry (sprint DoD line 3; supports US-010 AC2) | The app's default registry is built from the list of real adapters. The list is empty until US-010. | `registry.test.ts` › "default registry". Importing `default-registry.ts` does not throw (the list has no duplicates). `defaultAdapterRegistry.list()` has the same members, in the same order, as `REGISTERED_ADAPTERS`. `get(null)`, `get(undefined)` and `get("unknown-key")` are `undefined`. **Do not assert that the list is empty.** US-010 would then have to change an assertion, which would look like weakening a test (R4). |
| extra: registry immutability | Changing the input array after creation, or the array returned by `list()`, does not change the registry. | `registry.test.ts`. Push a new fake into the input array: `get` and `list` do not see it. `list()` returns a frozen array, so `Object.isFrozen(list())` is true. |

MANUAL-QA: none. Everything is pure code tested offline. The sprint's live check (US-011 AC7)
exercises the registry end to end once US-010 registers `brd-depositary`.

---

## 2. Files and boundaries

| File | New/changed | Contents / boundary |
|---|---|---|
| `lib/extraction/adapters/types.ts` | new | **Types only**, with no runtime code and no imports. Exports `ExtractionAdapter`, `ExtractedValue`, `ExtractionResult` and `AdapterRegistry`, using the story's shapes and names (`key`, `fieldKeys: readonly string[]`, `canHandle(text: string): boolean`, `extract(text: string): ExtractionResult`; `ExtractedValue = { fieldKey; numericValue; rawValue }`; `ExtractionResult = { ok: true; reportDate; values: readonly ExtractedValue[]; missingFields: readonly string[] } \| { ok: false; error: string }`). `AdapterRegistry = { get(key: string \| null \| undefined): ExtractionAdapter \| undefined; list(): readonly ExtractionAdapter[]; detect(text: string): ExtractionAdapter \| undefined }`. JSDoc must state: `key` equals `etfs.adapter_key` and `field_catalog.adapter_key`; `fieldKeys` are plain strings, not FKs (data-model notes); `canHandle` and `extract` are pure, synchronous functions of the text, and they **return** rather than throw; `numericValue` is canonical (`-?digits(.digits)?`, no thousands separator, and decimals are kept as written, because it maps onto `numeric` and Drizzle's strings); `rawValue` is the verbatim token; every extractable field is returned and choosing which to persist is the caller's job (Sprint 3); an unfound field goes in `missingFields` and is never guessed; `ok: false` means the text is unusable, **including when no report date is found**; `ok: true` with every field missing is contract-valid, and how it maps to `reports.status` is US-014's call (R7). |
| `lib/extraction/adapters/validate.ts` | new | Imports only `import type … from "./types"`. Exports: **`CANONICAL_NUMERIC_PATTERN = /^-?\d+(\.\d+)?$/`**; **`isIsoCalendarDate(s: string): boolean`**, which uses pure arithmetic and no `Date` (R3): the regex `^(\d{4})-(\d{2})-(\d{2})$`, year ≥ 1, month 1–12, and day 1–daysInMonth using the Gregorian leap rule. US-010 reuses it for its footer date check (story US-010 Task 3). **`ContractViolation = { rule: ViolationRule; fieldKey?: string; message: string }`**, where `ViolationRule = "unknown_field" \| "duplicate_field" \| "uncovered_field" \| "invalid_report_date" \| "invalid_numeric_value" \| "empty_raw_value" \| "empty_error"`. **`validateExtractionResult(adapter: Pick<ExtractionAdapter, "fieldKeys">, result: ExtractionResult): ContractViolation[]`**. For `ok: false`, the only check is that `error.trim()` is non-empty (`empty_error`), since FR13 needs visible parse errors. For `ok: true`: count occurrences across `values` and then `missingFields`. A key not in `fieldKeys` gives `unknown_field`, reported once per key. A key seen more than once gives `duplicate_field`, reported once per key. A `fieldKeys` entry seen zero times gives `uncovered_field`. Then check the date (`invalid_report_date`). Then, per value, check `numericValue` against the pattern (`invalid_numeric_value`) and whether `rawValue.trim() === ""` (`empty_raw_value`). The output order is deterministic: values order, then missingFields, then fieldKeys order. The function never throws and does not mutate its inputs. `empty_raw_value` and `empty_error` are hardening checks that the story does not list. They are one line each and protect the audit column and FR13 visibility. |
| `lib/extraction/adapters/registry.ts` | new | Imports only `import type … from "./types"`. Exports **`createAdapterRegistry(adapters: readonly ExtractionAdapter[]): AdapterRegistry`**. It takes a frozen copy of the input (`Object.freeze([...adapters])`) and builds a **`Map<string, ExtractionAdapter>`**, not a plain object (R1). While building, it throws `Error` in three cases: (a) a duplicate key, with the message `Duplicate extraction adapter key "<key>"` (AC3); (b) an empty or whitespace-only key; (c) a repeated `fieldKey` within one adapter, which is needed so that "cover exactly" in `validateExtractionResult` is well defined. `get(key)`: returns `undefined` when `typeof key !== "string"`, otherwise `map.get(key)`, an exact match with no trim and no case fold (R8). `list()`: returns the frozen copy. `detect(text)`: `const matches = list.filter((a) => a.canHandle(text)); return matches.length === 1 ? matches[0] : undefined;`. It calls `canHandle` on every adapter and does not short-circuit (R2). It does not catch exceptions from `canHandle` (R5). |
| `lib/extraction/adapters/default-registry.ts` | new | `import { createAdapterRegistry } from "./registry"` and `import type { ExtractionAdapter } from "./types"`. Exports `REGISTERED_ADAPTERS: readonly ExtractionAdapter[] = []`, with a comment saying "US-010 adds brd-depositary here; adapters are code, not configuration (requirements section 5)", and `defaultAdapterRegistry = createAdapterRegistry(REGISTERED_ADAPTERS)`. It is a module-level singleton, so a duplicate key fails at import time, which means in tests and in the build. US-010's only edit to this file is one import and one list entry. Keeping this file separate from `registry.ts` means the factory tests never load real adapters. |
| `lib/extraction/adapters/types.test.ts` | new | AC1 (section 1). |
| `lib/extraction/adapters/validate.test.ts` | new | AC5, plus a direct `isIsoCalendarDate` table. |
| `lib/extraction/adapters/registry.test.ts` | new | AC2, AC3, AC4, the default registry and immutability. |
| `lib/extraction/adapters/boundaries.test.ts` | new | AC6 mechanised, with the positive control. It is the only test that reads source files (`node:fs` is allowed in tests, which the scan excludes). |

Not touched: `lib/extraction/{http,pdf,discovery,html}.ts` (US-007 and US-008 are Awaiting QA),
`lib/db/*`, `app/*`, `messages/*` (violation and error messages are internal diagnostics, not
UI), `eslint.config.mjs`, `vitest.config.ts`, `package.json`.

No barrel `index.ts`. Consumers import from the specific module (`./types`, `./registry`,
`./default-registry`, `./validate`). This keeps `boundaries.test.ts`'s file count meaningful
and avoids an accidental re-export of something impure later.

Boundary summary: `pdf.ts` (bytes → text) → **text** → `default-registry.ts` (`get` by
`etfs.adapter_key` for the daily run, `detect` by structure for add flows) → adapter `extract`
→ `ExtractionResult` → `validateExtractionResult`, called by US-010/US-011 tests and by Sprint 3
ingestion before writing. Nothing in `adapters/` knows about bytes, HTTP, the DB or the AI
module.

Guidance for US-010, not this story's scope: its `lib/extraction/numbers.ts` sits outside
`adapters/`, so `boundaries.test.ts` does not scan it. US-010's plan should add that file to
the scan list. It can also reuse `CANONICAL_NUMERIC_PATTERN` and `isIsoCalendarDate`.

---

## 3. Data model and migrations

None. The contract maps onto existing columns: `key` → `etfs.adapter_key` /
`field_catalog.adapter_key`, `reportDate` → `reports.report_date` (date), `numericValue` →
`report_values.numeric_value` (numeric, a string in Drizzle), `rawValue` →
`report_values.raw_value`, and `error` → `reports.error_message` in Sprint 3. Nothing is read
from or written to the DB in this story. No migration is generated.

---

## 4. Risks and the smallest design

- **R1: prototype-key lookup.** A plain-object registry (`adapters[key]`) returns
  `Object.prototype.constructor` for `get("constructor")` and misbehaves on `"__proto__"`.
  That would be a truthy non-adapter, which is a silent fallback. `Map` plus the
  `typeof key === "string"` guard removes the problem. AC2 tests those keys.
- **R2: short-circuit detection hides ambiguity.** `adapters.find(canHandle)` would return the
  first claimant even when a second one also matches. That is a guessed adapter.
  `filter(...).length === 1` evaluates every adapter. AC4 case (6) proves every `canHandle`
  ran.
- **R3: date validation with `Date`.** `new Date("2026-02-30")` behaviour depends on the
  engine. `Date.UTC` maps years 0–99 to 1900–1999. Local-time parsing depends on `TZ`. Pure
  arithmetic avoids all three and is about 10 lines. The table in AC5 covers leap years,
  century years and rollover dates.
- **R4: an empty default list couples tests to US-010.** A test asserting
  `list().length === 0` would force US-010 to rewrite it. The default-registry test asserts
  only properties that stay true when adapters are added.
- **R5: `canHandle` that throws.** The contract says adapters return and never throw, and
  `detect` does not catch. A throw is an adapter bug, and US-010's own tests would expose it.
  Catching it here would hide the bug. Sprint 3 ingestion (US-012/US-014) wraps each ETF's
  processing anyway, so one failing ETF does not stop the others. The add-ETF flows
  (Sprints 5/6) can wrap `detect` if their plans want "error → unavailable". This story makes
  no product call.
- **R6: drift between `fieldKeys` and `field_catalog`.** Not checkable here because no real
  adapter exists yet. US-010 AC1 asserts equality with `seedFieldCatalog`.
- **R7: `ok: true` with zero values.** It is contract-valid: the date was found and every
  field is in `missingFields`. The contract reports and does not judge. Status mapping is
  US-014's job (sprint-02 forward notes).
- **R8: key normalisation.** `adapter_key` values come from code (seed and adapters), not from
  user input. Trimming or case folding in `get` would be a fuzzy match, which counts as a
  fallback under AC2. Exact equality only.
- **Not doing:** async adapters, dynamic or DB-configured loading (story Out of scope), a
  `detectAll`/ambiguity report (not asked; Sprints 5/6 can add one if FR13 needs "ambiguous"
  shown separately from "none"), an ESLint rule for the boundary (the scan test covers AC6
  with less config surface), and a barrel file.

---

## 5. Decisions needed

None. The choices the story leaves to the plan are technical, fit inside the story's text,
and are settled above: file split and names, `Map` lookup with exact match, non-short-circuit
`detect`, structured `ContractViolation` codes, arithmetic date validation, two small
hardening checks (`empty_raw_value`, `empty_error`) plus registry-time key and field-key
checks, and a scan test backing the review-based AC6. None of them changes product behaviour.
