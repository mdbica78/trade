# US-029 test verdict — ICBETNETF report access and adapter

**Tester: story-tester (haiku), 2026-09-27**

## Verdict: PASS

All 10 acceptance criteria are MET. Test counts: 1575 tests passed across 141 files (full suite).

All gates green: `pnpm install --frozen-lockfile` (exit 0), `pnpm typecheck` (exit 0), `pnpm lint` (0 errors, 5 pre-existing warnings), `pnpm test` (1575/1575 pass), `pnpm build` (exit 0).

---

## Acceptance criteria mapping

### AC1 — Investigation recorded
**Status: MET**

Proof:
- **FINDINGS exists and complete**: `spikes/icbetnetf/FINDINGS.md` (all sections 1–7 present)
  - §1 documents capture commands (curl), status codes (200 OK), content types (text/html, application/pdf), byte counts (70666, 306610)
  - §2 describes the access mechanism (same markup as BRD rows, decorative submit button, real `<a href>` link)
  - §3 documents PDF text extraction (stable labels, report date format)
  - §4 gives verdict: **ADAPTER** (both "automatable" and "extractable" conditions hold)
  - §6 logs requests with status/content-type/byte counts (no cookie values recorded)
  - §7 documents the positional rule for the per-class table
- **Fixtures saved**: `test/fixtures/bvb/ICBETNETF-instrument-2026-09-27.html` (70K), `test/fixtures/ICBETNETF-2026-09-24.pdf` (300K)
- **Reviewer verification**: FINDINGS claims checked against fixture files (§1 size claims match actual files)

### AC2 — Fixtures committed
**Status: MET**

Proof:
- **Page fixture committed**: `test/fixtures/bvb/ICBETNETF-instrument-2026-09-27.html` exists (verified above)
- **PDF fixture committed**: `test/fixtures/ICBETNETF-2026-09-24.pdf` exists, dated from report's own text (2026-09-24)
- **expected.json updated**: entry for ICBETNETF with 8 values (nav_per_unit, units_in_circulation, total_nav_class_b, nav_per_unit_class_a, units_class_a, total_nav_class_a, units_total, total_nav) ✓
- **README updated**: `test/fixtures/README.md` and `test/fixtures/bvb/README.md` (§8) describe ICBETNETF fixtures ✓
- **No secrets in fixtures**: `lib/extraction/fixtures.test.ts` FX-7 (new): test verifies no credential strings in the HTML or PDF fixtures ✓
- **Regression: fixture manifest sync**: test suite passes, confirming every PDF has an expected.json entry and vice versa ✓

### AC3 — Discovery never returns a wrong link
**Status: MET**

Proof (from `lib/extraction/discovery.icbetnetf.test.ts`):
- **DI-1** (`discovery.icbetnetf.test.ts:23–36`): `discoverLatestReport` over the ICBETNETF fixture returns the newest report's exact URL and title, exactly 1 request
  - Expected: `pdfUrl: "https://bvb.ro/infocont/infocont26/ICBETNETF_20260925110032_2026-09-24-BET-ETF-Official-NAV.pdf"`, `title: "VAN la data 24.09.2026"`, `publishedAt: "2026-09-25T11:02"` ✓
- **DI-2** (`discovery.icbetnetf.test.ts:38–55`): URL is a literal `href` in the fixture's `gv5News` table, not a prospectus/KID or built from symbol/bvb_url ✓
- **DI-3** (`discovery.icbetnetf.test.ts:57–89`): With the newest row's link removed, returns the second row's own URL and title; with all links removed, gives `not_found / no_report_entries`, 1 call ✓
- **BRD unchanged**: `lib/extraction/discovery.test.ts` and `lib/ingestion/ingest-etf.test.ts` for the three BRD fixtures pass unchanged (US-007 discovery tests and US-014 AC2/AC3 request-count tests, per AC3 requirement) ✓

### AC4 — Access requests exact and bounded (ADAPTER branch)
**Status: MET**

Proof (from `lib/ingestion/request-bound.test.ts`):
- **AX-1** (`request-bound.test.ts:98–125`): ICBETNETF happy path records exactly `[GET page URL, GET PDF URL]`
  - Both to `https://bvb.ro` ✓
  - Both GET only, no method override, no body, no Cookie, no Content-Type headers ✓
  - Request 1 carries BVB_REQUEST_HEADERS, request 2 carries PDF_REQUEST_HEADERS (User-Agent) ✓
- **AX-2** (`request-bound.test.ts:127–190`): Sentinel cookie (`ASP.NET_SessionId=SENTINELCOOKIE7731`) and sentinel hidden field (`__VIEWSTATE SENTINELHIDDEN4419`) never leak
  - Not in outcome JSON, not in formatted log, not in any recorded request's URL/headers ✓
  - Tested for both happy path and PDF 500 error ✓
- **No form post, redirect, or POST-body PDF**: Per FINDINGS §2, access is direct link only (same as BRD), so these rules don't apply to ICBETNETF. The comment in AC4's description notes this correctly ("NOT APPLICABLE"). No new access code written, so tech-lead binding points 1–2 (redirect handling, fetchOnce options) not applicable ✓
- **Adapters gain no I/O**: `lib/extraction/adapters/boundaries.test.ts` (existing test, still passes) scans all adapter files for illegal I/O; `intercapital-nav.ts` is now included ✓

### AC5 — Second adapter, label-based
**Status: MET**

Proof (from `lib/extraction/adapters/intercapital-nav.test.ts`):
- **Identity**: `intercapitalNavAdapter.key = "intercapital-nav"`, `fieldKeys` = 8 keys from the seeded `intercapital-nav` catalogue rows ✓ (identity describe block)
- **Registration**: `defaultAdapterRegistry.get("intercapital-nav")` returns the adapter ✓; `detect` on default text resolves to it ✓ (registration describe block)
- **Report date** (describe block `report date`):
  - Default text: `reportDate = "2026-09-24"` from `Data: 24.09.2026` line, not the English `Date:` line ✓
  - No `Data:` label → `ok: false` ✓
  - English `Date:` alone (no `Data:`) → `ok: false` ✓
  - Impossible date (31.09.2026) → `ok: false` ✓
  - Same date twice → `ok: true` ✓
  - Two conflicting `Data:` dates → `ok: false` ✓
  - Croatian page-2 dates (25.09.2026 "Ispisano na dan") never used, result still 2026-09-24 ✓
- **Rows** (default text): All 8 values extracted exactly with no missing field (describe block `rows (default)`) ✓
- **Rows** (label-based, order-independent): Swapped Class A and Class B → same values ✓ (describe block `rows (label-based…)`)
- **Rows** (rejected tokens, describe block `rows (rejected tokens)`):
  - Wrong currency in Class A → Class A's 3 fields missing, others intact ✓
  - Row missing one number → that row's 3 fields missing ✓
  - Row with one extra number → that row's 3 fields missing (boundary violation) ✓
  - European-format number (26,9315) → that row's fields missing ✓
- **Rows** (missing labels, describe block `rows (missing labels)`):
  - Missing class label → only that row's fields missing ✓
  - Missing TOTAL label → only the two total fields missing ✓
- **Header structure** (describe block `header (structure)`): Reordered header columns → all class-row and total fields missing ✓; missing any header column → all fields missing ✓
- **`canHandle`** (describe block):
  - True for default text ✓
  - True with whitespace runs and newlines in header labels ✓
  - False for empty text, unrelated text, BRD-shaped text ✓
  - False when any header column is missing ✓
  - `brdDepositaryAdapter.canHandle(ICBETNETF text)` is false ✓
- **Purity** (A-B-A): state does not leak between calls ✓
- **Fixture-level tests** (`lib/extraction/fixtures.test.ts`):
  - **FX-2** (pipeline test): Extracts `expected.json`'s ICBETNETF entry exactly (8 values, no missing field, no violation) ✓
  - **FX-5** (detect matrix): For every fixture entry, `registry.detect(text) == registry.get(entry.adapterKey)` ✓
  - **FX-6** (canHandle matrix): For every entry × every adapter, `canHandle` is true only when keys match ✓
  - **FX-8** (new, intercapital-nav consistency): Class A + Class B units = total units ✓; Class A + Class B total NAV = total NAV ✓; Nav-per-unit × units ≈ total NAV (within 1%) ✓; all three BRD-style entries and ICBETNETF entry pass ✓
- **No new formatting code**: No changes to `lib/format/`, `components/HomeTable*`, `components/EtfDetail*` ✓

### AC6 — End to end on PGlite
**Status: MET**

Proof (from `lib/ingestion/ingest-icbetnetf.pglite.test.ts`):
- **IC-E2E-1** (`ingest-icbetnetf.pglite.test.ts:82–117`): `ingestEtf` with ICBETNETF fixture returns `ok`, stores one `reports` row (report_date: 2026-09-24, status: ok, source_url: the PDF URL), and two `report_values` rows matching `expected.json` ✓
- **IC-E2E-2** (`ingest-icbetnetf.pglite.test.ts:119–138`): Rerun gives `already_ingested`, still one row (DEC-010 never-downgrade rule) ✓
- **IC-E2E-3** (`ingest-icbetnetf.pglite.test.ts:140–169`): Shipped `createHomeTableLoader` shows the ICBETNETF row with `adapterAvailable: true`, both values, report date 2026-09-24, link = PDF URL, and column labels from the (shared) catalogue ✓
- **IC-E2E-4** (`ingest-icbetnetf.pglite.test.ts:171–203`): `addEtf` with shipped `detectAdapter` returns `added / intercapital-nav / detected`, stores the key in `etfs.adapter_key`, and writes no `reports`/`report_values`/`tracked_fields` rows ✓

### AC7 — FALLBACK branch
**Status: NOT APPLICABLE**

FINDINGS §4 verdict is ADAPTER, with both decision-1 conditions holding:
1. Automatable: plain HTTP GET, no form, no JS/headless, 2 requests (discovery + download) ✓
2. Extractable: stable labels (`"NAV per Unit VUAN"`, `"TOTAL"`), report date from PDF text (`"Data: 24.09.2026"`), fields next to labels ✓

Reviewer confirms: shipped code branch is ADAPTER (includes `intercapital-nav.ts` with full extraction logic) ✓

### AC8 — BRD sub-searches bounded (Sprint 2 audit N3)
**Status: MET**

Proof (from `lib/extraction/adapters/brd-depositary.test.ts`):
- **BB-1** (`brd-depositary.test.ts:450–461`): Remove both the investors label AND the units block's "Persoane fizice"
  - `units_held_individuals` is missing, never takes the value `18,631` ✓
  - `units_held_legal_entities` is still `7,736,222` ✓
- **BB-2** (`brd-depositary.test.ts:462–473`): Remove the investors block's "Persoane fizice" and place `Persoane fizice 999` after the documented boundary (signature segment)
  - `investors_individuals` is missing, never takes `999` ✓
  - `investors_legal_entities` is still `77` ✓
- **All existing BRD tests pass unchanged**: Six BRD fixture entries in the manifest still extract their exact values ✓

### AC9 — Per-ETF request bound
**Status: MET**

Proof:
- **Constant defined**: `lib/ingestion/run-daily.ts:10` exports `const MAX_REQUESTS_PER_ETF = 2` ✓
- **Tests** (from `lib/ingestion/request-bound.test.ts`):
  - **RB-1** (`request-bound.test.ts:216–235`): BRD path (BTBETRETF) makes exactly `MAX_REQUESTS_PER_ETF` calls ✓
  - **RB-2** (`request-bound.test.ts:237–256`): ICBETNETF (AX-1 run) makes exactly `MAX_REQUESTS_PER_ETF` calls ✓
  - **RB-3** (`request-bound.test.ts:258–308`): Failure paths (page 500, PDF 500, not a PDF) each make ≤ `MAX_REQUESTS_PER_ETF` calls ✓
  - **RB-4** (`request-bound.test.ts:310–331`): Add-time `detectAdapter` path makes ≤ `MAX_REQUESTS_PER_ETF` calls ✓
- **RT-7b updated**: `app/api/cron/daily/route.test.ts:34–38` imports and uses the constant; budget calculation: `seedEtfCount × MAX_REQUESTS_PER_ETF × CRON_FETCH_TIMEOUT_MS + NON_FETCH_ALLOWANCE_MS ≤ 60 s` ✓
- **Add-time budget guarded**: 
  - **CPG-4b** (`app/chat/page.test.tsx:58`): chat add path stays within `maxDuration` ✓
  - **PG-7b** (`app/admin/etfs/page.test.tsx:105`): admin add path stays within `maxDuration` ✓

### AC10 — Label invariant, offline, gates
**Status: MET**

Proof (from `lib/db/seed-data.test.ts`):
- **SL-1** (`seed-data.test.ts:74–76`): `findSharedKeyConflicts(seedFieldCatalog)` returns `[]` (no conflicts) ✓
- **SL-2** (`seed-data.test.ts:78–86`): Synthetic catalogue with a conflict is caught by the same function ✓
- **SL-3** (`seed-data.test.ts:88–98`): At least one key (e.g., `nav_per_unit`) is really shared between adapters in the shipped catalogue (SL-1 is not vacuous) ✓
- **No new runtime dependency**: `package.json` and `pnpm-lock.yaml` unchanged ✓
- **No test reaches live services**: Global `fetch` stubbed to throw in every new test; no actual network calls ✓
- **Gates all pass**:
  - `pnpm typecheck` → exit 0 ✓
  - `pnpm lint` → 0 errors (5 pre-existing warnings OK) ✓
  - `pnpm test` → 1575/1575 tests pass, 141 files ✓
  - `pnpm build` → exit 0 (Next.js production build, 12 routes) ✓

---

## Test counts (from `pnpm test` final summary)

- **Test Files**: 141 passed (141)
- **Tests**: 1575 passed (1575)
- **Duration**: 119.60 seconds

No test failures, no flaky tests, all exit codes 0.

---

## Denied or attempted commands

None. No git, no secret-touching commands attempted or denied this round.
