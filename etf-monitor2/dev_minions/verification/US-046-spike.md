# US-046 — raw report-label field feasibility (investigation only)

**Outcome: PROPOSED — NEEDS USER.** No raw-field support is authorized or
implemented. The shipped catalogue-only widget behavior remains unchanged.
This is a source/committed-fixture investigation, not a live BVB check.

## Observed boundaries

- `lib/extraction/adapters/brd-depositary.ts` maps eight fixed keys to
  format-specific labels. The BRD VUAN value *precedes* its label; bounded
  blocks prevent the individuals/legal-entities labels in separate sections
  from borrowing each other's numbers. A generic “value after matching label”
  rule would misread at least these cases.
- `lib/extraction/adapters/intercapital-nav.ts` maps eight keys from a
  different, bilingual two-class table. It requires ordered headers, explicit
  Class A/EUR and Class B/RON row boundaries, and the separate report `Data:`
  date. The same displayed label is not enough to identify a class/currency.
  `spikes/icbetnetf/FINDINGS.md` documents this format and its independently
  captured fixture; it does not establish that an arbitrary new label works.
- `lib/db/seed-data.ts` associates catalogue keys, labels and units with an
  adapter format. `lib/config/widgets.ts` validates widget fields against
  the existing adapter/catalogue numeric intersection; the widget engine
  consumes only stored canonical values. `lib/ingestion/select-values.ts`
  persists every *extracted* field, independently of the tracked display
  selection. Merely adding a widget or catalogue label cannot extract a
  previously unknown field.
- `test/fixtures/README.md` describes the committed BRD and ICBETNETF PDFs
  and independently transcribed `expected.json` values. These cover the
  existing adapter keys, not arbitrary requested labels. No new fixture was
  fetched or parsed for this spike.

## Options

| Option | Benefits | Costs and limits |
|---|---|---|
| A. Keep raw labels unsupported (current isolated default) | Deterministic, bounded catalogue and fixture coverage; no misleading guessed value or new maintenance surface. | A user cannot define a new numeric report field without an adapter change. |
| B. Later support explicitly mapped labels per adapter/report format | A reviewed mapping can specify a unique field key, label, unit, numeric rules, local boundaries, class/currency and fixture tests; still deterministic. | Requires a product-defined eligible set, admin approval/versioning of mappings, catalogue/validation and adapter changes, independent fixture transcription, failure behavior and compatibility review whenever a PDF layout changes. Multiple occurrences or adjacent labels must be disambiguated per format; ambiguous/missing data stays absent, not zero. |

Unrestricted substring matching, model-written parser code and AI-extracted
numbers are **not feasible safe alternatives** under the architecture rules.
It is an assumption—not a finding from these fixtures—that any additional
requested label appears reliably in all future BRD/InterCapital reports.

## Historical data and implementation boundary

A future approved mapping would need its own story and tests in the relevant
adapter, adapter catalogue/validation and fixture manifest. Only reports
ingested *after* that adapter starts extracting the new key will store it;
older rows without the key remain missing. No backfill, inferred history or
reparsing of archived/live PDFs is proposed. Report-date provenance, the
single-batch report/value write rule and the no-adapter behavior must remain
unchanged. A proposed mapping must document how it distinguishes repeated
labels, multiple classes, currency/unit and malformed or absent numbers, and
must fail closed rather than guess.

**Recommendation for PO consideration:** keep A unless there is a concrete
report format and a specific numeric label that warrants maintenance; if
approved later, use B with an explicit adapter-scoped mapping and fixtures.
This recommendation does not change DEC-022, enable raw fields in US-043–045,
or block their delivery. The unresolved question is whether to support raw
fields at all, and, if so, which labels/formats and persistence boundary the
PO authorizes. **Product outcome: PROPOSED — NEEDS USER.**

## Scope of this spike

Only this verification record and the story's status/handover bookkeeping
were changed for US-046. No code, test, schema, migration, prompt, catalogue,
adapter, PDF fixture, extraction behavior, network or production resource was
changed or used.

Scope-check method for independent review without git: list modification
metadata for files under `app`, `components`, `lib`, `drizzle`, `messages`,
`test`, `spikes` and `dev_minions/verification` since this spike began at
2026-10-03 10:53 local time; do not open environment or credential files.
The author's read showed only the US-045 QA/test verdict (finished just
before this spike) and the US-046 spike/review records. The reviewer should
repeat this metadata check independently and compare the results against
the handover's per-story file list; timestamp evidence is not a substitute
for git provenance and does not claim to detect arbitrary external edits.
