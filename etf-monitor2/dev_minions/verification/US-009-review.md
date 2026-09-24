# US-009 review

## Round 1 — 2026-09-23

Verdict: PASS

Reviewer: story-reviewer subagent, independent context (did not write this code). No git
commands were run — read `dev_minions/HANDOVER.md`'s "Files changed" list, the story, the
plan, and each file in full. Confirmed no code outside that list touches this story's new
symbols (`grep -rln "ExtractionAdapter|createAdapterRegistry|validateExtractionResult|
defaultAdapterRegistry"` outside `lib/extraction/adapters/` returned nothing — this story
correctly does not wire itself into anything yet, per its own "Out of scope").

Files reviewed in full:
- `lib/extraction/adapters/types.ts`
- `lib/extraction/adapters/validate.ts`
- `lib/extraction/adapters/registry.ts`
- `lib/extraction/adapters/default-registry.ts`
- `lib/extraction/adapters/types.test.ts`
- `lib/extraction/adapters/validate.test.ts`
- `lib/extraction/adapters/registry.test.ts`
- `lib/extraction/adapters/boundaries.test.ts`
- `dev_minions/backlog/stories/US-009.md`, `dev_minions/verification/US-009-plan.md`,
  `dev_minions/architecture/data-model.md` (adapter_key / field_catalog / report_date /
  numeric_value / raw_value rows), `dev_minions/requirements/etf-monitoring-requirements.md`
  (FR3, FR4, FR5, FR10, FR13).

Ran independently: `pnpm typecheck` (clean, no errors — includes the AC1 compile-time
`@ts-expect-error`/`expectTypeOf` proofs since tsconfig covers test files) and `pnpm lint`
(exit 0, one non-blocking warning, see Findings). Did not run `pnpm test`/`pnpm build`
myself (story-tester's job, running in parallel); HANDOVER.md reports 235/235 green
including 92 new, and a green build.

## Acceptance criteria

- **AC1** — MET. `types.ts:10-60` exports `ExtractionAdapter`, `ExtractedValue`,
  `ExtractionResult`, `AdapterRegistry` with exactly the shapes in the story's Task 1
  (`key`, `fieldKeys: readonly string[]`, `canHandle`, `extract`; discriminated
  `ExtractionResult` on `ok`). JSDoc states the required semantics: `reportDate` is
  `YYYY-MM-DD` (`types.ts:44`), canonical `numericValue` with verbatim `rawValue`
  (`types.ts:17-23`), `missingFields` never guessed (`types.ts:34`), `ok: false` for
  unusable text "including when no report date can be found" (`types.ts:36-38`).
  `types.test.ts` proves it: a fake `satisfies ExtractionAdapter` compiles (line 6-18);
  four `@ts-expect-error` directives on missing `reportDate`, `missingFields`, `error`,
  `rawValue` (lines 20-42) — verified these are load-bearing by `pnpm typecheck` passing
  clean (an unused `@ts-expect-error` directive is itself a `tsc` error, so this is a real
  proof, not a decoration); `expectTypeOf` pins `fieldKeys: readonly string[]` and
  `extract`'s parameter tuple to `[string]` (lines 44-50); narrowing test (lines 52-68)
  exercises both branches at runtime.
- **AC2** — MET. `registry.ts:31-37`: `get` returns `undefined` for any `key` that is not
  `typeof === "string"` (covers `null`/`undefined`), otherwise an exact `Map.get`, no trim,
  no case fold, no fallback. `registry.test.ts:15-46` proves exact-identity return for two
  registered keys, `undefined`+non-throw for `null`, `undefined`, `"unknown-key"`, `""`,
  case variance, whitespace variance, and the four prototype-pollution keys
  (`"constructor"`, `"__proto__"`, `"toString"`, `"hasOwnProperty"` — the `Map`-based
  implementation is immune to these by construction, and the test proves it); an empty
  registry also returns `undefined` (no "one candidate wins" fallback); and `get` never
  calls `canHandle`/`extract` (lines 39-46), proving it is a lookup, not detection.
- **AC3** — MET. `registry.ts:16-18` throws `Error(\`Duplicate extraction adapter key
  "<key>"\`)` at construction time on the second occurrence of a key.
  `registry.test.ts:49-76` proves the message names the key, for a duplicate at positions
  1-2 and 1-3, plus two hardening cases (empty key, whitespace-only key) and a
  `fieldKeys`-repeat case that the plan added as non-AC hardening — all four tests are real
  (each constructs a registry expected to throw and asserts it does).
- **AC4** — MET. `registry.ts:41-44`: `detect` filters (no short-circuit) then returns the
  single match or `undefined`. `registry.test.ts:79-131` covers: single claimant (identity
  match), zero claimants, two-of-two claimants, two-of-three claimants, empty registry, and
  critically (lines 114-124) proves every adapter's `canHandle` was called exactly once
  even after an early match — this is the test that actually distinguishes a correct
  ambiguity-detecting `detect` from a short-circuiting `find`. `extract` is never called by
  `detect` (lines 126-131).
- **AC5** — MET. `validate.ts:49-155` implements every rule from story Task 2 plus the
  plan's two hardening rules (`empty_raw_value`, `empty_error`), using pure arithmetic date
  validation (`isIsoCalendarDate`, `validate.ts:15-28`, no `Date`, correct leap-year rule
  including the century exception, verified against the century-year test case
  `2100-02-29` → invalid). `validate.test.ts` gives one isolated test per rule (each
  asserting `violations.map(v => v.rule)` equals exactly one rule code, so no rule fires as
  a side effect of another — checked this by hand for the `unknown_field`/duplicate cases,
  since a naive implementation could double-report a value that is both unknown and
  duplicated; this one deliberately keeps unknown/duplicate keys mutually exclusive in its
  test fixtures so the isolation claim holds), four "valid" baselines returning `[]`, the
  full date table (12 invalid cases incl. leap/century/rollover/format variants, 3 valid),
  the full numeric table (13 invalid cases incl. thousands separators, European decimal
  comma, leading `+`, bare `.`/trailing `.`, exponent notation, `NaN`, non-ASCII digits — 6
  valid), and a non-mutation test (`validate.test.ts:182-190`).
- **AC6** — MET, both by manual review and mechanised. Manual: `types.ts` has zero imports;
  `validate.ts` and `registry.ts` each import only `import type … from "./types"`;
  `default-registry.ts` imports only `./registry` and `./types`. None reaches `http.ts`,
  `pdf.ts`, `discovery.ts`, any DB module, `node:` builtins, or an npm package; no
  `fetch(`/`process.env` anywhere. Mechanised: `boundaries.test.ts` scans every non-test
  `.ts` file under the directory (found exactly 4, so `toBeGreaterThanOrEqual(4)` is not
  vacuous), extracts every import/dynamic-import/require specifier and checks all three
  constraints, backed by a positive control (lines 23-38) that proves the specifier
  extractor actually finds all four specifier shapes in a synthetic sample — without which
  a broken extractor that silently finds nothing would make every per-file assertion pass
  for the wrong reason. This test will also cover US-010's real adapter automatically.
- **AC7** — MET for the parts I could run myself: `pnpm typecheck` clean, `pnpm lint` exit
  0. `pnpm test`/`pnpm build` are reported green by the implementer (235/235, incl. 92 new)
  and will be independently confirmed by story-tester in parallel; I did not re-run them
  myself under this role's tool restriction.

## Findings (ordered by severity)

No Critical or Warning findings.

1. (Note) `lib/extraction/adapters/types.test.ts:10` — `extract: (_text: string) => …` still
   trips `@typescript-eslint/no-unused-vars` ("`_text` is defined but never used") even
   though it follows the leading-underscore convention, because `eslint.config.mjs` has no
   `argsIgnorePattern` configured for that rule. `pnpm lint` still exits 0 (warning, not
   error), so AC7 is unaffected; non-blocking, purely a repo-wide config gap that a later
   story could fix if the pattern keeps recurring.
2. (Note) The plan's own hardening additions beyond the story text (`empty_raw_value`,
   `empty_error` violation rules; empty-key and repeated-`fieldKey` construction-time
   throws; the `fieldKeys`-repeat check) are implemented and tested exactly as the plan
   described, and are all small, one-line, in-scope hardening that directly protects FR13
   visibility and the "cover exactly" invariant AC5 depends on — not treating these as scope
   creep, they are inside the plan the sprint review already approved.

## Scope deviations

None. Every file matches the plan's file list exactly (`types.ts`, `validate.ts`,
`registry.ts`, `default-registry.ts`, and their four test files). No barrel `index.ts` was
added (plan explicitly avoids one). Nothing outside `lib/extraction/adapters/` was touched
for this story; `git status`-equivalent (HANDOVER's "Files changed" list) matches the
directory listing exactly (4 production files + 4 test files, no extras, no omissions).
`lib/extraction/{http,pdf,discovery,html}.ts`, `lib/db/*`, `app/*`, `messages/*`,
`eslint.config.mjs`, `vitest.config.ts`, `package.json` are all untouched, as the plan
promised.

## AGENTS.md non-negotiables (checked)

- Deterministic, non-AI extraction: N/A to this story (contract only), but the JSDoc and
  the "adapters are code, not configuration" comment in `default-registry.ts:4` correctly
  set up that constraint for US-010.
- One adapter per report format, no-match → "unavailable": the registry's `get`/`detect`
  contract (never fabricates or falls back) is exactly what section 3's "unavailable"
  behaviour needs from this layer; the admin display itself is out of scope here (US-030),
  correctly deferred.
- Missing report → empty day: N/A (no ingestion code in this story).
- next-intl ro+en: N/A — no UI strings; violation/error messages are internal diagnostics
  (plan states this explicitly, and I agree it's the correct call, not a rule dodge).
- DEC-007 number display: N/A — `numericValue`/`rawValue` are internal canonical/raw forms,
  not display formatting.
- No secrets in code/logs: none present; no `console.*`, no `process.env`, checked by grep.
- No weakened/skipped tests: no `.skip`/`.todo`/`xit`/`xdescribe` anywhere in the four test
  files (checked by grep).
- No scope creep: confirmed above.
