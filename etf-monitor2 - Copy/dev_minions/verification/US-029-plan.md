# US-029 plan — ICBETNETF report access and the second adapter

_Planner: story-planner (opus), 2026-09-27. Phase A (live investigation) is already done:
`spikes/icbetnetf/FINDINGS.md`, verdict **ADAPTER**. This plan covers Phase B plus the "either branch" tasks._

No open TECHNICAL decision. The one PRODUCT item (§5) ships an isolated default, so the story is not blocked.

## 0. What Phase A established (the plan follows FINDINGS, not the story's hypothesis)

- The ICBETNETF `gv5News` rows have the **same markup as the BRD rows**: a decorative `<input type="submit">` plus a
  sibling `<a href='https://bvb.ro/infocont/…pdf'>` (fixture `test/fixtures/bvb/ICBETNETF-instrument-2026-09-27.html`,
  lines 760–778). The row titles fold to `"van la data …"`, so `isDepositaryReportEntry` already accepts them.
  **Report access is today's link path: GET page, then GET PDF (2 requests). There is no form post, no cookie and
  no hidden field.**
  - Consequence: the DEC-018 §2 form-post descriptor is **not built**, and `discovery.ts`, `http.ts`, `pdf.ts`,
    `ingest-etf.ts` and `detect-adapter.ts` **do not change**.
  - `reports.source_url` stays non-null for ICBETNETF (a real PDF URL exists), so tech-lead binding point 5
    (nullable `sourceUrl`) does not apply.
  - Tech-lead binding points 1–2 (`redirect: "manual"`, `fetchOnce` options) apply only to *new* access code.
    None is written, so the BRD/link path keeps today's `fetchOnce` behaviour, as point 1 requires.
  - Binding point 4 (a third request, so Blocked on US-030) does not trigger: the request count stays 2.
- The report is extractable. `unpdf` 0.11.0 gives flat text with stable bilingual labels, and the report date is in
  `"Data: 24.09.2026"`. The figures form a per-class table: Class A (EUR), Class B (RON, the class traded on BVB under
  `ICBETNETF`), and a TOTAL row. There is no investor breakdown.
- **PO note (not agent-editable):** requirements §3's "submit button, not a direct link" and "'VAN' instead of 'VUAN'"
  are superseded by FINDINGS §2–§3. The dev loop lists this for the user in HANDOVER.md. No agent edits
  `requirements/`.

## 1. Acceptance criteria → proof

Test ids are new unless marked "existing". "Unchanged" means the file is not in Files changed.

| AC | How it is proven |
|---|---|
| **AC1** Investigation recorded | `spikes/icbetnetf/FINDINGS.md` exists and already states: the URL, the `gv5News` markup, the mechanism (GET on a direct href), cookie **names** only, status/content type/bytes, label excerpts, and the verdict against both decision-1 conditions (§4). The implementer **appends §7 "Positional rule — per-class table"** (see §4 below) and one line saying the curl header dumps were not kept in the repo.<br>**Reviewer checks against fixtures:**<br>• markup claims vs fixture lines 760–778;<br>• `wc -c` of the page fixture = 70666 and of the PDF fixture = 306610 (FINDINGS §6). On a mismatch, FINDINGS is corrected, never the fixture;<br>• the text excerpt vs the `extractPdfText` output in IN-FX-1.<br>DI-1..DI-3 (below) prove the markup/link claims in code.<br>**MANUAL-QA 1:** the live capture. The user opens `https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s=ICBETNETF` → "Stiri", clicks the PDF icon of the newest "VAN la data …" row, and confirms it opens a PDF directly, with no form resubmission or login. |
| **AC2** Fixtures committed | Page and PDF fixtures already saved; README `bvb/README.md` §8 exists.<br>Task: add the ICBETNETF entry to `expected.json`, transcribed independently (§2.6).<br>Existing "every PDF has a manifest entry / every entry has a PDF" tests pass. **They fail today**, because the PDF has no entry yet.<br>**FX-7** (new, `lib/extraction/fixtures.test.ts`): the ICBETNETF HTML fixture and the ICBETNETF PDF's extracted text contain none of `ASP.NET_SessionId=`, `cookiesession1=`, `.ASPXAUTH=`, `Set-Cookie`, `DATABASE_URL`, `CRON_SECRET`, `_API_KEY`.<br>`__VIEWSTATE` is server page content present in every BRD fixture too; it is not a cookie or credential, and it stays. |
| **AC3** Discovery never returns a wrong link | BRD: `discovery.test.ts`, `ingest-etf.test.ts`, `ingest-etf.failures.test.ts` and `detect-adapter.test.ts` are unchanged and pass.<br>New `lib/extraction/discovery.icbetnetf.test.ts`:<br>• **DI-1** `discoverLatestReport` over the fixture (recording `fetchImpl`) → `found`, with `pdfUrl` = `https://bvb.ro/infocont/infocont26/ICBETNETF_20260925110032_2026-09-24-BET-ETF-Official-NAV.pdf`, `title` = `VAN la data 24.09.2026`, `publishedAt` = `2026-09-25T11:02` (read by hand, `bvb/README.md` §8); exactly 1 call.<br>• **DI-2** the returned URL occurs literally as an `href` inside the fixture's `gv5News` table. It is not one of the page's other PDFs (the prospectus `…ICETF-Prospect-2026.pdf`, the KID `…PRIIPs-KIID…pdf`). It does not contain `bvb_url`'s query.<br>• **DI-3** the fixture with the newest row's `<a …>…</a>` removed → the second row's own URL **and** its own title `VAN la data 23.09.2026` (title and href from the same row). The fixture with every `<a>` inside `gv5News` removed → `not_found` / `no_report_entries`, 1 call. |
| **AC4** Access requests exact and bounded (ADAPTER branch) | New `lib/ingestion/request-bound.test.ts` (global `fetch` stubbed with a recording fake; deps wired exactly like `createDailyRunDeps`, minus `getDb`, with an in-memory `ReportStore` fake):<br>• **AX-1** ICBETNETF happy path records exactly `[GET page URL, GET PDF URL]`.<br>&nbsp;&nbsp;– Request 1 carries `BVB_REQUEST_HEADERS`. Request 2 carries `PDF_REQUEST_HEADERS` (today's unchanged download identity; `pdf.test.ts` pins the shared User-Agent).<br>&nbsp;&nbsp;– Neither has a `method` other than GET, a body, a `Cookie` or a `Content-Type`.<br>&nbsp;&nbsp;– Both have origin `https://bvb.ro`.<br>&nbsp;&nbsp;– This matches FINDINGS §6.<br>• **AX-2 (sentinels)** the page response carries `Set-Cookie: ASP.NET_SessionId=SENTINELCOOKIE7731`, and the HTML's `__VIEWSTATE` value is replaced by `SENTINELHIDDEN4419`. For the happy path, and again with the PDF answering 500:<br>&nbsp;&nbsp;– neither sentinel appears in `JSON.stringify(outcome)`;<br>&nbsp;&nbsp;– neither appears in `formatRunLog(...)` built from that outcome (`lib/ingestion/job-run-summary.ts`);<br>&nbsp;&nbsp;– neither appears in any recorded request's URL or headers.<br>• **Button missing** → DI-3 (`not_found`, no download).<br>• **Form action / redirect to another host; POST-body PDF with NULL `source_url`: NOT APPLICABLE.** FINDINGS §2/§4 show no form and no redirect, so no new access code exists for these rules to govern (DEC-018 §1 "New access code"). The link path's host handling is US-007 AC5 and stays unchanged (see §3 R4). `source_url` = the PDF URL, which is non-null (§0).<br>• Adapters gain no I/O: existing `adapters/boundaries.test.ts` iterates every non-test file, so it now covers `intercapital-nav.ts` and `text.ts`. |
| **AC5** Second adapter, label-based | New `lib/extraction/adapters/intercapital-nav.test.ts` (IN-*, text built from segments like `brd-depositary.test.ts`):<br>• **Identity:** key and `fieldKeys` = the seed catalogue rows for `intercapital-nav`.<br>• **Registration:** `defaultAdapterRegistry.get`, and `detect` on the default text.<br>• **Date:** `ok:false` if there is no `Data:`, the date is impossible (`31.09.2026`), or two `Data:` dates conflict. The same date twice is `ok`. The English `Date: 24. September 2026` alone gives `ok:false`. The Croatian page-2 dates (`24.09.2026`, `Ispisano na dan : 25.09.2026`) are never used.<br>• **Rows:**<br>&nbsp;&nbsp;– default gives all 8 values;<br>&nbsp;&nbsp;– rows in swapped order still give the same values (label-based);<br>&nbsp;&nbsp;– a wrong currency token (`USD` in class A) makes class A's 3 fields missing;<br>&nbsp;&nbsp;– a row missing one number, a row with one extra number, or a European-format token (`26,9315`) makes that row's fields missing and leaves the others intact (never shifted);<br>&nbsp;&nbsp;– a missing class label makes only that row missing;<br>&nbsp;&nbsp;– missing `TOTAL` makes only the two total fields missing;<br>&nbsp;&nbsp;– reordered or missing header columns make all class-row fields missing.<br>• **Purity:** A-B-A.<br>• **`canHandle`:** true on the default text and with whitespace/newline runs. False on empty text, unrelated text, BRD-shaped text, and with any header label missing. `brdDepositaryAdapter.canHandle(ICBETNETF text)` is false.<br>Fixture level (`fixtures.test.ts`, generalised):<br>• **FX-2** the pipeline test extracts `expected.json`'s ICBETNETF entry exactly, with no missing field and no violation;<br>• **FX-5** for every manifest entry, `registry.detect(text)` is exactly the entry's adapter;<br>• **FX-6** for every entry × every registered adapter, `canHandle` is true only when the keys match.<br>No new formatting code: no file under `lib/format/`, `components/HomeTable*` or `components/EtfDetail*` changes. Values reach the UI through the existing `formatNumber`/`formatReportDate` path (reviewer check). |
| **AC6** End to end on PGlite | New `lib/ingestion/ingest-icbetnetf.pglite.test.ts` (global `fetch` stubbed over the two ICBETNETF fixtures, real `extractPdfText`, catalogue rows inserted from `seedFieldCatalog`):<br>• **IC-E2E-1** ETF `ICBETNETF` with `adapter_key = 'intercapital-nav'` and tracked `nav_per_unit`, `units_in_circulation`. Shipped `ingestEtf` returns `ok`. There is one `reports` row: `report_date` 2026-09-24, `status` ok, `source_url` = the PDF URL. Its two `report_values` equal `expected.json`.<br>• **IC-E2E-2** a rerun gives `already_ingested`, still one row (DEC-010 never-downgrade).<br>• **IC-E2E-3** shipped `createHomeTableLoader(db.mockDb, defaultAdapterRegistry, db.runner)()`: the ICBETNETF row has `adapterAvailable: true`, its two values, report date 2026-09-24 and link = the PDF URL. The two column labels equal the (shared) catalogue labels.<br>• **IC-E2E-4** `addEtf({ symbol: "ICBETNETF", name: "InterCapital BET-TRN UCITS ETF" })`, with `detect` = shipped `detectAdapter` over shipped discover/download/extract. The result is `added` / `intercapital-nav` / `detected`, the row stores the key, and no `reports`/`report_values`/`tracked_fields` row is written. |
| **AC7** FALLBACK branch | **NOT APPLICABLE**: FINDINGS §4 verdict is ADAPTER, with both conditions holding. The reviewer confirms that the shipped branch matches FINDINGS (story "Branch evidence"). |
| **AC8** BRD sub-searches bounded | `brd-depositary.test.ts` gains:<br>• **BB-1:** investors label **and** the units block's `Persoane fizice` removed → `units_held_individuals` is missing and no value equals `18,631`. `units_held_legal_entities` is still `7,736,222`.<br>• **BB-2:** the investors block's `Persoane fizice` removed and `Persoane fizice 999` placed in the signature segment (after the documented boundary) → `investors_individuals` is missing and `999` is not taken. `investors_legal_entities` is still `77`.<br>All existing BRD text tests and the six BRD manifest entries pass unchanged. |
| **AC9** Per-ETF request bound | `export const MAX_REQUESTS_PER_ETF = 2` in `lib/ingestion/run-daily.ts`, next to `CRON_FETCH_TIMEOUT_MS`.<br>In `request-bound.test.ts`:<br>• **RB-1** BRD happy path (BTBETRETF fixtures) makes exactly `MAX_REQUESTS_PER_ETF` calls;<br>• **RB-2** ICBETNETF (the AX-1 run) makes the same;<br>• **RB-3** failure paths (page 500; PDF 500; not a PDF) are each ≤ the constant;<br>• **RB-4** the add-time `detectAdapter` path is ≤ the constant.<br>**RT-7b** changes one token, `2` → `MAX_REQUESTS_PER_ETF`, imported from `run-daily`. Its budget stays 3 × 2 × 7 s + 15 s = 57 s ≤ 60 s, and it is not weakened. `seedEtfCount` stays; US-030 AC7 replaces the test.<br>Add-time budget (tech-lead point 4): chat add = `AI_PROVIDER_TIMEOUT_MS` 20 s + 2 × 7 s + 15 s allowance = 49 s ≤ 60 s. Admin add = 29 s. Pinned by **CPG-4b** (`app/chat/page.test.tsx`) and **PG-7b** (`app/admin/etfs/page.test.tsx`). These are new `it` blocks over the constants and the page's `maxDuration`; existing expectations are untouched. |
| **AC10** Label invariant, offline, gates | `lib/db/seed-data.test.ts`:<br>• **SL-1** `findSharedKeyConflicts(seedFieldCatalog)` is `[]`. The function is defined once in this test file: it groups rows by `fieldKey` and reports any key defined by more than one `adapterKey` with a different `labelRo`, `labelEn` or `unit`.<br>• **SL-2** the same function over a synthetic catalogue (two adapters, same key, different `labelEn`) returns exactly that conflict.<br>• **SL-3** at least one key really is shared in the shipped catalogue, so SL-1 is not vacuous.<br>No new dependency: `package.json` and `pnpm-lock.yaml` are untouched. Every new test stubs global `fetch` to throw.<br>Gates: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and `env -u DATABASE_URL pnpm build`. |

## 2. Files and boundaries

### 2.1 New
- `lib/extraction/adapters/text.ts`: the pure text helpers moved out of `brd-depositary.ts` **unchanged**: `labelSource`, `findLabel`, `tokenAfter`. New additions:
  - `tokenWindowEnd(text, from, n)`: the index just after the n-th whitespace-separated token from `from`, or `text.length`;
  - `tokensAfter(text, from, n)`: the next n tokens with their end offsets;
  - `parseDottedDate("DD.MM.YYYY")`: an ISO date or null (via `isIsoCalendarDate`).

  No I/O, only `./validate` imports. Tested in `text.test.ts` (TX-*).
- `lib/extraction/adapters/intercapital-nav.ts`: `INTERCAPITAL_NAV_KEY = "intercapital-nav"`, `INTERCAPITAL_FIELD_KEYS`, `intercapitalNavAdapter`. Rules in §4.
- Tests: `adapters/text.test.ts`, `adapters/intercapital-nav.test.ts`, `lib/extraction/discovery.icbetnetf.test.ts`, `lib/ingestion/request-bound.test.ts`, `lib/ingestion/ingest-icbetnetf.pglite.test.ts`.

### 2.2 Changed
- `lib/extraction/adapters/brd-depositary.ts`: imports the helpers from `./text`, plus the AC8 bounds (§4.3). No other logic change.
- `lib/extraction/adapters/brd-depositary.test.ts`: adds BB-1, BB-2. Existing tests are untouched.
- `lib/extraction/adapters/default-registry.ts`: `REGISTERED_ADAPTERS = [brdDepositaryAdapter, intercapitalNavAdapter]`.
- `lib/db/seed-data.ts`: 8 `intercapital-nav` catalogue rows (§4.4). `seedEtfs` and `seedTrackedFields` are unchanged. ICBETNETF is **not** seeded (out of scope).
- `lib/db/seed-data.test.ts`:
  - the catalogue count changes from 8 to 16. The cited reason is AC5's new rows; this is a count, not a weakened assertion;
  - adds SL-1..SL-3.
- `lib/db/seed.pglite.test.ts`: `fieldCatalog: 8` → `16` in SD-1/SD-2/SD-3, for the same cited reason. Everything else is unchanged.
- `lib/extraction/fixtures.test.ts`: generalised, with each edit's reason given (story Task 8, and ICBETNETF not seeded):
  - **FX-1 (manifest shape):** value keys = `defaultAdapterRegistry.get(entry.adapterKey).fieldKeys`, instead of BRD's. If the symbol is seeded, `adapterKey` must equal the seed's (as today). Otherwise the adapter must be registered and the symbol must be absent from `seedEtfs`, which proves the non-seeded case is deliberate.
  - **FX-5:** "detect returns brd-depositary" becomes "detect returns `registry.get(entry.adapterKey)`". This is identical for every BRD entry.
  - **FX-6** (new) is the canHandle matrix. **FX-7** (new) is the no-secret scan.
  - The BRD consistency block (units/investors sums, VUAN ≈ net/units) runs over `manifest.filter(e => e.adapterKey === "brd-depositary")`, with the same assertions for the same six entries.
  - New **FX-8** runs over the `intercapital-nav` entries, on both the manifest and the pipeline:
    - `units_class_a + units_in_circulation = units_total` (`sumsExactly`);
    - `total_nav_class_a + total_nav_class_b = total_nav`;
    - `nav_per_unit_class_a × units_class_a` is within 1 % of `total_nav_class_a` (a mis-anchoring guard, not an AC).
    - Class B has no such check (RON vs EUR).
  - The "not vacuous" test also requires at least one `intercapital-nav` entry.
- `test/fixtures/expected.json`: the ICBETNETF entry.
- `test/fixtures/README.md`:
  - "the eight `brd-depositary` fields" becomes "the adapter's `fieldKeys`";
  - the date is "the report's own report-date text (BRD footer / InterCapital `Data:` line)";
  - a line saying that non-seeded symbols are captured by hand (curl, FINDINGS §1), because `report:latest` resolves seeded symbols only;
  - the "ICBETNETF out of scope" note is removed.
- `lib/ingestion/run-daily.ts`: `MAX_REQUESTS_PER_ETF`, with a doc comment ("most requests any access path makes for one ETF in the daily run; DEC-018 §5").
- `app/api/cron/daily/route.test.ts`: RT-7b uses the constant (one token).
- `app/chat/page.test.tsx` (+CPG-4b), `app/admin/etfs/page.test.tsx` (+PG-7b).
- `components/admin/TrackedFieldsAdmin.tsx`: `KNOWN_UNITS` gains `"EUR"`. `messages/en.json` and `messages/ro.json` gain `Admin.fields.units.EUR = "EUR"`. This keeps the new unit on the translated path like `RON`; key parity holds.
- `spikes/icbetnetf/FINDINGS.md`: appends §7 (positional rule) and the headers-not-kept line.
- `dev_minions/architecture/data-model.md`, Write rules: "report-date footer" becomes "the PDF's own report-date text (BRD: footer; InterCapital: the `Data:` line)". This is wording only, with no rule change; the reviewer confirms.

### 2.3 Not changed (reviewer: must not appear in Files changed)
- `lib/extraction/discovery.ts`, `http.ts`, `pdf.ts`.
- `lib/ingestion/ingest-etf.ts`, `store.ts`.
- `lib/config/detect-adapter.ts`, `etfs.ts`.
- `lib/monitoring/*`, `components/HomeTable*`, `components/EtfDetail*`, `lib/format/*`.
- `discovery.test.ts`, `ingest-etf*.test.ts`, `detect-adapter.test.ts`.
- `package.json`, `pnpm-lock.yaml`.

### 2.4 Boundaries
Adapters stay text → values (US-009, `adapters/boundaries.test.ts`). The report format is in the adapter. The access mechanism is untouched in discovery (DEC-018 §2). The catalogue is seed-only (US-020 decision 1).

### 2.5 `report:latest`
Unchanged. It resolves seeded symbols only, and ICBETNETF is not seeded, so it answers with its existing "unknown symbol" error. Fixtures for non-seeded symbols are captured by hand (README line above).

### 2.6 Independent transcription of `expected.json` (story "Notes for verification")
The implementer transcribes the report date and the 8 values:
1. by eye from the rendered PDF page 1 (open `test/fixtures/ICBETNETF-2026-09-24.pdf` in a PDF viewer; the Read tool renders PDF pages);
2. cross-checked against `cd spikes/pdf-extraction && node compare.mjs` (pdf-parse, its own `node_modules`; it reads every PDF in `test/fixtures/`);
3. cross-checked against page 2's custodian restatement (European number format).

Never from FINDINGS' excerpt, `extracted-text-sample.txt`, the new adapter, or `report:latest`. The `source` string records exactly that. `rawValue` keeps the comma-thousands form as printed on page 1.

## 3. Data model and migration
No schema change and no migration. Only the seed's `field_catalog` upsert gains 8 rows. It is idempotent (US-020 AC1, SD-4). On Neon it is applied by the user with `pnpm db:seed` (MANUAL-QA 2).

## 4. Design details

### 4.1 `intercapital-nav` report date
- Every occurrence of the label `Data:` (with a letter boundary before it) must be followed by a `DD.MM.YYYY` token that is a real calendar date, and all occurrences must agree.
- Zero occurrences, a bad token or a conflict gives `ok: false`.
- The English `Date: 24. September 2026` is not parsed (FINDINGS §5).
- The filing stamp in the URL and the Croatian page-2 dates are never read.

### 4.2 `intercapital-nav` values (positional rule, documented in FINDINGS §7)
- **Header anchor.** The labels `NAV per Unit VUAN`, `Number of Units` and `Total NAV (EUR) VAN total (EUR)` must be found in this order. `headerEnd` is the end of the third. If any is missing or out of order, every field is missing, because the column order is unknown.
- **Class rows.** For each of `Class A Clasa A` (expected currency `EUR`) and `Class B Clasa B` (expected currency `RON`), search after `headerEnd` and take the next 5 tokens `t1..t5`. The row is accepted only if:
  - `t1` equals the expected currency, **and**
  - `t2..t4` each pass `parseReportNumber`, **and**
  - `t5` is absent or is not a number (the row boundary).

  If accepted, the fields are, in header order: NAV per unit, units, total NAV. Otherwise all three of that row's fields are missing (never shifted, never partial).
- **TOTAL row.** The whole-word, case-sensitive `TOTAL` after `headerEnd`, then `t1..t3`. `t1` and `t2` must be numbers and `t3` must be absent or not a number. That gives units, then total NAV.
- All labels are ASCII-only (the diacritic labels such as `Număr de Unități` are avoided), whitespace-run tolerant via `labelSource`.
- **`canHandle`** is the header sequence found in order. This is structure-based. It is false on BRD text, which has no `NAV per Unit`, and BRD's `canHandle` is false on this text, which has no `Raport depozitar la data de`.

### 4.3 BRD bounds (AC8)
New constant `BRD_BLOCK_TOKENS = 7`: a block's total, then two `label (2 tokens) + value` pairs, per the `spikes/pdf-extraction/FINDINGS.md` excerpt.
- **Units sub-searches** stop at `min(investorsLabel.start if it is after unitsEnd, tokenWindowEnd(text, unitsEnd, 7))`.
- **Investors sub-searches** stop at `tokenWindowEnd(text, investorsEnd, 7)`.
- The VUAN gap rule is unchanged.

Every existing BRD text test was checked by hand against the new bounds and still holds (e.g. "units' Persoane juridice removed": the window holds no `Persoane juridice`, so the field is missing, as today).

### 4.4 Catalogue rows (`adapterKey: "intercapital-nav"`)

| fieldKey | labelRo | labelEn | unit | source row |
|---|---|---|---|---|
| `nav_per_unit` | Valoare unitară a activului net (VUAN) | Net asset value per unit | RON | Class B, NAV per unit — **shared, labels identical to BRD** |
| `units_in_circulation` | Unități de fond în circulație | Units in circulation | count | Class B, units — **shared, labels identical to BRD** |
| `total_nav_class_b` | Activ net total, clasa B (EUR) | Total net asset value, class B (EUR) | EUR | Class B, total NAV |
| `nav_per_unit_class_a` | Valoare unitară a activului net (VUAN), clasa A (EUR) | Net asset value per unit, class A (EUR) | EUR | Class A |
| `units_class_a` | Unități de fond, clasa A | Units, class A | count | Class A |
| `total_nav_class_a` | Activ net total, clasa A (EUR) | Total net asset value, class A (EUR) | EUR | Class A |
| `units_total` | Unități de fond, toate clasele | Units, all classes | count | TOTAL |
| `total_nav` | Activ net total, toate clasele (EUR) | Total net asset value, all classes (EUR) | EUR | TOTAL |

**Rule applied (DEC-018 §3).** A class-B figure reuses a BRD key only when it is the same measure of the BVB-listed units, in the same unit:
- `ICBETNETF` is the Class B ticker (report text);
- requirements §3 calls "VAN" a different *term*, not a different parameter.

`net_asset` is **not** reused: BRD's is RON and this is EUR. The PRODUCT question in §5 lets the PO choose otherwise.

### 4.5 Risks
- **R1** The suite is red now: the new PDF fixture has no manifest entry. Land the manifest entry (§2.6) early, before any other change.
- **R2** unpdf text may differ from the spike sample, for example in token splitting. The adapter is written against `extractPdfText` of the committed fixture, not the sample. IN-FX-1 is the first test written: it extracts the fixture and asserts the header labels and the `Data:` token are present.
- **R3** The 7-token BRD window is a positional bound. It is documented and proven on all six BRD fixtures. A future BRD layout change fails loudly as "missing", which is never a wrong value.
- **R4** The link path accepts an `href` on another host (US-007 AC5, existing test). This is not changed here: it is not new access code, and changing it would edit US-007 tests. It is noted for the tech-lead as a possible hardening follow-up. It is not an open decision for this story.
- **R5** If the PO answers §5 differently **after** ICBETNETF values were stored live, the history stays under the old keys (`field_key` is not an FK). The PO should answer at the demo, before tracking ICBETNETF fields live.
- **R6** A cold PGlite plus an unpdf parse is slow. Give the E2E tests a 30–60 s timeout like E2E-1.

Suggested order: manifest entry → `text.ts` move (BRD green) → BB-1/BB-2 + bounds → adapter + IN tests → registry/seed/SL → fixtures generalisation → DI/AX/RB → E2E → RT-7b/CPG-4b/PG-7b → README/FINDINGS/data-model wording → gates.

## 5. Decisions needed

| # | Type | Question | Options | Recommendation / shipped default | Isolated default? |
|---|---|---|---|---|---|
| D1 | PRODUCT | Which ICBETNETF figures share the BRD ETFs' home-table columns? | (a) The class-B (BVB-listed) NAV per unit and units reuse `nav_per_unit` / `units_in_circulation`, so the four starting ETFs line up in the VUAN and units columns; everything else gets its own key. (b) Every ICBETNETF figure gets its own key: separate columns, with no mixing of the class-B figure and the fund figure (FINDINGS §5's suggestion). (c) As (a), but units go to `units_total` (all classes) instead of class B. | **(a) ships.** It is the literal reading of requirements §3 ("different terminology" for the same parameter) and FR2's VUAN example, and it follows DEC-018 §3 (same measure, same unit, identical labels). | **Yes.** Confined to the `intercapital-nav` rows in `lib/db/seed-data.ts` and the class-B-row → key mapping in `lib/extraction/adapters/intercapital-nav.ts` (plus the matching FX-8 / E2E expectations). **NEEDS USER.** Answer before tracking ICBETNETF fields live (R5). |

Sprint decision #4 (symbol link with no PDF URL) is unaffected, because ICBETNETF has a URL. No TECHNICAL item is open.

## 6. Manual QA (live, user) — goes into `US-029-qa.md`
1. **(AC1)** The live check of the ICBETNETF "Stiri" PDF icon: it opens a PDF directly.
2. **(sprint step 2)** After deploying:
   - run `DATABASE_URL=<neon-url> pnpm db:seed`;
   - run `select field_key, label_ro, label_en, unit from field_catalog where adapter_key = 'intercapital-nav';`, which should give 8 rows.
3. **(sprint step 3)** In `/admin/etfs`:
   - add `ICBETNETF`, or re-detect it if it was added earlier, and check that the adapter shown is `intercapital-nav`;
   - on its Fields page, track "Net asset value per unit" and "Units in circulation";
   - after the next daily run (or a manual cron run), the home row shows the values in the same columns as the BRD ETFs, the report date, and a symbol link to the PDF;
   - compare every value and the date by eye with the PDF's page 1 (class B row).
4. **(D1)** Answer the PRODUCT item above.

## 7. Files changed (to copy into HANDOVER.md)
- new:
  - `lib/extraction/adapters/text.ts`, `text.test.ts`, `intercapital-nav.ts`, `intercapital-nav.test.ts`
  - `lib/extraction/discovery.icbetnetf.test.ts`
  - `lib/ingestion/request-bound.test.ts`, `lib/ingestion/ingest-icbetnetf.pglite.test.ts`
- changed:
  - `lib/extraction/adapters/brd-depositary.ts`, `brd-depositary.test.ts`, `default-registry.ts`
  - `lib/db/seed-data.ts`, `seed-data.test.ts`, `seed.pglite.test.ts`
  - `lib/extraction/fixtures.test.ts`
  - `test/fixtures/expected.json`, `test/fixtures/README.md`
  - `lib/ingestion/run-daily.ts`
  - `app/api/cron/daily/route.test.ts`, `app/chat/page.test.tsx`, `app/admin/etfs/page.test.tsx`
  - `components/admin/TrackedFieldsAdmin.tsx`, `messages/en.json`, `messages/ro.json`
  - `spikes/icbetnetf/FINDINGS.md`, `dev_minions/architecture/data-model.md`
- already saved in Phase A:
  - `spikes/icbetnetf/FINDINGS.md`, `spikes/icbetnetf/extracted-text-sample.txt`
  - `test/fixtures/bvb/ICBETNETF-instrument-2026-09-27.html`, `test/fixtures/bvb/README.md` (§8)
  - `test/fixtures/ICBETNETF-2026-09-24.pdf`
