# US-011 — Independent review

## Round 1 — 2026-09-24

Verdict: PASS

Reviewed against `dev_minions/backlog/stories/US-011.md`, `dev_minions/verification/US-011-plan.md`,
AGENTS.md, and the files listed under "Files changed" in `dev_minions/HANDOVER.md`:
`test/fixtures/expected.json`, `test/fixtures/README.md`,
`test/fixtures/{BTBETRETF,TVBETETF,PTENGETF}-2026-09-22.pdf`, `lib/extraction/fixtures.test.ts`,
`lib/extraction/report-latest.ts`, `lib/extraction/report-latest.test.ts`,
`scripts/report-latest.ts`, `package.json`, `dev_minions/verification/US-011-plan.md` (appended
AC3 proof). Grepped the repo for `runReportLatest`, `report-latest`, `diffFixtureSets`,
`sumsExactly`: only appear in the declared files plus `package.json` — no scope creep.
`lib/extraction/adapters/boundaries.test.ts` confirms `report-latest.ts` (outside `adapters/`)
never leaks into the adapters' text-only boundary.

Independent verification performed for this round (beyond reading the code):
- Ran `cd spikes/pdf-extraction && node compare.mjs` (offline, its own `node_modules`, no network)
  and cross-checked its `pdf-parse` output for all three **2026-09-22** fixtures (the
  live-captured ones, the highest-risk entries per the story's own R1) against `expected.json`
  by hand: every one of the 8 fields for BTBETRETF, TVBETETF and PTENGETF-2026-09-22 matches the
  manifest exactly (net_asset, units_in_circulation, units_held_individuals,
  units_held_legal_entities, nav_per_unit, investors_total, investors_individuals,
  investors_legal_entities). This satisfies the story's own verification note ("the reviewer
  should open at least one non-BTBETRETF fixture... and check its manifest values by hand") for
  all three non-BTBETRETF entries, and specifically confirms the manifest was not generated from
  the adapter's own output — the values were transcribed independently and now independently
  re-confirmed against a second, different library (`pdf-parse` vs `unpdf`).
- Ran `pnpm typecheck` — clean, no errors.
- Ran `pnpm lint` — 0 errors, 1 pre-existing warning unrelated to this story (`types.test.ts`
  unused `_text`, already logged against US-009).
- Ran `npx vitest run lib/extraction/fixtures.test.ts lib/extraction/report-latest.test.ts` —
  72/72 pass (49 + 23), confirming the current 6-fixture manifest (not just the original 3) is
  fully exercised by `describe.each`.
- Ran `pnpm report:latest` (no args) and `pnpm report:latest NOPE` — both exit 1 with the
  expected usage / unknown-symbol messages (AC8's offline entry-point smoke check).
- Confirmed the working tree has no `ZZTEST*` leftovers and exactly 6 PDFs / 6 manifest entries
  (AC3's temporary-change proof was reverted cleanly).
- Compared `DiscoveryResult`/`PdfDownloadResult`/`PdfTextResult`'s real union types in
  `discovery.ts`/`pdf.ts` against the fakes used in `report-latest.test.ts` — the `kind`/`reason`
  literals match exactly, so the failure-case tests exercise the real contract, not an invented one.

Did not independently run `pnpm build` or the full `pnpm test` suite (out of this role's
granted scope); `dev_minions/verification/US-011-tests.md` already records both green (387
tests, build successful) — no reason found to distrust that on the parts I could re-check.

### Acceptance criteria

- **AC1 — MET.** `test/fixtures/expected.json` has 6 entries (one per PDF in `test/fixtures/`),
  each with `file`/`symbol`/`adapterKey`/`reportDate`/`source`/`values` for all 8
  `brd-depositary` field keys, raw and numeric (`test/fixtures/expected.json:1-178`). The
  BTBETRETF-2026-09-21 entry (`expected.json:4-43`) is byte-for-byte the story's Task 1 table,
  and `fixtures.test.ts:188-202` pins it with a literal `toEqual`. Per-entry shape is enforced by
  `fixtures.test.ts:162-181` (`it.each`): all 8 field keys present, `reportDate` is a valid ISO
  calendar date, `file === "${symbol}-${reportDate}.pdf"`, `symbol` resolves to a real seed ETF
  and `adapterKey` matches that ETF's config, `source` non-empty, and
  `numericValue === rawValue.replace(/,/g, "")` (catches a transcription slip between the two
  hand-written columns). Independence proven above by cross-checking the three 2026-09-22
  entries against `pdf-parse`.
- **AC2 — MET.** `fixtures.test.ts:205-261` (`describe.each(manifest)`) runs the real
  `extractPdfText` → `defaultAdapterRegistry.get` → `adapter.extract` pipeline for every fixture
  and asserts `result.reportDate`, every field's `{rawValue, numericValue}` as an exact map
  (`toEqual`, so an extra/wrong field fails), `missingFields` empty, and
  `validateExtractionResult(...)` returns no violations. Offline is enforced, not just assumed:
  `beforeAll` stubs global `fetch` with a `vi.fn` guard and a dedicated test
  (`fixtures.test.ts:223-225`) asserts it is never called. Confirmed green for all 6 fixtures via
  my own `vitest run` above.
- **AC3 — MET.** Permanent tests `fixtures.test.ts:145-159` fail on either direction
  independently (own `it` each, readable diff naming the offending file), backed by pure-helper
  unit tests (`fixtures.test.ts:133-143`). The required temporary-change proof was carried out and
  reverted; its exact failure messages are recorded in
  `dev_minions/verification/US-011-plan.md:232-246` ("Implementation notes — AC3 proof"), and I
  confirmed on disk that no `ZZTEST*` file remains and the manifest is back to 6 original entries.
- **AC4 — MET.** `fixtures.test.ts:278-328` (`describe.each(manifest)`) checks both breakdowns
  sum exactly, using exact-decimal-string arithmetic (`sumsExactly`, `fixtures.test.ts:103-122`,
  `BigInt` on digit strings, no float tolerance) for every fixture, on both the pipeline's own
  extracted values and the manifest's hand-transcribed values (so a transcription error would be
  caught even with a broken pipeline). Manually re-verified the arithmetic for all three
  2026-09-22 entries against the numbers I independently read from `pdf-parse` (e.g. BTBETRETF:
  29,733,778 + 7,786,222 = 37,520,000 = units_in_circulation; 18,631 + 77 = 18,708 =
  investors_total) — correct in every case.
- **AC5 — MET.** `fixtures.test.ts:251-259` asserts `detect(text)` returns the exact same
  adapter instance as `get("brd-depositary")` (identity, not just key equality) for all 6
  fixtures.
- **AC6 — MET.** `lib/extraction/report-latest.ts` implements the logic with every I/O injected
  per the plan's sketch; `report-latest.test.ts` covers: success without `--save`
  (`report-latest.test.ts:83-102`), a real-pipeline wiring test against the committed BTBETRETF
  fixture (`:104-128`), every failure case listed in the AC — unknown symbol, discovery `error`
  (`http_error`/`network`/`timeout`), `not_found` (`no_report_entries`/`list_not_found`),
  download error (`http_error`/`network`/`timeout`/`not_pdf`), `unreadable` text, adapter
  `ok: false`, contract violations, unknown adapter key, no-arg/unknown-flag usage — every one run
  with `--save` and asserting `writeFileExclusive` was never called (`:131-282`); `--save`
  writing `<SYMBOL>-<reportDate>.pdf` with the date taken from the PDF, not `publishedAt` or the
  faked system clock (`:284-314`); refusing to overwrite (`:316-322`); and a real-fs exclusive
  write/refuse-overwrite round trip (`:325-345`). A dedicated test statically greps the source for
  DB/drizzle imports and asserts none (`:348-355`). I verified the `DiscoveryResult`/
  `PdfDownloadResult`/`PdfTextResult` union literals used in the test fakes are exactly the real
  types from `discovery.ts`/`pdf.ts`, not an invented contract.
- **AC7 — MET (manual QA).** Genuinely needs live bvb.ro access; correctly marked `MANUAL-QA` in
  the story and plan, with a concrete, checkable procedure. Strong supporting evidence already
  exists: the implementer's own Task 5 live run (`pnpm report:latest <SYMBOL> --save`) already
  exercised this exact path against the live site for all three symbols and produced the
  2026-09-22 fixtures now committed, and I independently re-confirmed those values against a
  second parsing library above — so the mechanism this AC exists to prove is not merely
  theoretical, it already ran once successfully. The user's own live click-through per the story
  text is still required to close this AC.
- **AC8 — MET.** `pnpm typecheck` and `pnpm lint` verified clean by me directly (this round).
  `pnpm test` (387/72 new) and `pnpm build` verified green in `US-011-tests.md`; I additionally
  ran the AC8 offline entry-point smoke check myself (`pnpm report:latest` and
  `pnpm report:latest NOPE`, both exit 1 with the correct messages).

### Findings (ordered by severity)

No Critical or Warning findings.

1. **Note** — `dev_minions/verification/US-011-tests.md:23-38` (story-tester's own verdict file,
   not code under review) states "All three committed PDF fixtures... all dated 2026-09-21 are
   exercised throughout" and its AC1/AC2/AC5 test counts (6/4/3) reflect only the original
   3-fixture state. The manifest and both test files actually contain **6** fixtures (3 original
   + 3 live-captured 2026-09-22, per Task 5), and re-running the suite confirms all 6 are
   exercised (72 tests total, matching the tester's own top-line count of 49+23). This looks like
   a description written before Task 5's fixtures were added to the manifest, then not updated —
   harmless to the verdict (still PASS, and the real number of exercised fixtures is *more* than
   described, not less), but worth a one-line fix in that file so a future reader doesn't
   conclude only 3 fixtures exist.
2. **Note** — `report-latest.ts` and `scripts/report-latest.ts` print raw, comma-formatted values
   straight from the PDF/adapter (e.g. `37,470,000`) rather than through next-intl/DEC-007
   formatting. This is correct and intentional per the plan ("this is a developer CLI, not UI, so
   FR8.1/next-intl does not apply... DEC-007 governs UI display and does not apply here"),
   consistent with the precedent already set by `scripts/db-seed.ts`. Not a defect, noting for
   the record since AGENTS.md's non-negotiables list next-intl/DEC-007 and this is the reason
   they don't apply here.

### Scope deviations

None. No new dependency (`package.json` only gained one script line). No schema, DB, UI, route,
or `messages/*` change. `lib/extraction/adapters/` is untouched (confirmed by
`boundaries.test.ts` passing and by direct inspection) — the story's R5 contingency (a new live
fixture forcing an adapter-rule change) did not trigger, and the "Files changed" list correctly
omits any adapter file.
