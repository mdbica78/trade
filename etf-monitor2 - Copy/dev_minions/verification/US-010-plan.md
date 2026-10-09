# US-010 plan: BRD depositary adapter

Planned by story-planner (opus), 2026-09-23.

Not blocked. No decision is needed (section 5).

Sources read: story US-010 (including its `## Tech-lead review` fix), US-011 (the downstream
consumer), sprint-02.md, SPRINT-02-review.md, `spikes/pdf-extraction/FINDINGS.md`, requirements
section 3 and FR3/FR5/FR10/FR13, the US-009 plan and the delivered
`lib/extraction/adapters/{types,validate,registry,default-registry}.ts` and their tests
(`registry.test.ts`, `boundaries.test.ts`), `lib/extraction/pdf.ts` (the shape of the text the
adapter receives), and `lib/db/seed-data.ts`.

This story adds pure TypeScript only. It adds no dependency, changes no config, and touches no
DB, UI, route, `messages/*` or migration.

---

## 1. Acceptance criteria and the tests that prove them

Test files: `lib/extraction/adapters/numbers.test.ts` (number parser) and
`lib/extraction/adapters/brd-depositary.test.ts` (everything else).

**Shared test scaffolding in `brd-depositary.test.ts`** (local to the file, not exported):

- `buildBrdText(overrides?)` assembles the text from named segments joined by one space, which
  is `unpdf`'s flattened format (FINDINGS). The segments in order:
  `stamp` `16426/22.09.2026` · `header` `BT Index România ETF BET–TR Decizie autorizare: 255/06.08.2008` ·
  `navClassLabel` `ACTIV NET (in valuta clasa UF - RON)` · `navClassValue` `415,591,664.27` ·
  `navFundLabel` `ACTIV NET (in valuta fond - RON)` · `navFundValue` `415,591,664.27` ·
  `unitsLabel` `NUMAR U.F. in circulatie, din care detinute de:` · `unitsValue` `37,470,000` ·
  `unitsIndLabel` `Persoane fizice` · `unitsIndValue` `29,733,778` ·
  `unitsLegLabel` `Persoane juridice` · `unitsLegValue` `7,736,222` · `vuanValue` `11.091` ·
  `invLabel` `Numar investitori, din care:` · `invValue` `18,708` ·
  `invIndLabel` `Persoane fizice` · `invIndValue` `18,631` ·
  `invLegLabel` `Persoane juridice` · `invLegValue` `77` ·
  `footer` `Raport depozitar la data de 21.09.2026 in valuta RON` ·
  `vuanLabel` `VALOARE UNITARA A ACTIVULUI NET (VUAN) (RON)` · `signature` (a few plain words, no
  digits).
  An override replaces a segment's text, and `null` omits it. Omitting a label keeps its value
  in the text. That orphan value is the hard case, because a sloppy rule could pick it up.
- `run(text)` calls `brdDepositaryAdapter.extract(text)`, asserts
  `validateExtractionResult(brdDepositaryAdapter, result)` is `[]` (AC8), and returns the
  result. **Every `extract` call in the test file goes through `run`**, including the
  `ok: false` cases. The reviewer can grep for `.extract(` to confirm there is exactly one call.
- `valueOf(result, key)` / `isMissing(result, key)`: small accessors. `isMissing` also asserts
  that the key is not in `values`.
- **Anti-vacuity guard for label removal:** each AC7 test first asserts the built text really
  lacks the label. For the duplicated sub-labels it counts occurrences. For example, with
  `unitsIndLabel: null` the text contains `Persoane fizice` exactly once.

| AC | Criterion (restated) | Proof |
|---|---|---|
| AC1 | `key === "brd-depositary"`. `fieldKeys` equals exactly the set of `seedFieldCatalog` field keys whose `adapterKey` is `brd-depositary`. | `brd-depositary.test.ts` › "identity (AC1)". `expect(adapter.key).toBe("brd-depositary")`. `expect([...adapter.fieldKeys].sort()).toEqual(seedFieldCatalog.filter(f => f.adapterKey === "brd-depositary").map(f => f.fieldKey).sort())`. Also assert equal lengths and `new Set(adapter.fieldKeys).size === adapter.fieldKeys.length`, so duplicates cannot hide behind the set comparison. The test file imports `../../db/seed-data`. Test files are excluded from the boundary scan, and `seed-data.ts` has no imports. The adapter itself must **not** import `seed-data`: `../../db` is forbidden by `boundaries.test.ts`, and the test is what keeps the two in sync. |
| AC2 | `defaultAdapterRegistry.get("brd-depositary")` returns this adapter, and every `adapterKey` in `seedEtfs` resolves to a registered adapter. | `brd-depositary.test.ts` › "registration (AC2)". `expect(defaultAdapterRegistry.get("brd-depositary")).toBe(brdDepositaryAdapter)` (identity). `it.each(seedEtfs)` asserts `get(etf.adapterKey)` is defined, naming the symbol. Extra check: `defaultAdapterRegistry.detect(buildBrdText())` is `toBe(brdDepositaryAdapter)`. US-011 AC5 does the same on real PDFs. The existing `registry.test.ts` › "default registry" tests stay unchanged and keep passing (`list()` equals `REGISTERED_ADAPTERS`). |
| AC3 | With both the filing stamp `16426/22.09.2026` and the footer `Raport depozitar la data de 21.09.2026 in valuta RON`, `reportDate` is `2026-09-21`. Without the footer phrase the result is `ok: false`. | `brd-depositary.test.ts` › "report date (AC3)". (1) The default text gives `ok: true, reportDate: "2026-09-21"`. The stamp is in the text, and the test asserts `text.includes("22.09.2026")` so the trap is really present. (2) `footer: null` gives `ok: false` with a non-empty `error` (the stamp is still present, so it is not used as a fallback). (3) Footer date `31.09.2026` gives `ok: false`, and so does `29.02.2026`. (4) Footer phrase followed by a non-date token (`Raport depozitar la data de XX in valuta RON`) gives `ok: false`. (5) Whitespace runs or a newline inside the phrase (`Raport  depozitar\nla data de 21.09.2026`) give `2026-09-21`. (6) Hardening (section 4, R6): the footer twice with the **same** date gives `ok: true`. The footer twice with **different** dates gives `ok: false`. |
| AC4 | On the BTBETRETF-modelled text, each of the seven label-anchored fields has the expected `numericValue` and the verbatim `rawValue`. `net_asset` comes from the "fond" line. The two `Persoane fizice`/`Persoane juridice` pairs are told apart by their parent label. | `brd-depositary.test.ts` › "values (AC4)". Use a `buildBrdText({ navClassValue: "415,000,000.00" })` variant, so the two ACTIV NET lines differ. `it.each` over the table: `net_asset` `415,591,664.27` → `415591664.27`; `units_in_circulation` `37,470,000` → `37470000`; `units_held_individuals` `29,733,778` → `29733778`; `units_held_legal_entities` `7,736,222` → `7736222`; `investors_total` `18,708` → `18708`; `investors_individuals` `18,631` → `18631`; `investors_legal_entities` `77` → `77`. Assert both `numericValue` and `rawValue`, and `missingFields` `toEqual([])`. Also `nav_per_unit` (AC5). A second variant swaps the order of the two ACTIV NET lines, which proves the rule is label-based and not "the second ACTIV NET". Extra: `values` come out in `fieldKeys` order (deterministic). |
| AC5 | `nav_per_unit = 11.091` from the positional rule. It is missing, with nothing guessed, when (a) the VUAN label is absent, (b) the gap holds no number, or (c) the gap holds more than one number. | `brd-depositary.test.ts` › "VUAN (AC5)". Default text: `nav_per_unit` numeric `11.091`, raw `11.091`. (a) `vuanLabel: null` gives nav missing, and the other 7 fields are unchanged (compared against the default result). (b) `vuanValue: null` gives nav missing. (c) `vuanValue: "11.091 12.5"` gives nav missing. More cases, all missing: `vuanValue: "abc"` (a non-number token); `vuanValue: "11,09"` (a rejected format); `vuanValue: "11.091 RON"` (an extra non-number token, R3). The VUAN label placed **before** the ACTIV NET block (moved into `header`) still gives `11.091`, because the rule says "present somewhere in the text". In every missing case, assert that the other seven fields still equal the default values. |
| AC6 | The parser maps the 7 listed tokens to canonical form and rejects `1.234,56`, `12,34`, `1,2345` and a non-numeric token. In the adapter, a field whose token is rejected goes to `missingFields` with no value. | `numbers.test.ts` › "parseReportNumber (AC6)". `it.each` accept table (the story's 7 pairs), asserting `{ numericValue, rawValue }` with `rawValue === token`, and that every accepted `numericValue` matches `CANONICAL_NUMERIC_PATTERN` from `./validate`. `it.each` reject table, each giving `null`: the story's `1.234,56`, `12,34`, `1,2345`, `abc`, plus the hardening cases `""`, `" 77"`, `"77 "`, `-5`, `+5`, `.5`, `5.`, `1,234.`, `1234,567` (bad grouping), `,123`, `1,,234`, `1e5`, `١٢` (non-ASCII digits), `37,470,000RON`. Adapter half, in `brd-depositary.test.ts` › "rejected token (AC6)": `navFundValue: "415.591.664,27"` gives `net_asset` missing, **and not** the "clasa UF" value. `invValue: "18,70"` gives `investors_total` missing and `investors_individuals`/`investors_legal_entities` still correct. |
| AC7 | Removing one label makes exactly the listed dependent fields missing, never shifts a value in from another block, and leaves every other field correct. | `brd-depositary.test.ts` › "label removal (AC7)". One `it` per row. Each asserts (i) the anti-vacuity guard, (ii) the exact `missingFields` set (`toEqual` after sort), and (iii) every other field deep-equals the default result's value. (1) `navFundLabel: null` → `["net_asset"]` (the orphan value and the "clasa UF" value are both unused). (2) `unitsIndLabel: null` → `["units_held_individuals"]`. `18,631` does not appear in any `units_*` value, and the orphan `29,733,778` is not used either. (3) `unitsLegLabel: null` → `["nav_per_unit", "units_held_legal_entities"]` (`77` is not used). (4) `unitsLabel: null` → `["nav_per_unit", "units_held_individuals", "units_held_legal_entities", "units_in_circulation"]`. (5) `invLabel: null` → `["investors_individuals", "investors_legal_entities", "investors_total", "nav_per_unit"]`, with `units_*` still `37470000`/`29733778`/`7736222`. (6a) `invIndLabel: null` → `["investors_individuals"]`. (6b) `invLegLabel: null` → `["investors_legal_entities"]`. Extra hardening, one `it`: the label with its `.` changed (`NUMAR UXF. in circulatie, …`) gives the case (4) result. This proves regex metacharacters in labels are escaped (R2). |
| AC8 | `canHandle` is true for BRD-format text and false for unrelated text, such as `VAN` instead of `VUAN`. Every result in these tests has no `validateExtractionResult` violations. | `brd-depositary.test.ts` › "canHandle (AC8)". True for `buildBrdText()`. True with whitespace runs or newlines inside the three labels. False for: `vuanLabel` rewritten to `VALOARE UNITARA A ACTIVULUI NET (VAN) (RON)`, the ICBETNETF-style case; `footer: null`; `unitsLabel: null`; `""`; `"lorem ipsum"`. Each of the three required labels removed on its own gives false. The violations half is enforced by `run` (see scaffolding). `canHandle` is also checked to be independent of `extract`: the `VAN` text still extracts without throwing (it gives `ok: true` with `nav_per_unit` missing, since only the VUAN label is absent). This documents that `get()`-driven extraction does not rely on `canHandle`. |
| AC9 | Pure function of its text: no AI, network, DB or PDF-library import. Checked by review. | **Review** (the AC's own method). **Mechanised as well, with no new code:** both new production files live in `lib/extraction/adapters/`, so the existing `boundaries.test.ts` scans them automatically. Only relative imports that stay inside `lib/extraction/` are allowed; `../http`, `../pdf` and `../discovery` are banned, and so are `fetch(` and `process.env`. The adapter's imports are `./types` (type-only), `./validate` (`isIsoCalendarDate`) and `./numbers`. Determinism: `brd-depositary.test.ts` › "purity" calls `extract` on text A, then text B, then A again. The two A results are `toEqual`, and B does not leak into A's result, which catches stateful `g`/`y` regex `lastIndex` bugs (R1). The reviewer also checks there is no `Date`, `Math.random` or module-level mutable state. |
| AC10 | `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` pass. | story-tester runs all four with `NODE_EXTRA_CA_CERTS` exported (DEC-002, DEC-008). Importing `default-registry.ts` from a test proves the registry builds with the new adapter: no duplicate key, and no repeated `fieldKey`. |

MANUAL-QA: none for this story. The real-PDF proof is US-011 (fixture suite, AC2) and its live
check (US-011 AC7).

**Optional implementer smoke check (not an AC, nothing committed).** Before handing over,
run the adapter once on the three committed PDFs through `extractPdfText` with a throwaway
`tsx` snippet. Record in the HANDOVER log line that all three give the date and 8 values with
no missing field. This moves any rule/real-text mismatch into this story, where it is cheap,
instead of US-011's fix loop. If it disagrees with a rule, fix the rule and add a text test
(story "Notes for verification"). Never special-case a fixture.

---

## 2. Files and boundaries

| File | New/changed | Contents / boundary |
|---|---|---|
| `lib/extraction/adapters/numbers.ts` | new | No imports. Exports `REPORT_NUMBER_PATTERN = /^(?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\.[0-9]+)?$/` (no `g` flag, explicit ASCII `[0-9]`), `type ParsedReportNumber = { numericValue: string; rawValue: string }` and `parseReportNumber(token: string): ParsedReportNumber \| null`. It tests the whole token and returns `{ numericValue: token.replace(/,/g, ""), rawValue: token }` or `null`. There is no trimming: the caller passes a whitespace-free token, and `" 77"` is rejected. JSDoc cites FINDINGS "Number formatting": comma is the thousands separator, dot the decimal, the number of decimals varies, and there is no sign. It sits in `adapters/` rather than the story's example path `lib/extraction/numbers.ts`, for one reason: `boundaries.test.ts` then covers it with no edit to US-009's test file (the US-009 plan's guidance was to add it to the scan list; this does that implicitly). A later adapter imports `./numbers`, or deliberately does not. |
| `lib/extraction/adapters/brd-depositary.ts` | new | Imports: `import type { ExtractionAdapter, ExtractedValue, ExtractionResult } from "./types"`, `import { isIsoCalendarDate } from "./validate"`, `import { parseReportNumber } from "./numbers"`. Exports `BRD_DEPOSITARY_KEY = "brd-depositary"`, `BRD_FIELD_KEYS` (the eight keys, frozen, in `seedFieldCatalog` order) and `brdDepositaryAdapter: ExtractionAdapter`. Internals are unexported unless a test needs them. The algorithm is in section 4 ("Design"). The labels are one `const LABELS = { … } as const` block with exactly the strings from story Task 2/3/5, so the reviewer can diff them against the story. |
| `lib/extraction/adapters/default-registry.ts` | changed | Add `import { brdDepositaryAdapter } from "./brd-depositary"`, make the list `[brdDepositaryAdapter]`, and turn the "US-010 adds…" comment into a one-line rule: "adapters are code, not configuration (requirements section 5); add new adapters here". Nothing else changes. |
| `lib/extraction/adapters/numbers.test.ts` | new | AC6 parser tables. |
| `lib/extraction/adapters/brd-depositary.test.ts` | new | AC1–AC5, AC6 (adapter half), AC7, AC8, AC9 purity, with the scaffolding from section 1. |

Not touched: `types.ts`, `validate.ts`, `registry.ts`, `registry.test.ts`,
`boundaries.test.ts`, `validate.test.ts`, `types.test.ts` (US-009, Awaiting QA). Its tests keep
passing unchanged: `boundaries.test.ts`'s "at least 4 files" is now 6. Also not touched:
`lib/extraction/{http,html,discovery,pdf}.ts`, `lib/db/*` including `seed-data.ts`, `app/*`,
`messages/*` (adapter error strings are internal diagnostics that end up in
`reports.error_message`, not UI copy), all config files, and `architecture/data-model.md`
(story note: the `.` thousands-separator line is for the PO/Technical Lead to fix).

Boundary: `pdf.ts` → text → `defaultAdapterRegistry.get("brd-depositary")` (daily run) or
`detect(text)` (add flows) → `brdDepositaryAdapter.extract(text)` → `ExtractionResult`. The
adapter knows nothing about bytes, HTTP, the DB, tracked fields or `reports.status`.

---

## 3. Data model and migrations

None. The adapter's output maps onto existing columns: `reportDate` → `reports.report_date`,
`numericValue` → `report_values.numeric_value`, `rawValue` → `report_values.raw_value`. The
field keys already exist in `field_catalog` through the US-005 seed. AC1 locks the two
together. No DB access and no migration.

---

## 4. Design, risks and the smallest design

### Design (implementer follows this; names are suggestions)

Helpers, all pure and all creating their regexes per call or using non-global regexes:

- `labelSource(label)`: split the label on `/\s+/`, escape each word
  (`/[.*+?^${}()|[\]\\]/g` → `\\$&`), and join with `\s+`. "Tolerate runs of whitespace"
  means exactly this. There is no case folding and no diacritic folding (R4, R5). JS `\s`
  also covers NBSP and newlines.
- `findLabel(text, label, from = 0, to = text.length)`: the first match of the label lying
  entirely inside `text.slice(from, to)`. Returns absolute `{ start, end }` or `null`.
  Implementation: `new RegExp(labelSource(label))` executed on the slice, then offsets mapped
  back.
- `tokenAfter(text, pos, to = text.length)`: skip whitespace from `pos`, then take the maximal
  run of non-whitespace inside `[pos, to)`. Returns `{ token, end }` or `null`. There is
  deliberately **no** extra requirement that a space separates label and value, so the
  `pdf-parse`-style `…RON)415,591,664.27` also works. That costs nothing, but it is not a
  requirement.
- `numberAfterLabel(text, label, from, to)`: `findLabel`, then `tokenAfter(…, to)`, then
  `parseReportNumber`. Returns `{ value: ParsedReportNumber, end }` or `null`. A rejected
  token means `null`, so the field is missing (AC6).

`extract(text)`:

1. **Date.** Find every occurrence of the footer label `Raport depozitar la data de`, using a
   fresh global regex built from `labelSource` and `matchAll`. For each, take `tokenAfter`. The
   token must match `^(\d{2})\.(\d{2})\.(\d{4})$` exactly and give a valid
   `isIsoCalendarDate(YYYY-MM-DD)`. No occurrence gives `ok: false`, error "report date not
   found (…)". Any invalid token gives `ok: false`, "invalid report date "<token>"". Two or more
   valid but different dates give `ok: false`, "conflicting report dates …". The filing stamp is
   never read (trap 2).
2. `net_asset` = `numberAfterLabel(text, "ACTIV NET (in valuta fond - RON)")`. There is no other
   ACTIV NET lookup anywhere in the code, so a fallback to the "clasa UF" line is impossible by
   construction.
3. `units = findLabel(text, "NUMAR U.F. in circulatie, din care detinute de:")`.
   `units_in_circulation` = the number right after it.
4. `bound = units ? findLabel(text, "Numar investitori, din care:", units.end) : null`. The
   units region is `[units.end, bound?.start ?? text.length)`. `units_held_individuals` /
   `units_held_legal_entities` = `numberAfterLabel(text, "Persoane fizice" | "Persoane juridice", units.end, regionEnd)`.
   Both the sub-label and its token must lie inside the region. The two sub-fields are searched
   independently from `units.end`, so their order within the block does not matter.
5. `nav_per_unit`. All of these must hold: the VUAN label
   `VALOARE UNITARA A ACTIVULUI NET (VUAN)` is found anywhere; `units_held_legal_entities` was
   parsed (take its token `end`); `bound` is non-null (a real investors label, **not**
   end-of-text). Then `gap = text.slice(legalEnd, bound.start).split(/\s+/).filter(Boolean)`.
   Accept only when `gap.length === 1` and `parseReportNumber(gap[0])` is non-null (R3).
6. `inv = findLabel(text, "Numar investitori, din care:")` (first occurrence anywhere, so it
   still works when the units label is missing). `investors_total` = the number right after
   it. `investors_individuals` / `investors_legal_entities` = `numberAfterLabel(…, inv.end)`
   through to the end of the text (story rule, unbounded).
7. Build `values` and `missingFields` by walking `BRD_FIELD_KEYS` in order. Return
   `{ ok: true, reportDate, values, missingFields }`. `extract` never calls `canHandle` and
   never throws.

`canHandle(text)`: `findLabel` succeeds for all three of `Raport depozitar la data de`,
`NUMAR U.F. in circulatie` and `VALOARE UNITARA A ACTIVULUI NET (VUAN)` (story Task 5, with
the same whitespace tolerance).

Check against the tech-lead's AC7 table, by construction: removing the units `Persoane fizice`
leaves no `Persoane fizice` inside the bounded region. Removing `Numar investitori` makes the
region run to the end of the text, but the first `Persoane fizice` after the units label is
still the units one, and `nav` fails because `bound` is null. Removing the units
`Persoane juridice` leaves no legal-entities value, so there is no gap start and `nav` is
missing.

### Risks

- **R1: stateful regexes.** A module-level `/…/g` or `/…/y` regex used with `exec`/`test`
  keeps `lastIndex` between calls. That makes `extract` depend on the previous input, which
  breaks the purity rule (AC9). The fix: no module-level `g`/`y` regexes. Build per call, or
  use `matchAll`, which clones the regex. The A-B-A purity test catches a regression.
- **R2: unescaped label metacharacters.** `U.F.` and `(…)` inside labels would match
  unintended text if they were not escaped. `labelSource` escapes them, and the `UXF.` test
  proves it.
- **R3: how strict the VUAN gap is.** The story says to take "the single number token" and to
  accept it only if "exactly one number sits in that gap". The plan reads this strictly: the
  gap must be **exactly one whitespace-delimited token, and it must parse**. A gap such as
  `11.091 RON` is therefore missing, not `11.091`. This is the "never guess" reading. The
  tech-lead confirmed that each of the three real fixtures has exactly one token there. If
  US-011 or a later fixture shows extra words in the gap, relax the rule with a test at that
  point, not in advance.
- **R4: case sensitivity.** Labels are matched case-sensitively, exactly as documented.
  `NUMAR U.F.` is upper case and `Numar investitori` is mixed case in the real text. Folding
  case would be a fuzzy match.
- **R5: diacritics.** The real text uses unaccented labels (`Numar`, `circulatie`). No
  diacritic folding. A future template with `Număr` makes those fields visibly missing, which
  is the intended outcome (FR13), not a silent guess.
- **R6: several footers.** The story does not say what happens when the footer phrase appears
  twice. A wrong date would put the values on the wrong day, which is the costliest error in
  this adapter. The plan therefore requires all occurrences to agree, and gives `ok: false`
  otherwise. This is a few lines and one test, and it is the conservative reading of trap 2.
  For value labels the plan takes the first occurrence, as the story's rules say.
- **R7: synthetic text vs real text.** The unit tests use a hand-built string. The real proof
  is US-011. The optional smoke check in section 1 moves that proof earlier at no cost.
- **R8: orphan values.** Every AC7 case keeps the removed label's number in the text. The
  label-then-next-token rule never reads an unlabelled number, apart from the documented VUAN
  gap, and the gap needs both of its boundary anchors.
- **Not doing:** a generic label-rule DSL or config-driven adapter (one adapter, and the
  requirements say adapters are code); pdf-parse-style line handling beyond what whitespace
  tolerance gives for free; sign or currency parsing; any display formatting (DEC-007 is UI
  only); a `ro`-format (`1.234,56`) parser. That format is rejected, per FINDINGS.

---

## 5. Decisions needed

None. The requirements, FINDINGS, the story (with the tech-lead's fixes) and US-009's contract
settle the product behaviour. The choices left to the plan are technical, stay inside the
story's text, and are settled above:

- the parser lives in `adapters/numbers.ts` so the existing boundary scan covers it;
- the strict one-token VUAN gap (R3);
- conflicting footer dates give `ok: false` (R6);
- case- and diacritic-sensitive label matching (R4, R5).
