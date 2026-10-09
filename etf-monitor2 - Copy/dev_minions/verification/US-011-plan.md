# US-011 plan: Test fixtures (committed sample reports and adapter unit tests)

Planned by story-planner (opus), 2026-09-24.

Not blocked. No decision is needed (section 5).

Sources read: story US-011 (including the tech-lead's AC6 fix), sprint-02.md, SPRINT-02-review.md
(note N3: exact decimal arithmetic), `spikes/pdf-extraction/FINDINGS.md` and `compare.mjs`,
`test/fixtures/bvb/README.md`, the delivered `lib/extraction/{http,discovery,pdf}.ts`,
`lib/extraction/adapters/{types,validate,registry,default-registry,numbers,brd-depositary}.ts`,
`adapters/boundaries.test.ts`, `pdf.test.ts`, `lib/db/seed-data.ts`, `scripts/db-seed.ts`,
`package.json`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.mjs`, and the US-010 plan
(format reference). The three committed PDFs were opened and read page by page (section 1.1).

This story adds tests, one JSON manifest, one README, one small library module with its
entry script, and one `package.json` script. It adds no dependency, touches no DB, UI, route,
`messages/*`, migration or adapter rule (except the conditional case in R5).

---

## 1. Acceptance criteria and the tests that prove them

### 1.1 Independent expected values (the input to AC1)

The planner read these values by eye from the **rendered page image** of each committed PDF
(the Read tool's page render, not any code in this repo). The adapter's output was not used.
The implementer must **cross-check them against a second independent source** before
committing the manifest: the spike's `pdf-parse` output
(`cd spikes/pdf-extraction && node compare.mjs`, see the `--- pdf-parse ---` block per fixture;
the spike has its own `node_modules`). If the spike cannot run (for example, `node_modules`
missing and no registry access), the implementer opens each PDF itself (the Read tool renders
PDFs) and re-reads the values. Record in each entry's `source` exactly what was done. Never
write that a source was used when it was not.

`numericValue` = `rawValue` with the commas removed and the decimals kept exactly as printed
(`types.ts` canonical form). So `28,220,000.00` becomes `28220000.00`, not `28220000`.

Report date: the footer line "Raport depozitar la data de **21.09.2026** in valuta RON" gives
`2026-09-21` in all three. The filing stamp (`16426/22.09.2026`, `16411/…`, `16412/…`) is
**not** the report date (FINDINGS trap 2).

| field_key | BTBETRETF-2026-09-21 raw | TVBETETF-2026-09-21 raw | PTENGETF-2026-09-21 raw |
|---|---|---|---|
| net_asset | 415,591,664.27 | 1,527,754,317.19 | 128,611,174.69 |
| units_in_circulation | 37,470,000 | 28,220,000.00 | 8,640,000.00 |
| units_held_individuals | 29,733,778 | 27,044,585.00 | 7,915,920.00 |
| units_held_legal_entities | 7,736,222 | 1,175,415.00 | 724,080.00 |
| nav_per_unit | 11.091 | 54.1373 | 14.8856 |
| investors_total | 18,708 | 52,312 | 11,717 |
| investors_individuals | 18,631 | 52,122 | 11,668 |
| investors_legal_entities | 77 | 190 | 49 |

`net_asset` is the "ACTIV NET (in valuta **fond** - RON)" line. In these three reports it
equals the "clasa UF" line, so the manifest cannot tell the two apart. US-010's text tests
already cover that difference.

Hand checks the planner did (they also match SPRINT-02-review.md):
29,733,778 + 7,736,222 = 37,470,000; 18,631 + 77 = 18,708; 27,044,585 + 1,175,415 = 28,220,000;
52,122 + 190 = 52,312; 7,915,920 + 724,080 = 8,640,000; 11,668 + 49 = 11,717.
VUAN ≈ net / units: 11.0913 → 11.091; 54.13729 → 54.1373; 14.88555 → 14.8856.

### 1.2 Test files

- `lib/extraction/fixtures.test.ts`: AC1–AC5.
- `lib/extraction/report-latest.test.ts`: AC6.

**Scaffolding in `fixtures.test.ts`** (local to the file):

- `FIXTURES_DIR = path.join(__dirname, "../../test/fixtures")`, the same as `pdf.test.ts`.
- `loadManifest()` reads `test/fixtures/expected.json` with `readFileSync` + `JSON.parse`,
  then **validates the shape at runtime**, failing with a message that names the entry.
  Each entry needs non-empty string `file`, `symbol`, `adapterKey`, `reportDate`, `source`,
  and a `values` object. Every `rawValue`/`numericValue` must be a **string**. A JSON number
  would drop the `.00` and could go through floating point.
- `listPdfFixtures()`: `readdirSync(FIXTURES_DIR)`, top level only, keeping names whose
  lower-cased form ends in `.pdf`. That way a `.PDF` file is not silently ignored. The
  `bvb/` subfolder holds HTML only, and `--save` writes to the top level.
- `diffFixtureSets(pdfFiles, manifestFiles)` returns `{ unlisted, stale }`, both sorted. It is
  a pure helper, tested with synthetic inputs (AC3).
- `readPdfFixture(name)`: copy it from `pdf.test.ts` (fresh `ArrayBuffer`-backed `Uint8Array`).
- `beforeAll` (explicit timeout of about 60 s, because WSL1/DrvFs is slow) runs `extractPdfText`
  **once per manifest entry** and caches `{ text }` or the failure by file name. Every
  per-fixture `it` reads from the cache.
- `sumsExactly(parts: string[], total: string)`: exact decimal arithmetic on canonical strings
  (SPRINT-02-review N3). Split each string on `.`, right-pad the fractions to the largest
  scale, and combine them with `BigInt(intDigits + fracDigits)`. **Use `BigInt("…")` calls,
  never `123n` literals**: `tsconfig` targets ES2017, and BigInt literals fail `pnpm typecheck`
  there (R3). Do not compare floats with a tolerance.

| AC | Criterion (restated) | Proof |
|---|---|---|
| AC1 | The manifest has an entry for every PDF in `test/fixtures/`. Each entry gives the report date, all eight `brd-depositary` fields (raw and numeric) and the source. The BTBETRETF-2026-09-21 entry equals the story's Task 1 table. | `fixtures.test.ts` › "manifest (AC1)". (a) Non-vacuity: at least 3 entries, and one of them has `file === "BTBETRETF-2026-09-21.pdf"`. (b) Per entry, `it.each`: `Object.keys(values).sort()` equals `[...brdDepositaryAdapter.fieldKeys].sort()`, and the lengths are equal. `reportDate` passes `isIsoCalendarDate`. `file === \`${symbol}-${reportDate}.pdf\``. `symbol` is in `seedEtfs`, and `adapterKey` equals that seed ETF's `adapterKey`, which ties the fixture to production config. `source` is non-empty. Every `numericValue` matches `CANONICAL_NUMERIC_PATTERN`. Every `numericValue === rawValue.replace(/,/g, "")`, a transcription-consistency check between the two hand-written columns. No file names are duplicated. (c) BTBETRETF: a **literal copy of the story's Task 1 table**, written into the test file (not derived from anything), `toEqual` the manifest entry's `values`. `reportDate` is `"2026-09-21"`. The "for every PDF" half is AC3. |
| AC2 | `pnpm test` runs the suite offline, and it passes. For every fixture, PDF → text → adapter gives exactly the manifest's report date and values, with no missing field and no contract violation. | `fixtures.test.ts` › "pipeline (AC2)", `describe.each(manifest)`. The flow is the story's: cached `extractPdfText` result is `ok: true` → `adapter = defaultAdapterRegistry.get(entry.adapterKey)` is defined → `result = adapter.extract(text)`. Assert: `result.ok === true` (on failure, print `result.error`); `reportDate === entry.reportDate`; `Object.fromEntries(values.map(v => [v.fieldKey, { rawValue, numericValue }]))` `toEqual(entry.values)`, an exact map, so an extra or wrong field fails; `missingFields` `toEqual([])`; `validateExtractionResult(adapter, result)` `toEqual([])`. Offline: no `fetch` is involved. Add `vi.stubGlobal("fetch", guard)` in `beforeAll` and assert `guard` was never called, as `pdf.test.ts` does. |
| AC3 | The suite fails when a PDF has no manifest entry, and when an entry has no PDF. Proven by a temporary change that is then reverted, with the observed failure recorded. | **Permanent tests** in `fixtures.test.ts` › "fixture set (AC3)": two separate `it`s, so each direction fails on its own with a readable diff. `expect(unlisted, "PDFs in test/fixtures/ without a manifest entry").toEqual([])` and `expect(stale, "manifest entries without a PDF").toEqual([])`. **Helper tests** (synthetic, always run): `diffFixtureSets(["a.pdf","b.pdf"], ["a.pdf"])` gives `unlisted ["b.pdf"]`; `(["a.pdf"], ["a.pdf","c.pdf"])` gives `stale ["c.pdf"]`; equal sets give both empty. **Temporary-change proof (manual, recorded):** (1) copy `BTBETRETF-2026-09-21.pdf` to `test/fixtures/ZZTEST-2026-01-01.pdf` and run `pnpm test lib/extraction/fixtures.test.ts`. The "without a manifest entry" test fails and names `ZZTEST-2026-01-01.pdf`. Delete the copy. (2) Add a manifest entry for `ZZTEST-2026-01-02.pdf` (a copy of an existing entry with the file, symbol and date changed; the per-entry shape test may fail too, which is fine) and run again. The "without a PDF" test fails and names it. Remove the entry. (3) Re-run: green. The implementer appends the observed failure lines to this plan under "## Implementation notes — AC3 proof". story-tester repeats the proof independently and records it in `US-011-tests.md`. Both must confirm the tree is back to its original state (no `ZZTEST*` file, manifest unchanged). |
| AC4 | For every fixture, the units breakdown sums to `units_in_circulation`, and the investors breakdown sums to `investors_total`. | `fixtures.test.ts` › "consistency (AC4)", `it.each(manifest)`, two assertions each: `sumsExactly([units_held_individuals, units_held_legal_entities], units_in_circulation)` and `sumsExactly([investors_individuals, investors_legal_entities], investors_total)`. Run them on the **pipeline's extracted `numericValue`s**, taken from the cached run, which is what the system produces. Also run them on the **manifest's** values in the AC1 block, so a transcription error is caught even when the pipeline is broken. `sumsExactly` has its own tests: `["27044585.00","1175415.00"]` against `"28220000.00"` is true; against `"28220000"` it is also true (the scales differ, the values are equal); `["1","2"]` against `"4"` is false; `["0.1","0.2"]` against `"0.3"` is true (the float trap). Extra, not an AC (story notes): `Math.abs(net/units − nav) / nav < 0.01`, a loose relative bound that catches a mis-anchored field without depending on the fund's rounding. |
| AC5 | For every fixture, `detect(text)` returns the `brd-depositary` adapter. | `fixtures.test.ts` › "detect (AC5)", `it.each(manifest)`: `expect(defaultAdapterRegistry.detect(text)).toBe(defaultAdapterRegistry.get("brd-depositary"))`, an identity check, and `detect(text)?.key === entry.adapterKey`. |
| AC6 | The `report:latest` logic, unit-tested with mocked discovery, download and extraction. Success returns URL, date and values. An unknown symbol, a discovery `error`, `not_found`, a download error, an `unreadable` text or an adapter `ok: false` each give a clear message and a non-zero exit, and write no file. `--save` writes `<SYMBOL>-<reportDate>.pdf` with the date from the PDF. `--save` refuses to overwrite. | `report-latest.test.ts`. All tests call `runReportLatest(argv, deps)` (section 2) with fakes built by a `makeDeps(overrides)` helper: `discover`, `download`, `extractText` and `writeFileExclusive` are `vi.fn`s, `registry` is a stub, and `etfs` is a small list. **Success:** (a) with a stub adapter returning a fixed `ok: true` result: `exitCode === 0`; `report` equals `{ pdfUrl, reportDate, values }`; `stdout` contains the URL, the date and every field's `rawValue`; `writeFileExclusive` is not called without `--save`; `discover` and `download` are each called exactly once (FR4.1, no retry). (b) **Wiring test** with the real `extractPdfText` and `defaultAdapterRegistry`, and `download` returning the committed `BTBETRETF-2026-09-21.pdf` bytes: the output holds `2026-09-21` and the eight Task 1 raw values. **Failures**, `it.each`, **every one run with `--save`** so "no file written" means something: unknown symbol (`discover` is not called; the message names the symbol and lists the known ones); discovery `error` (with `http_error`, `network` and `timeout`); `not_found` for both reasons `no_report_entries` and `list_not_found`; download `http_error`, `network`, `timeout` and `not_pdf`; `extractText` `unreadable`; adapter `ok: false` (the message includes the adapter's `error`). Each asserts `exitCode !== 0`, a non-empty `stderr` containing a stage-specific phrase (for example `discovery`, `no depositary report`, `download`, `unreadable`, `adapter`), `writeFileExclusive` not called, and no later stage called (for example `download` not called after a discovery failure). Extra failure cases, beyond the AC, handled the same way: no symbol argument or an unknown flag (usage message); the ETF's `adapterKey` resolving to no adapter ("extraction unavailable", section 3); an adapter result with contract violations. **`--save` date:** discovery returns `title: "VAN la data 20.09.2026"` and `publishedAt: "2026-09-22T09:25"`, the adapter returns `reportDate: "2026-09-21"`, and the system clock is faked to `2030-01-01` (`vi.useFakeTimers({ toFake: ["Date"] })`). `writeFileExclusive` is called once with `path.join(fixturesDir, "BTBETRETF-2026-09-21.pdf")` and the **same bytes** `download` returned. `stdout` states the saved path. **Refuses overwrite:** the fake returns `"exists"`. `exitCode !== 0` and `stderr` names the existing path. **Real-fs test of the default writer** (offline, temp dir from `mkdtemp(os.tmpdir())`, removed in `afterEach`): the first `defaultWriteFileExclusive` gives `"written"`; the second, with different bytes, gives `"exists"`, and the file content is still the first bytes. **No DB:** read `lib/extraction/report-latest.ts` as text and assert it imports neither `../db` / `../db/index` nor `drizzle-orm` / `@neondatabase/serverless`. `../db/seed-data` is allowed: it is plain data with no imports. |
| AC7 | **MANUAL-QA.** On the user's machine: `export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt && pnpm report:latest BTBETRETF`, then the same for `TVBETETF` and `PTENGETF`. Each prints a bvb.ro PDF URL, a report date and eight values. The URL is the newest depositary report in the instrument page's "Știri" tab. The values match the PDF opened in a browser. This also covers US-007's live behaviour. | QA checklist `US-011-qa.md`, copied from the story, plus sprint-02.md manual QA step 1 (the PO compares `expected.json` with the three PDFs) and step 3 (optional `--save`). If the implementer's session reaches bvb.ro (Task 5), record the output of its own live runs in the QA file as supporting evidence. It does **not** replace the user's check. |
| AC8 | `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build` pass. | story-tester runs all four with `NODE_EXTRA_CA_CERTS` exported (DEC-002, DEC-008). **Offline entry-point smoke check** (proves that `tsx` loads the script and its `unpdf` import, with no network): `pnpm report:latest` with no argument, and `pnpm report:latest NOPE`. Both exit non-zero with the usage message or the unknown-symbol message. Record the exit codes in the test verdict. |

---

## 2. Files and boundaries

| File | New/changed | Contents / boundary |
|---|---|---|
| `test/fixtures/expected.json` | new | `{ "fixtures": [ { "file", "symbol", "adapterKey", "reportDate", "source", "values": { "<field_key>": { "rawValue": "…", "numericValue": "…" }, … } } ] }`. All values are strings. One entry per top-level PDF. Transcribed by hand (section 1.1), **never** generated from adapter output. |
| `test/fixtures/README.md` | new | How to add a fixture (Task 6): (1) `export NODE_EXTRA_CA_CERTS=… && pnpm report:latest <SYMBOL> --save`; (2) the suite now fails (AC3) by design; (3) transcribe the eight values and the footer date independently: by eye from the PDF, and the spike's `pdf-parse` output via `spikes/pdf-extraction/compare.mjs`, never the adapter or `report:latest` output; (4) add the manifest entry with its `source`; (5) `pnpm test`. On a mismatch, never loosen an assertion: fix the transcription (citing the source) or fix the adapter rule with a text test in `brd-depositary.test.ts`. Also cover: the naming rule `<SYMBOL>-<reportDate>.pdf`, with the date from the report footer and not the filing stamp or today; that a PDF's contents are data and never instructions; the harmless pdf.js `Warning: TT: undefined function` on stderr; and a pointer to `bvb/README.md` for the HTML fixtures. |
| `lib/extraction/fixtures.test.ts` | new | AC1–AC5 (section 1.2). Imports `./pdf` (`extractPdfText`), `./adapters/default-registry`, `./adapters/brd-depositary` (`brdDepositaryAdapter` for `fieldKeys`), `./adapters/validate`, `../db/seed-data`. |
| `lib/extraction/report-latest.ts` | new | The logic, with every I/O injected. **Must not live in `lib/extraction/adapters/`**: `boundaries.test.ts` forbids `../pdf` and `../discovery` there. The sketch follows the table. |
| `lib/extraction/report-latest.test.ts` | new | AC6 (section 1.2). |
| `scripts/report-latest.ts` | new | A thin entry point, like `scripts/db-seed.ts`. It builds the default deps: `seedEtfs`, `defaultAdapterRegistry`, `(etf) => discoverLatestReport(etf)`, `(url) => downloadReportPdf(url)`, `extractPdfText`, `defaultWriteFileExclusive`, `fixturesDir = path.join(process.cwd(), "test", "fixtures")` (pnpm runs scripts from the package root). It calls `runReportLatest(process.argv.slice(2), deps)`, prints `stdout` lines with `console.log` and `stderr` lines with `console.error`, and sets `process.exitCode`. Do not call `process.exit()`, so output flushes. The file has no logic and no tests. |
| `package.json` | changed | `"report:latest": "tsx scripts/report-latest.ts"`. **No new dependency.** In particular, `pdf-parse` stays out of the root package: `pdf.test.ts` AC1 asserts that. It is used only through the spike's own `node_modules`. |
| `test/fixtures/<SYMBOL>-<date>.pdf` | new, conditional | Only if Task 5's live capture succeeds. |

Nothing else changes. `pdf.ts`, `discovery.ts`, `http.ts` and the adapters are untouched,
except under R5. `pdf.test.ts` hard-codes the three 2026-09-21 fixtures, and that stays valid.

**`lib/extraction/report-latest.ts` sketch** (names are suggestions, the shape is binding):

```ts
export type ReportLatestEtf = { symbol: string; bvbUrl: string; adapterKey: string | null };
export type ReportLatestDeps = {
  etfs: readonly ReportLatestEtf[];
  registry: Pick<AdapterRegistry, "get">;
  discover: (etf: { symbol: string; bvbUrl: string }) => Promise<DiscoveryResult>;
  download: (url: string) => Promise<PdfDownloadResult>;
  extractText: (bytes: Uint8Array) => Promise<PdfTextResult>;
  writeFileExclusive: (filePath: string, bytes: Uint8Array) => Promise<"written" | "exists">;
  fixturesDir: string;
};
export type ReportLatestOutcome = {
  exitCode: number;            // 0 = full success
  stdout: string[];
  stderr: string[];
  report?: { pdfUrl: string; reportDate: string; values: readonly ExtractedValue[];
             missingFields: readonly string[]; savedPath?: string };
};
export async function runReportLatest(argv: readonly string[], deps: ReportLatestDeps): Promise<ReportLatestOutcome>;
export async function defaultWriteFileExclusive(filePath: string, bytes: Uint8Array): Promise<"written" | "exists">;
```

Flow: parse the arguments (ignore one leading `--`, R4; exactly one positional `SYMBOL`;
the only flag is `--save`; anything else gives usage and exit 1) → look up the symbol with an
**exact match** in `deps.etfs`. The unknown-symbol message lists the known symbols. There is
no case folding, because BVB symbols are upper case, and printing the list makes a typo
obvious → `discover` once → `download(pdfUrl)` once → `extractText` → `registry.get(etf.adapterKey)`
(undefined means "extraction unavailable") → `adapter.extract(text)` → `validateExtractionResult`
(any violation means exit 1, no save) → print → if `--save`: build the file name as
`${symbol}-${reportDate}.pdf`, and as a defence assert it matches
`/^[A-Z0-9]+-\d{4}-\d{2}-\d{2}\.pdf$/`; `reportDate` is already validated, so nothing like path
traversal can get in. Then call `writeFileExclusive(path.join(fixturesDir, name), bytes)`.

`defaultWriteFileExclusive` uses `fs/promises.writeFile(p, bytes, { flag: "wx" })`, an atomic
exclusive create with no check-then-write race. `EEXIST` gives `"exists"`. Any other error is
thrown, and `runReportLatest` catches it and turns it into an exit-1 message.
`runReportLatest` itself never throws: wrap the flow in try/catch and map any unexpected error
to exit 1.

Printed output (English only: this is a developer CLI, not UI, so FR8.1/next-intl does not
apply, the same as `db:seed`): symbol, adapter key, the PDF URL, "filed on BVB at
<publishedAt>" (labelled so it cannot be taken for the report date), "report date
(from PDF)", then one line per field in `fieldKeys` order with `rawValue` and
`(numericValue)`, or `MISSING`. Printing `rawValue` makes the AC7 comparison with the PDF a
character-for-character match. DEC-007 governs UI display and does not apply here.

---

## 3. Data model

None. No schema change, no migration, no DB access (the story's Out of scope).

---

## 4. Risks and smallest design

- **R1 — Values copied from the adapter (the story's main risk).** Section 1.1 gives an
  independent by-eye transcription. The implementer cross-checks it with `pdf-parse`, a
  different library, and records the sources. AC1(c) pins BTBETRETF to the story's literal
  table. The `numericValue === rawValue without commas` check catches a typo between the two
  hand-written columns. The reviewer re-reads at least one non-BTBETRETF entry against its PDF
  (story notes).
- **R2 — Vacuous passes.** Guard against each one: the manifest has at least 3 entries; the
  pipeline is `describe.each` over the manifest, and AC3 forces manifest = PDFs, so an empty
  directory cannot pass either; every failure test in AC6 runs **with `--save`**; the fetch
  guard is asserted as not called.
- **R3 — BigInt literals under `target: ES2017`.** `123n` fails `tsc`. Use `BigInt("…")`
  calls only (`lib` has `esnext`, so the type exists).
- **R4 — pnpm argument forwarding.** `pnpm report:latest BTBETRETF --save` should forward
  both arguments to the script. If a pnpm version passes a literal `--` through, the parser
  already ignores one leading `--`. If pnpm swallows `--save`, the README documents
  `pnpm report:latest -- BTBETRETF --save`. The AC8 smoke check exercises the entry point.
- **R5 — A new live fixture fails the suite (Task 5).** Per the story notes, never loosen an
  assertion. Re-check the transcription against the PDF. If the transcription is right, the
  US-010 rule does not generalise: fix it in `brd-depositary.ts` **with a new text test in
  `brd-depositary.test.ts`**, and list both files in HANDOVER "Files changed". If the fix is
  not obvious, do not commit that fixture. Delete it, record why in the QA file, and continue:
  the three existing fixtures satisfy every AC.
- **R6 — Partial extraction in `report:latest`** (`ok: true`, but `missingFields` is not
  empty). The story lists the hard failures but not this case. The planner's reading, which
  is tooling-only and involves no product behaviour: print the found values, print `MISSING`
  for the others, add a warning line, and **exit 1**, so a live check visibly fails. With
  `--save`, **still write the PDF**. The date is known and valid, and a report the adapter
  cannot fully read is exactly the fixture worth capturing. The suite will then fail until
  the adapter is fixed, which is the intended signal. The printed message says so. Test it
  with a stub adapter (one field missing): exit 1, a `stderr` warning naming the missing
  field, and the writer called when `--save` is set. The tech-lead may override this at
  review.
- **R7 — Task 5 network access.** One attempt per symbol with `pnpm report:latest <SYMBOL> --save`
  (FR4.1 spirit, no retry loop). If bvb.ro cannot be reached, skip the step and note it in the
  QA file. For a captured PDF, transcribe its values the same way as in section 1.1 (read it
  by eye with the Read tool, plus `pdf-parse` via `compare.mjs`, which scans every PDF in
  `test/fixtures/`). **Never** transcribe from the `report:latest` output. If the live newest
  report is itself dated 2026-09-21 (impossible now, but in principle), `--save` refuses to
  overwrite, and that is correct.
- **R8 — Test speed on WSL1/DrvFs.** Extract each PDF once in `beforeAll` and give it an
  explicit timeout. The AC6 wiring test extracts one PDF.
- **R9 — Scope creep.** No persistence, no cron, no ICBETNETF, and no retry or backoff in the
  CLI. The optional nav/net-asset ratio check uses a loose 1 % bound only. It is not an AC,
  and it must not be tightened to the published rounding.

---

## 5. Decisions needed

None. Every choice is either fixed by the story, FINDINGS, SPRINT-02-review or AGENTS.md, or
is an implementation detail of a developer tool recorded above (R6: partial-extraction exit
code, R4: argument forwarding). No new dependency, no schema change, no product behaviour.

---

## Implementation notes — AC3 proof

Observed exactly as the plan predicted:
1. Copied `BTBETRETF-2026-09-21.pdf` to `test/fixtures/ZZTEST-2026-01-01.pdf`, ran
   `pnpm test lib/extraction/fixtures.test.ts`: `every PDF in test/fixtures/ has a manifest entry
   (AC3)` FAILED — `AssertionError: PDFs in test/fixtures/ without a manifest entry: expected
   [ 'ZZTEST-2026-01-01.pdf' ] to deeply equal []`. Deleted the copy.
2. Appended a manifest entry for `ZZTEST-2026-01-02.pdf` (copy of the BTBETRETF entry with
   `file`/`symbol`/`reportDate` changed), ran again: `every manifest entry has a PDF (AC3)`
   FAILED — `AssertionError: manifest entries without a PDF: expected [ 'ZZTEST-2026-01-02.pdf' ]
   to deeply equal []`. Two other tests failed as a side effect (per-entry shape: unknown seed
   symbol "ZZTEST"; pipeline: no PDF to extract) — expected collateral, not part of the proof.
   Removed the entry.
3. Re-ran: 31/31 green. Confirmed no `ZZTEST*` file remains and `expected.json` is back to its
   original 3 entries.

## 6. Order of work (suggested)

1. Write `expected.json` from section 1.1. Cross-check with `pdf-parse` and record `source`.
2. Write `fixtures.test.ts` and get it green on the three fixtures. Run the AC3
   temporary-change proof and append it below.
3. Write `report-latest.ts` and its test, then the entry script and the `package.json` script.
   Run the AC8 offline smoke check (`pnpm report:latest`, `pnpm report:latest NOPE`).
4. Task 5, only if bvb.ro is reachable (R5, R7).
5. Write `test/fixtures/README.md`.
6. `pnpm typecheck && pnpm lint && pnpm test && pnpm build`. Keep HANDOVER "Files changed"
   current throughout.
