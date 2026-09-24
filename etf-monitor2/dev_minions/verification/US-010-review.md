# US-010 review — BRD depositary adapter

## Round 1 — 2026-09-23

Verdict: PASS

Reviewer: `story-reviewer` subagent (independent, fresh context). Read: `AGENTS.md`,
`dev_minions/backlog/stories/US-010.md` (incl. the tech-lead's in-story fix note),
`dev_minions/verification/US-010-plan.md`, `spikes/pdf-extraction/FINDINGS.md`, and every file
under HANDOVER.md's "Files changed" for US-010, in full:
`lib/extraction/adapters/numbers.ts`, `lib/extraction/adapters/numbers.test.ts`,
`lib/extraction/adapters/brd-depositary.ts`, `lib/extraction/adapters/brd-depositary.test.ts`,
`lib/extraction/adapters/default-registry.ts`. Also read the US-009 contract files
(`types.ts`, `validate.ts`, `registry.ts`, `boundaries.test.ts`) and `lib/db/seed-data.ts` for
context. Grepped the whole repo (excluding `node_modules`) for the story's new symbols
(`brd-depositary`, `BRD_DEPOSITARY_KEY`, `BRD_FIELD_KEYS`, `parseReportNumber`,
`REPORT_NUMBER_PATTERN`) — the only hits outside the Files-changed list are the pre-existing
`adapterKey: "brd-depositary"` string literals in `lib/db/seed-data.ts` (US-005, unchanged).
No scope creep. Ran `pnpm typecheck` (clean) and `pnpm lint` (0 errors, 1 pre-existing warning
carried over from US-009's `types.test.ts`, not touched by this story). Did not run `git`.

### Acceptance criteria

- **AC1 — MET.** `key === "brd-depositary"` (`brd-depositary.ts:213`). `BRD_FIELD_KEYS`
  (`brd-depositary.ts:7-16`) is asserted against `seedFieldCatalog` in
  `brd-depositary.test.ts:121-126` (`identity (AC1)`), including a set-size check that rules out
  hidden duplicates. Field keys match `lib/db/seed-data.ts:25-82` exactly (8 keys).
- **AC2 — MET.** `default-registry.ts:6` registers the adapter; `brd-depositary.test.ts:130-140`
  (`registration (AC2)`) asserts `defaultAdapterRegistry.get("brd-depositary")` is the adapter
  by identity, `it.each(seedEtfs)` that every seeded ETF's `adapterKey` resolves, and that
  `detect()` also resolves BRD-format text to this adapter.
- **AC3 — MET.** `findReportDate` (`brd-depositary.ts:93-124`) reads only the footer phrase, never
  the filing stamp. `brd-depositary.test.ts:143-187` (`report date (AC3)`) proves: default text
  with both stamp and footer present gives `2026-09-21` (and explicitly asserts the stamp
  `22.09.2026` is in the text, so the trap is real); footer absent → `ok:false`; impossible date
  (`31.09.2026`), non-leap Feb 29, non-date token → all `ok:false`; whitespace/newline inside the
  phrase still resolves; two occurrences with the same date → `ok:true`, with different dates →
  `ok:false`.
- **AC4 — MET.** `brd-depositary.test.ts:189-230` (`values (AC4)`) checks all 7 label-anchored
  fields' `numericValue`/`rawValue` on a variant where the two `ACTIV NET` lines differ
  (`navClassValue` overridden), proving `net_asset` comes from the "fond" line specifically, and
  a second test swaps the order of the two `ACTIV NET` lines and still gets the right value —
  proof the rule is label-based, not positional/order-based. `Persoane fizice`/`juridice` pairs
  are correctly told apart by parent label (units block vs. investors block; see AC7 below).
- **AC5 — MET.** `nav_per_unit` positional rule at `brd-depositary.ts:164-175`. Requires the VUAN
  label present anywhere, `legalEntitiesEnd` set (units `Persoane juridice` found), and the
  investors label found after it; then the gap must be exactly one token that parses. Verified by
  `brd-depositary.test.ts:232-279` (`VUAN (AC5)`): default gives `11.091`; (a) label absent, (b)
  no number in the gap, (c) two numbers in the gap, plus non-number token, rejected-format token,
  and number-plus-extra-token — all give `nav_per_unit` missing with every other field unchanged
  from the default result (`expectNavMissingOthersUnchanged` helper re-checks all 7 other fields
  each time). VUAN label moved earlier in the text still resolves — "present somewhere" is
  correctly unbounded.
- **AC6 — MET.** `numbers.ts:10-15`, pattern at `numbers.ts:6`. `numbers.test.ts` accept table
  matches the story's 7 pairs exactly, plus `numericValue` checked against
  `CANONICAL_NUMERIC_PATTERN` from `validate.ts`; reject table covers the story's 4 cases plus
  13 hardening cases (leading/trailing space, signs, bad grouping, stray letters, non-ASCII
  digits, trailing text). Traced `1234,567`, `,123`, `1,,234` by hand against
  `REPORT_NUMBER_PATTERN` — all correctly fail to match. Adapter half in
  `brd-depositary.test.ts:281-295`: a rejected `net_asset` token is missing and does **not** fall
  back to the "clasa UF" line (can't, by construction — see AC7); a rejected
  `investors_total` token leaves the two investor sub-fields correct.
- **AC7 — MET.** Every row from the story/tech-lead table has its own test in
  `brd-depositary.test.ts:297-393`, each with an anti-vacuity guard (asserts the label is really
  gone, or counts remaining occurrences of a duplicated sub-label), an exact `missingFields` set
  assertion, and a check that every other field still equals the default result. Traced the
  bounding logic in `brd-depositary.ts:148-175` by hand for each row (net_asset never has a second
  lookup path so it can't fall back to "clasa UF"; the units sub-labels are bounded by the
  investors label so they can't read the investors block's values; removing the parent labels
  correctly cascades to their dependents) — matches the table exactly, including the
  regex-metacharacter-escaping case (`NUMAR UXF.` behaves as if the label were absent, proving
  `.`/`(`/`)` in labels are escaped, not literal wildcards — confirmed by hand that the unescaped
  pattern *would* have matched `UXF.`, so this is a real, non-vacuous test).
- **AC8 — MET.** `canHandle` (`brd-depositary.ts:204-210`) checks the three required label
  fragments. `brd-depositary.test.ts:395-436` (`canHandle (AC8)`) covers true/false cases
  including the ICBETNETF-style `VAN` (not `VUAN`) rewrite, whitespace/newline tolerance, empty
  text, unrelated text, and that `extract` still works (doesn't throw) on `canHandle`-false text.
  Every `extract` call in the test file goes through the shared `run()` helper
  (`brd-depositary.test.ts:94-98`), which asserts `validateExtractionResult(...)` is `[]` on every
  call — grepped for `.extract(` and confirmed all production-path calls in the test file go
  through `run`, satisfying the "no violations" half of AC8.
- **AC9 — MET** (by review, as the AC specifies, plus a mechanised check with no new code). No
  `fetch`, `process.env`, `Date`, `Math.random`, or DB/PDF-library import anywhere in
  `brd-depositary.ts`/`numbers.ts`. Imports are `./types` (type-only), `./validate`, `./numbers`
  only. `boundaries.test.ts` (unchanged, already covers the whole `adapters/` directory)
  mechanically re-checks this on every test run, and its "at least 4 files" guard is now
  satisfied by 6 non-test files, so the scan is exercising the new files, not silently skipping
  them. All regexes are built fresh per call or are non-global module constants
  (`REPORT_NUMBER_PATTERN`, `FOOTER_DATE_RE`) — no stateful `g`/`y` `lastIndex` leakage. The
  purity test at `brd-depositary.test.ts:438-447` (A→B→A) confirms no leakage empirically.
- **AC10 — MET** for the two checks this role is allowed to run: `pnpm typecheck` is clean;
  `pnpm lint` is 0 errors (1 pre-existing warning, unrelated to this story). `pnpm test` and
  `pnpm build` are the `story-tester` subagent's job per the delivery loop; HANDOVER.md records
  315/315 green including the 80 new tests, and the implementer's optional smoke check against
  all three real fixtures (all 8 values, zero missing fields, zero violations) — not independently
  re-run here, but the review agrees with the design that produced those results.

### Findings

None Critical, none Warning. Two Notes, both cosmetic, no action required:

1. `brd-depositary.ts:148` (`investorsLabel = findLabel(text, LABELS.investors)`) searches the
   whole text from position 0, not from `units.end` as the plan's section 4 design sketch
   suggested. This is safe in practice — every use of `investorsLabel` downstream is guarded by a
   `position >= someEarlierEnd` check (`brd-depositary.ts:153`, `:166`) before being trusted as a
   bound — and the plan itself says implementation names/shapes are suggestions. No test exposes
   a difference in behaviour; not a defect.
2. `canHandle` (`brd-depositary.ts:206-207`) hardcodes the substring `"NUMAR U.F. in circulatie"`
   separately from `LABELS.units`'s full string, rather than deriving it. Matches the story's
   Task 5 wording exactly, just a minor duplication of a literal.

### Scope deviations

None. `numbers.ts` living under `lib/extraction/adapters/` rather than the story's example path
`lib/extraction/numbers.ts` is explicitly called out and justified in the plan (section 2, so the
existing `boundaries.test.ts` scan covers it with no edit) — not an undisclosed deviation.
`default-registry.ts`'s changed comment ("adapters are code, not configuration...") is in scope
(the file the story explicitly says to change) and not a functional change beyond registering the
adapter.

### AGENTS.md non-negotiables checked

- Deterministic label-based extraction, no AI: confirmed, pure string/regex code only.
- One adapter per report format: this story adds exactly one (`brd-depositary`); the registry
  still resolves `undefined` for anything `canHandle` doesn't match (US-009 behaviour, unchanged).
- Missing report → empty day: not this story's concern (Sprint 3, US-012/US-014 per the story's
  "Out of scope").
- next-intl ro+en: N/A, no UI strings added (adapter error strings are internal diagnostics into
  `reports.error_message`, not UI copy, as the plan notes).
- Number display DEC-007: N/A, out of scope per the story itself (display formatting is Sprint 4).
- No secrets: none present.
- No weakened/skipped tests: none skipped; every AC7 test includes an anti-vacuity guard rather
  than trusting the override silently worked.
- No scope creep: confirmed via the repo-wide symbol grep above.
