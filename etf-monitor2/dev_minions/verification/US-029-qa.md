# US-029 QA checklist — Investigate and implement ICBETNETF report access

Round 1: review PASS (`US-029-review.md`, no Critical, N1/N2 non-blocking), tests PASS
(`US-029-tests.md`, 1575/1575 full suite, all 10 acceptance criteria MET). Verdict against
`spikes/icbetnetf/FINDINGS.md`: **ADAPTER** — ICBETNETF's report turned out to be a plain `<a
href>` PDF link (same shape as the three BRD ETFs), not the form-post/submit-button mechanism
requirements §3 described. No change was needed to discovery, http, pdf, ingest-etf or
detect-adapter; only a new `intercapital-nav` adapter plus supporting bounds/catalogue/constant
work.

Every acceptance criterion agent-drafted in `backlog/stories/US-029.md` — **PO to confirm.**

## Automated (already run this round, evidence in US-029-tests.md / US-029-review.md)

1. `pnpm typecheck` — 0 errors.
2. `pnpm lint` — 0 errors, 5 pre-existing warnings.
3. `pnpm test` — 1575/1575 passed, 141 files.
4. `pnpm build` and `env -u DATABASE_URL pnpm build` — both succeed, new routes unaffected,
   offline build unaffected (no new dependency, `package.json`/`pnpm-lock.yaml` untouched).
5. Fixture byte counts cross-checked by the reviewer: page fixture 70666 bytes, PDF fixture
   306610 bytes — match `spikes/icbetnetf/FINDINGS.md` §1/§6 exactly.
6. No secret pattern (cookie name/value, `DATABASE_URL`, `CRON_SECRET`, `_API_KEY`) found in any
   committed fixture or FINDINGS.md (`FX-7`, plus the reviewer's own grep).

## Manual / live (for the user, or Codex QA where it can reach bvb.ro)

1. **(AC1, MANUAL-QA)** Open
   `https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s=ICBETNETF` →
   "Stiri", click the PDF icon of the newest "VAN la data …" row. Expected: it opens a PDF
   directly — no form resubmission, no login, no extra click. (This reconfirms the live capture
   FINDINGS.md already recorded from an earlier session; it is not expected to have changed.)
2. **(sprint step 2, after deploying)**
   - Run `DATABASE_URL=<neon-url> pnpm db:seed`.
   - Run `select field_key, label_ro, label_en, unit from field_catalog where adapter_key =
     'intercapital-nav';` — expect exactly 8 rows (see `lib/db/seed-data.ts` for the exact
     labels).
3. **(sprint step 3, `/admin/etfs`)**
   - Add `ICBETNETF` (or re-detect it if a prior attempt added it with no adapter). Expect the
     adapter shown to be `intercapital-nav`.
   - On its Fields page, track "Net asset value per unit" and "Units in circulation".
   - After the next daily run (or a manual cron run), the home row shows those two values in the
     same columns as the three BRD ETFs (shared `field_key`s, decision D1), plus the report date
     and a symbol link to the PDF (it has a direct URL, so the P12 default doesn't apply here).
   - Compare every value and the date by eye against the PDF's page 1, Class B row (the class
     traded on BVB): NAV per unit 142.1413, units 514,169, date 24.09.2026.
4. **(D1, product decision — see "Waiting on the user" in HANDOVER.md)** Confirm the shipped
   default (Class B NAV-per-unit/units share the BRD columns; the other 6 InterCapital figures
   get their own columns), or ask for an alternative. Answer before tracking ICBETNETF fields
   live, since a later change would leave already-stored history under the old field keys
   (`field_key` is not a foreign key).

## Files changed
- `dev_minions/verification/US-029-plan.md` (story-planner), `US-029-review.md`, `US-029-tests.md`, `US-029-qa.md` (new)
- new: `lib/extraction/adapters/text.ts`, `text.test.ts`, `intercapital-nav.ts`, `intercapital-nav.test.ts`
- new tests: `lib/extraction/discovery.icbetnetf.test.ts`, `lib/ingestion/request-bound.test.ts`,
  `lib/ingestion/ingest-icbetnetf.pglite.test.ts`
- changed: `lib/extraction/adapters/brd-depositary.ts` (imports helpers from `./text`; AC8 bound —
  `BRD_BLOCK_TOKENS = 7`), `brd-depositary.test.ts` (BB-1, BB-2 + a regression guard),
  `default-registry.ts` (registers `intercapitalNavAdapter`)
- changed: `lib/db/seed-data.ts` (+8 `intercapital-nav` catalogue rows), `seed-data.test.ts`
  (count 8→16, SL-1..SL-3 label-invariant test + self-check), `seed.pglite.test.ts` (count 8→16
  in SD-1/2/3)
- changed: `lib/extraction/fixtures.test.ts` (FX-1 generalised to any adapter's fieldKeys and
  non-seeded symbols; FX-5 generalised; FX-6 canHandle matrix new; FX-7 no-secret-leak scan new;
  BRD consistency block filtered to `brd-depositary` entries; FX-8 new for `intercapital-nav`
  sums + mis-anchoring guard; "not vacuous" now also requires an `intercapital-nav` entry)
- changed: `test/fixtures/expected.json` (ICBETNETF entry, independently transcribed and
  cross-checked against `spikes/pdf-extraction/compare.mjs`), `test/fixtures/README.md`
  (adapter-agnostic field-set wording, non-seeded-symbol capture note)
- changed: `lib/ingestion/run-daily.ts` (+`MAX_REQUESTS_PER_ETF = 2`)
- changed: `app/api/cron/daily/route.test.ts` (RT-7b uses the constant), `app/chat/page.test.tsx`
  (+CPG-4b add-time budget), `app/admin/etfs/page.test.tsx` (+PG-7b add-time budget)
- changed: `components/admin/TrackedFieldsAdmin.tsx` (`KNOWN_UNITS` +`"EUR"`), `messages/en.json`,
  `messages/ro.json` (`Admin.fields.units.EUR`)
- changed: `spikes/icbetnetf/FINDINGS.md` (+§7 positional-rule writeup, headers-not-kept line),
  `dev_minions/architecture/data-model.md` (write-rules wording only, no rule change)
- already saved in Phase A (unchanged this round): `spikes/icbetnetf/extracted-text-sample.txt`,
  `test/fixtures/bvb/ICBETNETF-instrument-2026-09-27.html`, `test/fixtures/bvb/README.md` (§8),
  `test/fixtures/ICBETNETF-2026-09-24.pdf`
