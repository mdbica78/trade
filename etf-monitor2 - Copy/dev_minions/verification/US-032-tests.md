# US-032 — Task 2 working-tree cross-check (AC4)

Written by the implementer per the story's Task 2 instruction. The test verdict (round-by-round,
criterion by criterion, with its own independently-run gate evidence) is appended below by `story-tester`
and is not edited by this section's rewrites.

## Round 3 method (generated, not hand-built — see `US-032-fix-strategy-round3.md`)

Rounds 1 and 2 built this table by hand and both under-covered it (review round 1: 15/~50 pairs; round 2:
33/50 pairs, still missing rows for two message keys per file, a new US-031 helper file, and the
US-030-specific token on three files shared with another story). Round 3 generates the table mechanically
from `dev_minions/HANDOVER.md`'s three `## Files changed (US-0NN …)` sections and reconciles it against
that extraction by set difference, so no (story, file) pair or annotation token can be dropped silently.
Every command below was run from the repo root; nothing outside `/tmp/us032/` was written, no `.env*` file
was read, no git command was run.

### Step 1 — extract tokens
```bash
export LC_ALL=C; H=dev_minions/HANDOVER.md; OUT=/tmp/us032; mkdir -p "$OUT"
for s in 029 030 031; do
  awk -v s="$s" '$0 ~ ("^## Files changed \\(US-" s) {f=1; next} f && /^#/ {f=0} f' "$H" \
  | awk -F'`' -v s="$s" 'NF%2==0 {print "ODD-BACKTICKS US-" s ": " $0}'
done
for s in 029 030 031; do
  awk -v s="$s" '$0 ~ ("^## Files changed \\(US-" s) {f=1; next} f && /^#/ {f=0} f' "$H" \
  | grep -o '`[^`]*`' | tr -d '`' \
  | awk -v st="US-$s" '
      function dname(x) { sub(/\/[^\/]*$/, "", x); return x }
      /^[^ ,(){}]+\.(ts|tsx|mjs|js|json|sql|md|txt|html|pdf|css)$/ {
        if ($0 ~ /\//) { cur = $0; dir = dname($0) } else { cur = dir "/" $0 }
        print st "\tFILE\t" cur; next }
      { print st "\tSYM\t" cur "\t" $0 }'
done > "$OUT/tokens.tsv"
```
**Odd-backtick guard output:** three lines, `ODD-BACKTICKS US-029: `, `US-030: `, `US-031: ` — each with an
empty tail. Traced by hand: `awk -F'`' '{print NF, $0}' | awk '$1%2==0'` on the same ranges shows all three
are `NF 0` blank lines between bullets (awk gives `NF=0` for an empty record, which is even) — not malformed
backtick pairs. No real odd-backtick line exists in any of the three sections.

### Step 2 — classify pairs, check existence
```bash
awk -F'\t' '$2=="FILE" { c="IN"; if ($3 ~ /\.test\.tsx?$/) c="X1"; else if ($3 ~ /^dev_minions\/verification\//) c="X2";
  print $1 "\t" $3 "\t" c }' "$OUT/tokens.tsv" | sort -u > "$OUT/pairs.tsv"
cut -f3 "$OUT/pairs.tsv" | sort | uniq -c
while IFS=$'\t' read -r st p c; do [ -e "$p" ] || printf 'NOT-FOUND\t%s\t%s\t%s\n' "$st" "$p" "$c"; done < "$OUT/pairs.tsv"
```
**Class counts (before path-resolution fixes):** 52 IN, 55 X1, 5 X2.
**NOT-FOUND (3):**
- `US-030 test/helpers/0000_init.sql` — real: this bare name is the X3 reference case the fix strategy
  predicted ("applies every journal migration, not just `0000_init.sql`" — quoting a file that was never a
  target of the change). Reclassified X3 in `pairs.tsv`.
- `US-031 components/README.md`, `US-031 components/package.json` — extraction bug, not a code regression:
  the bare tokens `README.md` and `package.json` on HANDOVER's last US-031 bullet resolved against the
  *previous* bullet's directory (`components/`, from `components/FieldChart.test.tsx`) instead of the repo
  root. Both are root-level files (`package.json`, `README.md` exist at the repo root and do not exist under
  `components/`). Corrected in `pairs.tsv` and in the matching `tokens.tsv` `SYM` rows (`scripts["smoke:deploy"]`
  → `package.json`, `/health` → `README.md`) before continuing — the extraction script's bare-name rule is
  right for e.g. `text.test.ts` next to `text.ts`, wrong for well-known root filenames; noted as a limitation,
  not fixed in the script itself (one-off manual correction, confirmed by both files existing at the root and
  not under `components/`).

**Class counts (after both corrections):** 50 IN, 55 X1, 5 X2. Two further reclassifications to X3 (both
predicted by the fix strategy, §"Closed exclusion rules"):
- `US-029 spikes/pdf-extraction/compare.mjs` — HANDOVER: "cross-checked against `spikes/pdf-extraction/compare.mjs`" (referenced, not changed by US-029; the file predates it, `ls -la` shows 2026-09-23).
- `US-030 test/helpers/0000_init.sql` — as above.

**Final class counts: 50 IN, 55 X1, 5 X2, 2 X3.** Per-story IN counts: **17 US-029, 22 US-030, 11 US-031**
(matches the fix strategy's estimate exactly).

### Step 3 — manifest
The only hand-written input, one line per check, `story|file|token|grep-string`. Full manifest (108 lines):

```
US-029|components/admin/TrackedFieldsAdmin.tsx|"EUR"|"EUR"
US-029|components/admin/TrackedFieldsAdmin.tsx|KNOWN_UNITS|KNOWN_UNITS
US-029|dev_minions/architecture/data-model.md|Data:|Data:
US-029|lib/db/seed-data.ts|intercapital-nav|intercapital-nav
US-029|lib/extraction/adapters/brd-depositary.ts|./text|"./text"
US-029|lib/extraction/adapters/brd-depositary.ts|BRD_BLOCK_TOKENS = 7|BRD_BLOCK_TOKENS = 7
US-029|lib/extraction/adapters/default-registry.ts|intercapitalNavAdapter|intercapitalNavAdapter
US-029|lib/ingestion/run-daily.ts|MAX_REQUESTS_PER_ETF = 2|MAX_REQUESTS_PER_ETF = 2
US-029|messages/ro.json|Admin.fields.units.EUR|"EUR":
US-029|messages/en.json|Admin.fields.units.EUR|"EUR":
US-029|lib/extraction/adapters/intercapital-nav.ts|-|export const intercapitalNavAdapter
US-029|lib/extraction/adapters/intercapital-nav.ts|-|INTERCAPITAL_NAV_KEY
US-029|lib/extraction/adapters/text.ts|-|export function labelSource
US-029|lib/extraction/adapters/text.ts|-|export type Span
US-029|spikes/icbetnetf/FINDINGS.md|-|## 7. Positional rule
US-029|spikes/icbetnetf/extracted-text-sample.txt|-|VUAN
US-029|test/fixtures/ICBETNETF-2026-09-24.pdf|-|%PDF-
US-029|test/fixtures/README.md|-|ICBETNETF
US-029|test/fixtures/bvb/ICBETNETF-instrument-2026-09-27.html|-|ICBETNETF
US-029|test/fixtures/bvb/README.md|-|ICBETNETF
US-029|test/fixtures/expected.json|-|ICBETNETF
US-030|dev_minions/architecture/data-model.md|EtfConfigDeps.now|injected `now`
US-030|dev_minions/architecture/data-model.md|etf_report_links|etf_report_links
US-030|lib/config/default-deps.ts|createEtfConfigDeps|createEtfConfigDeps
US-030|lib/config/default-deps.ts|now: () => new Date()|now: () => new Date()
US-030|lib/config/detect-adapter.ts|DetectionResult|DetectionResult
US-030|lib/config/detect-adapter.ts|found|found
US-030|lib/config/detect-adapter.ts|reportUrl?|reportUrl
US-030|lib/config/etfs.ts|EtfConfigDeps|EtfConfigDeps
US-030|lib/config/etfs.ts|addEtf|addEtf
US-030|lib/config/etfs.ts|detectEtfAdapter|detectEtfAdapter
US-030|lib/config/etfs.ts|now|now
US-030|lib/cron/daily-job.ts|DailyJobDeps.runIngestion|DailyJobDeps
US-030|lib/cron/daily-job.ts|{ startedAt }|startedAt
US-030|lib/cron/default-deps.ts|now|now
US-030|lib/cron/default-deps.ts|runDailyIngestion|runDailyIngestion
US-030|lib/cron/default-deps.ts|runIngestion|runIngestion
US-030|lib/cron/default-deps.ts|{ startedAt, now }|startedAt
US-030|lib/cron/default-deps.ts|{ startedAt, now }|now
US-030|lib/db/schema.ts|etfReportLinks|etfReportLinks
US-030|lib/ingestion/default-deps.ts|createDailyRunDeps({ now, fetchTimeoutMs? })|createDailyRunDeps
US-030|lib/ingestion/default-deps.ts|createDailyRunDeps({ now, fetchTimeoutMs? })|now
US-030|lib/ingestion/default-deps.ts|createDailyRunDeps({ now, fetchTimeoutMs? })|fetchTimeoutMs
US-030|lib/ingestion/default-deps.ts|createDefaultIngestDeps(now)|createDefaultIngestDeps
US-030|lib/ingestion/default-deps.ts|createDefaultIngestDeps(now)|now
US-030|lib/ingestion/default-deps.ts|links|links
US-030|lib/ingestion/default-deps.ts|now|now
US-030|lib/ingestion/ingest-etf.ts|IngestDeps|IngestDeps
US-030|lib/ingestion/ingest-etf.ts|found|found
US-030|lib/ingestion/ingest-etf.ts|ingestNoAdapter|ingestNoAdapter
US-030|lib/ingestion/ingest-etf.ts|links|links
US-030|lib/ingestion/ingest-etf.ts|now|now
US-030|lib/ingestion/outcome.ts|NoAdapterLinkOutcome|NoAdapterLinkOutcome
US-030|lib/ingestion/outcome.ts|formatNoAdapterDetail|formatNoAdapterDetail
US-030|lib/ingestion/outcome.ts|not_attempted|not_attempted
US-030|lib/ingestion/report-links.ts|etf_report_links|etf_report_links
US-030|lib/ingestion/run-daily.ts|CRON_MAX_DURATION_S|CRON_MAX_DURATION_S
US-030|lib/ingestion/run-daily.ts|FINISH_RESERVE_MS|FINISH_RESERVE_MS
US-030|lib/ingestion/run-daily.ts|PARSE_ALLOWANCE_MS|PARSE_ALLOWANCE_MS
US-030|lib/ingestion/run-daily.ts|RunBudget|RunBudget
US-030|lib/ingestion/run-daily.ts|canStartEtf|canStartEtf
US-030|lib/ingestion/run-daily.ts|etfWorstCaseMs|etfWorstCaseMs
US-030|lib/ingestion/run-daily.ts|runDailyIngestion|runDailyIngestion
US-030|lib/ingestion/run-daily.ts|runDeadlineMs|runDeadlineMs
US-030|lib/monitoring/history.ts|EtfHistory.etf|EtfHistory
US-030|lib/monitoring/history.ts|adapterAvailable|adapterAvailable
US-030|lib/monitoring/history.ts|adapter_key|adapter_key
US-030|lib/monitoring/history.ts|registry|registry
US-030|lib/monitoring/home.ts|buildLatestReportLinksStatement|buildLatestReportLinksStatement
US-030|lib/monitoring/home.ts|etf_report_links|etf_report_links
US-030|lib/monitoring/home.ts|lib/|N/A: token "lib/" was extracted from boundaries.test.ts's BD-16 annotation ("only lib/monitoring/home.ts reads it elsewhere in `lib/`"), mis-attached to home.ts by the extraction regex; not a change to home.ts itself
US-030|messages/ro.json|Admin.operations.outcome.not_attempted|"not_attempted":
US-030|messages/en.json|Admin.operations.outcome.not_attempted|"not_attempted":
US-030|messages/ro.json|EtfDetail.extractionUnavailable|"extractionUnavailable":
US-030|messages/en.json|EtfDetail.extractionUnavailable|"extractionUnavailable":
US-030|test/helpers/ingest-fakes.ts|...linkDeps()|linkDeps
US-030|test/helpers/ingest-fakes.ts|FIXED_NOW|FIXED_NOW
US-030|test/helpers/ingest-fakes.ts|FakeLinkStore|FakeLinkStore
US-030|test/helpers/ingest-fakes.ts|linkDeps()|linkDeps
US-030|test/helpers/ingest-fakes.ts|roomyBudget()|roomyBudget
US-030|test/helpers/ingest-fakes.ts|stubPipelineDeps|stubPipelineDeps
US-030|components/EtfDetail.tsx|-|extraction-unavailable
US-030|drizzle/0001_etf_report_links.sql|-|etf_report_links
US-030|drizzle/meta/0001_snapshot.json|-|etf_report_links
US-030|drizzle/meta/_journal.json|-|0001_etf_report_links
US-030|test/helpers/pglite.ts|-|_journal.json
US-031|README.md|/health|/health
US-031|app/health/page.tsx|Health.dbTimeout|failureText
US-031|lib/cron/default-deps.ts|createDailyCronDeps(options)|createDailyCronDeps
US-031|lib/cron/default-deps.ts|createDailyCronDeps(options)|options
US-031|lib/cron/default-deps.ts|defaultDailyCronDeps|defaultDailyCronDeps
US-031|lib/health.ts|HEALTH_QUERY_TIMEOUT_MS = 8_000|HEALTH_QUERY_TIMEOUT_MS = 8_000
US-031|lib/health.ts|HealthStatus|HealthStatus
US-031|lib/ingestion/default-deps.ts|DatabaseAccess|DatabaseAccess
US-031|lib/ingestion/default-deps.ts|createDailyRunDeps|createDailyRunDeps
US-031|lib/ingestion/default-deps.ts|createDefaultJobRunStore|createDefaultJobRunStore
US-031|lib/ingestion/default-deps.ts|database|database
US-031|messages/ro.json|Health.dbTimeout|"dbTimeout":
US-031|messages/en.json|Health.dbTimeout|"dbTimeout":
US-031|package.json|scripts["smoke:deploy"]|smoke:deploy
US-031|lib/smoke/deploy.ts|-|export async function runDeploySmoke
US-031|lib/smoke/deploy.ts|-|SMOKE_REQUEST_TIMEOUT_MS
US-031|scripts/smoke-deploy.ts|-|runDeploySmoke
US-031|test/e2e/fixture-web.ts|-|createFetchGuard
US-031|test/e2e/fixture-web.ts|-|expectedValues
US-031|test/e2e/fixture-web.ts|-|FIXTURE_URLS
US-029|spikes/pdf-extraction/compare.mjs|-|X3: "cross-checked against `spikes/pdf-extraction/compare.mjs`" (US-029 Files changed)
US-030|test/helpers/0000_init.sql|-|X3: "applies every journal migration, not just `0000_init.sql`" (US-030 Files changed, referring to test/helpers/pglite.ts)
```

One correction made mid-round: line 22's original grep string `EtfConfigDeps` came back `MISSING` against
`data-model.md` (the doc never uses the type name literally). Investigated: the doc documents the same fact
in different words — line 82, "clock time of the write, from the caller's injected `now`" — no regression,
wording only. Grep string corrected to `` injected `now` `` before the table below was generated.

### Step 4 — reconcile (both must print nothing)
```bash
awk -F'\t' '$3=="IN"{print $1"\t"$2}' "$OUT/pairs.tsv" | sort -u > "$OUT/expected-pairs"
cut -d'|' -f1,2 "$OUT/manifest" | tr '|' '\t' | sort -u > "$OUT/manifest-pairs"
comm -3 "$OUT/expected-pairs" "$OUT/manifest-pairs"
```
Output: 2 lines, both expected — the manifest's two X3 rows (`spikes/pdf-extraction/compare.mjs`,
`test/helpers/0000_init.sql`) are not in `expected-pairs` because Step 2 reclassified them out of `IN`.
No `IN` pair is missing from the manifest, and the manifest names no other unexpected pair.
```bash
awk -F'\t' 'NR==FNR { if ($3=="IN") inp[$1"\t"$2]=1; next }
            $2=="SYM" && (($1"\t"$3) in inp) { print $1"\t"$3"\t"$4 }' "$OUT/pairs.tsv" "$OUT/tokens.tsv" \
  | sort -u > "$OUT/expected-tokens"
awk -F'|' '$3!="-" {print $1"\t"$2"\t"$3}' "$OUT/manifest" | sort -u > "$OUT/manifest-tokens"
comm -23 "$OUT/expected-tokens" "$OUT/manifest-tokens"
```
Output: **empty.** Every annotation token attached to an in-scope pair has a manifest line.
```bash
wc -l "$OUT/expected-pairs" "$OUT/expected-tokens" "$OUT/manifest"
```
`50 expected-pairs`, `75 expected-tokens`, `108 manifest`.

### Step 5 — generate the table (pasted verbatim)
```bash
grep -c '| MISSING |' "$OUT/table.md"   # 0
grep -c '^| [0-9]' "$OUT/table.md"      # 108
```

| # | Story | File | Token | Command | First hit (≤160 chars) | Result |
|---|---|---|---|---|---|---|
| 1 | US-029 | `components/admin/TrackedFieldsAdmin.tsx` | `"EUR"` | `grep -a -c -F -- '"EUR"' components/admin/TrackedFieldsAdmin.tsx` | 17:const KNOWN_UNITS = ["RON", "EUR", "count"] as const; | present (1) |
| 2 | US-029 | `components/admin/TrackedFieldsAdmin.tsx` | `KNOWN_UNITS` | `grep -a -c -F -- 'KNOWN_UNITS' components/admin/TrackedFieldsAdmin.tsx` | 17:const KNOWN_UNITS = ["RON", "EUR", "count"] as const; | present (3) |
| 3 | US-029 | `dev_minions/architecture/data-model.md` | `Data:` | `grep -a -c -F -- 'Data:' dev_minions/architecture/data-model.md` | 98:- 'report_date' comes only from the PDF's own report-date text (BRD: the footer; InterCapital: the 'Data:' line), never from the filing stamp or the clock | present (1) |
| 4 | US-029 | `lib/db/seed-data.ts` | `intercapital-nav` | `grep -a -c -F -- 'intercapital-nav' lib/db/seed-data.ts` | 82:  // intercapital-nav (US-029): the Class B (BVB-listed) NAV per unit and units in circulation | present (9) |
| 5 | US-029 | `lib/extraction/adapters/brd-depositary.ts` | `./text` | `grep -a -c -F -- '"./text"' lib/extraction/adapters/brd-depositary.ts` | 2:import { findLabel, labelSource, tokenAfter, tokenWindowEnd } from "./text"; | present (1) |
| 6 | US-029 | `lib/extraction/adapters/brd-depositary.ts` | `BRD_BLOCK_TOKENS = 7` | `grep -a -c -F -- 'BRD_BLOCK_TOKENS = 7' lib/extraction/adapters/brd-depositary.ts` | 34:const BRD_BLOCK_TOKENS = 7; | present (1) |
| 7 | US-029 | `lib/extraction/adapters/default-registry.ts` | `intercapitalNavAdapter` | `grep -a -c -F -- 'intercapitalNavAdapter' lib/extraction/adapters/default-registry.ts` | 2:import { intercapitalNavAdapter } from "./intercapital-nav"; | present (2) |
| 8 | US-029 | `lib/ingestion/run-daily.ts` | `MAX_REQUESTS_PER_ETF = 2` | `grep -a -c -F -- 'MAX_REQUESTS_PER_ETF = 2' lib/ingestion/run-daily.ts` | 10:export const MAX_REQUESTS_PER_ETF = 2; | present (1) |
| 9 | US-029 | `messages/ro.json` | `Admin.fields.units.EUR` | `grep -a -c -F -- '"EUR":' messages/ro.json` | 93:        "EUR": "EUR", | present (1) |
| 10 | US-029 | `messages/en.json` | `Admin.fields.units.EUR` | `grep -a -c -F -- '"EUR":' messages/en.json` | 93:        "EUR": "EUR", | present (1) |
| 11 | US-029 | `lib/extraction/adapters/intercapital-nav.ts` | `-` | `grep -a -c -F -- 'export const intercapitalNavAdapter' lib/extraction/adapters/intercapital-nav.ts` | 165:export const intercapitalNavAdapter: ExtractionAdapter = { | present (1) |
| 12 | US-029 | `lib/extraction/adapters/intercapital-nav.ts` | `-` | `grep -a -c -F -- 'INTERCAPITAL_NAV_KEY' lib/extraction/adapters/intercapital-nav.ts` | 5:export const INTERCAPITAL_NAV_KEY = "intercapital-nav"; | present (2) |
| 13 | US-029 | `lib/extraction/adapters/text.ts` | `-` | `grep -a -c -F -- 'export function labelSource' lib/extraction/adapters/text.ts` | 9:export function labelSource(label: string): string { | present (1) |
| 14 | US-029 | `lib/extraction/adapters/text.ts` | `-` | `grep -a -c -F -- 'export type Span' lib/extraction/adapters/text.ts` | 17:export type Span = { start: number; end: number }; | present (1) |
| 15 | US-029 | `spikes/icbetnetf/FINDINGS.md` | `-` | `grep -a -c -F -- '## 7. Positional rule' spikes/icbetnetf/FINDINGS.md` | 153:## 7. Positional rule — per-class table (Phase B, 'intercapital-nav') | present (1) |
| 16 | US-029 | `spikes/icbetnetf/extracted-text-sample.txt` | `-` | `grep -a -c -F -- 'VUAN' spikes/icbetnetf/extracted-text-sample.txt` | 3:InterCapital ETF d.o.o. ... NAV per Unit VUAN ... | present (1) |
| 17 | US-029 | `test/fixtures/ICBETNETF-2026-09-24.pdf` | `-` | `grep -a -c -F -- '%PDF-' test/fixtures/ICBETNETF-2026-09-24.pdf` | 1:%PDF-1.7 | present (1) |
| 18 | US-029 | `test/fixtures/README.md` | `-` | `grep -a -c -F -- 'ICBETNETF' test/fixtures/README.md` | 20:  'ICBETNETF' is captured and extracted here without being seeded ... | present (1) |
| 19 | US-029 | `test/fixtures/bvb/ICBETNETF-instrument-2026-09-27.html` | `-` | `grep -a -c -F -- 'ICBETNETF' test/fixtures/bvb/ICBETNETF-instrument-2026-09-27.html` | 7:BVB - Unitati de fond ICBETNETF INTERCAPITAL BET-TRN UCITS ETF | present (18) |
| 20 | US-029 | `test/fixtures/bvb/README.md` | `-` | `grep -a -c -F -- 'ICBETNETF' test/fixtures/bvb/README.md` | 149:## 8. ICBETNETF (US-029 spike) | present (4) |
| 21 | US-029 | `test/fixtures/expected.json` | `-` | `grep -a -c -F -- 'ICBETNETF' test/fixtures/expected.json` | 178:      "file": "ICBETNETF-2026-09-24.pdf", | present (2) |
| 22 | US-030 | `dev_minions/architecture/data-model.md` | `EtfConfigDeps.now` | `` grep -a -c -F -- 'injected `now`' dev_minions/architecture/data-model.md `` | 82: discovered_at ... clock time of the write, from the caller's injected `now` | present (1) |
| 23 | US-030 | `dev_minions/architecture/data-model.md` | `etf_report_links` | `grep -a -c -F -- 'etf_report_links' dev_minions/architecture/data-model.md` | 77:### `etf_report_links` — newest known report link for a no-adapter ETF (Section 3, US-030) | present (2) |
| 24 | US-030 | `lib/config/default-deps.ts` | `createEtfConfigDeps` | `grep -a -c -F -- 'createEtfConfigDeps' lib/config/default-deps.ts` | 16:export function createEtfConfigDeps(db: Db): EtfConfigDeps { | present (1) |
| 25 | US-030 | `lib/config/default-deps.ts` | `now: () => new Date()` | `grep -a -c -F -- 'now: () => new Date()' lib/config/default-deps.ts` | 28:    now: () => new Date(), | present (1) |
| 26 | US-030 | `lib/config/detect-adapter.ts` | `DetectionResult` | `grep -a -c -F -- 'DetectionResult' lib/config/detect-adapter.ts` | 20:export type DetectionResult = { adapterKey: string \| null; reason: DetectionReason; reportUrl?: string }; | present (2) |
| 27 | US-030 | `lib/config/detect-adapter.ts` | `found` | `grep -a -c -F -- 'found' lib/config/detect-adapter.ts` | 13:  \| "not_found" | present (3) |
| 28 | US-030 | `lib/config/detect-adapter.ts` | `reportUrl?` | `grep -a -c -F -- 'reportUrl' lib/config/detect-adapter.ts` | 20:export type DetectionResult = { adapterKey: string \| null; reason: DetectionReason; reportUrl?: string }; | present (8) |
| 29 | US-030 | `lib/config/etfs.ts` | `EtfConfigDeps` | `grep -a -c -F -- 'EtfConfigDeps' lib/config/etfs.ts` | 34:export type EtfConfigDeps = { | present (8) |
| 30 | US-030 | `lib/config/etfs.ts` | `addEtf` | `grep -a -c -F -- 'addEtf' lib/config/etfs.ts` | 96:export async function addEtf( | present (1) |
| 31 | US-030 | `lib/config/etfs.ts` | `detectEtfAdapter` | `grep -a -c -F -- 'detectEtfAdapter' lib/config/etfs.ts` | 186:export async function detectEtfAdapter( | present (1) |
| 32 | US-030 | `lib/config/etfs.ts` | `now` | `grep -a -c -F -- 'now' lib/config/etfs.ts` | 39:  now: () => Date; | present (9) |
| 33 | US-030 | `lib/cron/daily-job.ts` | `DailyJobDeps.runIngestion` | `grep -a -c -F -- 'DailyJobDeps' lib/cron/daily-job.ts` | 12:export type DailyJobDeps = { | present (2) |
| 34 | US-030 | `lib/cron/daily-job.ts` | `{ startedAt }` | `grep -a -c -F -- 'startedAt' lib/cron/daily-job.ts` | 15:  runIngestion: (ctx: { startedAt: Date }) => Promise<DailyRunSummary>; | present (5) |
| 35 | US-030 | `lib/cron/default-deps.ts` | `now` | `grep -a -c -F -- 'now' lib/cron/default-deps.ts` | 6:const now = () => new Date(); | present (3) |
| 36 | US-030 | `lib/cron/default-deps.ts` | `runDailyIngestion` | `grep -a -c -F -- 'runDailyIngestion' lib/cron/default-deps.ts` | 2:import { runDailyIngestion } from "../ingestion/run-daily"; | present (2) |
| 37 | US-030 | `lib/cron/default-deps.ts` | `runIngestion` | `grep -a -c -F -- 'runIngestion' lib/cron/default-deps.ts` | 21:        runIngestion: ({ startedAt }) => | present (1) |
| 38 | US-030 | `lib/cron/default-deps.ts` | `{ startedAt, now }` | `grep -a -c -F -- 'startedAt' lib/cron/default-deps.ts` | 21:        runIngestion: ({ startedAt }) => | present (2) |
| 39 | US-030 | `lib/cron/default-deps.ts` | `{ startedAt, now }` | `grep -a -c -F -- 'now' lib/cron/default-deps.ts` | 6:const now = () => new Date(); | present (3) |
| 40 | US-030 | `lib/db/schema.ts` | `etfReportLinks` | `grep -a -c -F -- 'etfReportLinks' lib/db/schema.ts` | 106:export const etfReportLinks = pgTable("etf_report_links", { | present (1) |
| 41 | US-030 | `lib/ingestion/default-deps.ts` | `createDailyRunDeps({ now, fetchTimeoutMs? })` | `grep -a -c -F -- 'createDailyRunDeps' lib/ingestion/default-deps.ts` | 44:export function createDailyRunDeps(options: { | present (1) |
| 42 | US-030 | `lib/ingestion/default-deps.ts` | `createDailyRunDeps({ now, fetchTimeoutMs? })` | `grep -a -c -F -- 'now' lib/ingestion/default-deps.ts` | 24: * 'now' is required (never read from the system clock inside 'lib/ingestion', BD-3). | present (5) |
| 43 | US-030 | `lib/ingestion/default-deps.ts` | `createDailyRunDeps({ now, fetchTimeoutMs? })` | `grep -a -c -F -- 'fetchTimeoutMs' lib/ingestion/default-deps.ts` | 40: * The cron route's dependencies: a shorter per-request 'fetchTimeoutMs' than the default | present (3) |
| 44 | US-030 | `lib/ingestion/default-deps.ts` | `createDefaultIngestDeps(now)` | `grep -a -c -F -- 'createDefaultIngestDeps' lib/ingestion/default-deps.ts` | 26:export function createDefaultIngestDeps(now: () => Date): IngestDeps { | present (1) |
| 45 | US-030 | `lib/ingestion/default-deps.ts` | `createDefaultIngestDeps(now)` | `grep -a -c -F -- 'now' lib/ingestion/default-deps.ts` | 24: * 'now' is required (never read from the system clock inside 'lib/ingestion', BD-3). | present (5) |
| 46 | US-030 | `lib/ingestion/default-deps.ts` | `links` | `grep -a -c -F -- 'links' lib/ingestion/default-deps.ts` | 8:import { createDrizzleReportLinkStore } from "./report-links"; | present (3) |
| 47 | US-030 | `lib/ingestion/default-deps.ts` | `now` | `grep -a -c -F -- 'now' lib/ingestion/default-deps.ts` | 24: * 'now' is required (never read from the system clock inside 'lib/ingestion', BD-3). | present (5) |
| 48 | US-030 | `lib/ingestion/ingest-etf.ts` | `IngestDeps` | `grep -a -c -F -- 'IngestDeps' lib/ingestion/ingest-etf.ts` | 28:export type IngestDeps = { | present (4) |
| 49 | US-030 | `lib/ingestion/ingest-etf.ts` | `found` | `grep -a -c -F -- 'found' lib/ingestion/ingest-etf.ts` | 134:  if (discovery.status === "not_found") { | present (4) |
| 50 | US-030 | `lib/ingestion/ingest-etf.ts` | `ingestNoAdapter` | `grep -a -c -F -- 'ingestNoAdapter' lib/ingestion/ingest-etf.ts` | 108:    return ingestNoAdapter(etf, base, deps); | present (2) |
| 51 | US-030 | `lib/ingestion/ingest-etf.ts` | `links` | `grep -a -c -F -- 'links' lib/ingestion/ingest-etf.ts` | 14:import type { ReportLinkStore } from "./report-links"; | present (4) |
| 52 | US-030 | `lib/ingestion/ingest-etf.ts` | `now` | `grep -a -c -F -- 'now' lib/ingestion/ingest-etf.ts` | 35:  now: () => Date; | present (2) |
| 53 | US-030 | `lib/ingestion/outcome.ts` | `NoAdapterLinkOutcome` | `grep -a -c -F -- 'NoAdapterLinkOutcome' lib/ingestion/outcome.ts` | 59:export type NoAdapterLinkOutcome = | present (2) |
| 54 | US-030 | `lib/ingestion/outcome.ts` | `formatNoAdapterDetail` | `grep -a -c -F -- 'formatNoAdapterDetail' lib/ingestion/outcome.ts` | 67:export function formatNoAdapterDetail(base: string, link: NoAdapterLinkOutcome): string { | present (1) |
| 55 | US-030 | `lib/ingestion/outcome.ts` | `not_attempted` | `grep -a -c -F -- 'not_attempted' lib/ingestion/outcome.ts` | 12:  "not_attempted", | present (2) |
| 56 | US-030 | `lib/ingestion/report-links.ts` | `etf_report_links` | `grep -a -c -F -- 'etf_report_links' lib/ingestion/report-links.ts` | 28:    sql'insert into "etf_report_links" ("etf_id", "source_url", "discovered_at") | present (2) |
| 57 | US-030 | `lib/ingestion/run-daily.ts` | `CRON_MAX_DURATION_S` | `grep -a -c -F -- 'CRON_MAX_DURATION_S' lib/ingestion/run-daily.ts` | 13:export const CRON_MAX_DURATION_S = 60; | present (2) |
| 58 | US-030 | `lib/ingestion/run-daily.ts` | `FINISH_RESERVE_MS` | `grep -a -c -F -- 'FINISH_RESERVE_MS' lib/ingestion/run-daily.ts` | 19:export const FINISH_RESERVE_MS = 5_000; | present (2) |
| 59 | US-030 | `lib/ingestion/run-daily.ts` | `PARSE_ALLOWANCE_MS` | `grep -a -c -F -- 'PARSE_ALLOWANCE_MS' lib/ingestion/run-daily.ts` | 16:export const PARSE_ALLOWANCE_MS = 5_000; | present (2) |
| 60 | US-030 | `lib/ingestion/run-daily.ts` | `RunBudget` | `grep -a -c -F -- 'RunBudget' lib/ingestion/run-daily.ts` | 47:export type RunBudget = { startedAt: Date; now: () => Date }; | present (2) |
| 61 | US-030 | `lib/ingestion/run-daily.ts` | `canStartEtf` | `grep -a -c -F -- 'canStartEtf' lib/ingestion/run-daily.ts` | 32:export function canStartEtf(now: Date, startedAt: Date): boolean { | present (2) |
| 62 | US-030 | `lib/ingestion/run-daily.ts` | `etfWorstCaseMs` | `grep -a -c -F -- 'etfWorstCaseMs' lib/ingestion/run-daily.ts` | 22:export function etfWorstCaseMs(requests: number = MAX_REQUESTS_PER_ETF): number { | present (2) |
| 63 | US-030 | `lib/ingestion/run-daily.ts` | `runDailyIngestion` | `grep -a -c -F -- 'runDailyIngestion' lib/ingestion/run-daily.ts` | 56:export async function runDailyIngestion(deps: DailyRunDeps, budget: RunBudget): Promise<DailyRunSummary> { | present (1) |
| 64 | US-030 | `lib/ingestion/run-daily.ts` | `runDeadlineMs` | `grep -a -c -F -- 'runDeadlineMs' lib/ingestion/run-daily.ts` | 27:export function runDeadlineMs(startedAt: Date): number { | present (2) |
| 65 | US-030 | `lib/monitoring/history.ts` | `EtfHistory.etf` | `grep -a -c -F -- 'EtfHistory' lib/monitoring/history.ts` | 13:export type EtfHistory = { | present (3) |
| 66 | US-030 | `lib/monitoring/history.ts` | `adapterAvailable` | `grep -a -c -F -- 'adapterAvailable' lib/monitoring/history.ts` | 14:  etf: { symbol: string; name: string; isActive: boolean; adapterAvailable: boolean }; | present (2) |
| 67 | US-030 | `lib/monitoring/history.ts` | `adapter_key` | `grep -a -c -F -- 'adapter_key' lib/monitoring/history.ts` | 7:/** One tracked field's column (US-018 AC3), labelled from the ETF's own 'adapter_key' (R4). */ | present (6) |
| 68 | US-030 | `lib/monitoring/history.ts` | `registry` | `grep -a -c -F -- 'registry' lib/monitoring/history.ts` | 3:import { defaultAdapterRegistry } from "../extraction/adapters/default-registry"; | present (3) |
| 69 | US-030 | `lib/monitoring/home.ts` | `buildLatestReportLinksStatement` | `grep -a -c -F -- 'buildLatestReportLinksStatement' lib/monitoring/home.ts` | 118:export function buildLatestReportLinksStatement(db: Db) { | present (2) |
| 70 | US-030 | `lib/monitoring/home.ts` | `etf_report_links` | `grep -a -c -F -- 'etf_report_links' lib/monitoring/home.ts` | 115: * 'etf_report_links' row competes with the newest 'reports.source_url'). A NULL 'fetched_at' | present (2) |
| 71 | US-030 | `lib/monitoring/home.ts` | `lib/` | — | — | N/A: token "lib/" was extracted from `boundaries.test.ts`'s BD-16 annotation ("only `report-links.ts` writes `etf_report_links`, only `lib/monitoring/home.ts` reads it elsewhere in `lib/`"), mis-attached to `home.ts` by the extraction regex (it followed the last full path in that clause); not a change to `home.ts` itself. |
| 72 | US-030 | `messages/ro.json` | `Admin.operations.outcome.not_attempted` | `grep -a -c -F -- '"not_attempted":' messages/ro.json` | 184:        "not_attempted": "neîncercat (limita de timp a rulării)" | present (1) |
| 73 | US-030 | `messages/en.json` | `Admin.operations.outcome.not_attempted` | `grep -a -c -F -- '"not_attempted":' messages/en.json` | 184:        "not_attempted": "not attempted (run time limit)" | present (1) |
| 74 | US-030 | `messages/ro.json` | `EtfDetail.extractionUnavailable` | `grep -a -c -F -- '"extractionUnavailable":' messages/ro.json` | 12:    "extractionUnavailable": "extragere indisponibilă", (2nd hit line 26, EtfDetail's own) | present (2) |
| 75 | US-030 | `messages/en.json` | `EtfDetail.extractionUnavailable` | `grep -a -c -F -- '"extractionUnavailable":' messages/en.json` | 12:    "extractionUnavailable": "extraction unavailable", (2nd hit line 26, EtfDetail's own) | present (2) |
| 76 | US-030 | `test/helpers/ingest-fakes.ts` | `...linkDeps()` | `grep -a -c -F -- 'linkDeps' test/helpers/ingest-fakes.ts` | 23:export function linkDeps(): { links: ReportLinkStore; now: () => Date } { | present (2) |
| 77 | US-030 | `test/helpers/ingest-fakes.ts` | `FIXED_NOW` | `grep -a -c -F -- 'FIXED_NOW' test/helpers/ingest-fakes.ts` | 9:export const FIXED_NOW = new Date("2026-09-27T08:00:00Z"); | present (3) |
| 78 | US-030 | `test/helpers/ingest-fakes.ts` | `FakeLinkStore` | `grep -a -c -F -- 'FakeLinkStore' test/helpers/ingest-fakes.ts` | 11:export class FakeLinkStore implements ReportLinkStore { | present (2) |
| 79 | US-030 | `test/helpers/ingest-fakes.ts` | `linkDeps()` | `grep -a -c -F -- 'linkDeps' test/helpers/ingest-fakes.ts` | 23:export function linkDeps(): { links: ReportLinkStore; now: () => Date } { | present (2) |
| 80 | US-030 | `test/helpers/ingest-fakes.ts` | `roomyBudget()` | `grep -a -c -F -- 'roomyBudget' test/helpers/ingest-fakes.ts` | 28:export function roomyBudget(startedAt: Date = FIXED_NOW): RunBudget { | present (1) |
| 81 | US-030 | `test/helpers/ingest-fakes.ts` | `stubPipelineDeps` | `grep -a -c -F -- 'stubPipelineDeps' test/helpers/ingest-fakes.ts` | 98:export function stubPipelineDeps( | present (1) |
| 82 | US-030 | `components/EtfDetail.tsx` | `-` | `grep -a -c -F -- 'extraction-unavailable' components/EtfDetail.tsx` | 32:      {!etf.adapterAvailable && <p data-extraction-unavailable>{t("extractionUnavailable")}</p>} | present (1) |
| 83 | US-030 | `drizzle/0001_etf_report_links.sql` | `-` | `grep -a -c -F -- 'etf_report_links' drizzle/0001_etf_report_links.sql` | 1:CREATE TABLE "etf_report_links" ( | present (2) |
| 84 | US-030 | `drizzle/meta/0001_snapshot.json` | `-` | `grep -a -c -F -- 'etf_report_links' drizzle/meta/0001_snapshot.json` | 7:    "public.etf_report_links": { | present (5) |
| 85 | US-030 | `drizzle/meta/_journal.json` | `-` | `grep -a -c -F -- '0001_etf_report_links' drizzle/meta/_journal.json` | 16:      "tag": "0001_etf_report_links", | present (1) |
| 86 | US-030 | `test/helpers/pglite.ts` | `-` | `grep -a -c -F -- '_journal.json' test/helpers/pglite.ts` | 10:const JOURNAL_PATH = path.join(DRIZZLE_DIR, "meta", "_journal.json"); | present (1) |
| 87 | US-031 | `README.md` | `/health` | `grep -a -c -F -- '/health' README.md` | 96:7. Open the deployed '/health' page and confirm it reports a successful database | present (3) |
| 88 | US-031 | `app/health/page.tsx` | `Health.dbTimeout` | `grep -a -c -F -- 'failureText' app/health/page.tsx` | 5:import { failureText } from "./failure-text"; | present (2) |
| 89 | US-031 | `lib/cron/default-deps.ts` | `createDailyCronDeps(options)` | `grep -a -c -F -- 'createDailyCronDeps' lib/cron/default-deps.ts` | 14:export function createDailyCronDeps(options: { database?: DatabaseAccess } = {}): DailyCronDeps { | present (2) |
| 90 | US-031 | `lib/cron/default-deps.ts` | `createDailyCronDeps(options)` | `grep -a -c -F -- 'options' lib/cron/default-deps.ts` | 9: * 'options.database', when present, is passed to both factories unchanged (US-031 plan section | present (4) |
| 91 | US-031 | `lib/cron/default-deps.ts` | `defaultDailyCronDeps` | `grep -a -c -F -- 'defaultDailyCronDeps' lib/cron/default-deps.ts` | 11: * 'defaultDailyCronDeps' below passes 'undefined' to both, which is the unchanged production | present (2) |
| 92 | US-031 | `lib/health.ts` | `HEALTH_QUERY_TIMEOUT_MS = 8_000` | `grep -a -c -F -- 'HEALTH_QUERY_TIMEOUT_MS = 8_000' lib/health.ts` | 15:export const HEALTH_QUERY_TIMEOUT_MS = 8_000; | present (1) |
| 93 | US-031 | `lib/health.ts` | `HealthStatus` | `grep -a -c -F -- 'HealthStatus' lib/health.ts` | 5:export type HealthStatus = | present (2) |
| 94 | US-031 | `lib/ingestion/default-deps.ts` | `DatabaseAccess` | `grep -a -c -F -- 'DatabaseAccess' lib/ingestion/default-deps.ts` | 18:export type DatabaseAccess = { db: Db; run: BatchRunner }; | present (3) |
| 95 | US-031 | `lib/ingestion/default-deps.ts` | `createDailyRunDeps` | `grep -a -c -F -- 'createDailyRunDeps' lib/ingestion/default-deps.ts` | 44:export function createDailyRunDeps(options: { | present (1) |
| 96 | US-031 | `lib/ingestion/default-deps.ts` | `createDefaultJobRunStore` | `grep -a -c -F -- 'createDefaultJobRunStore' lib/ingestion/default-deps.ts` | 68:export function createDefaultJobRunStore(database?: DatabaseAccess): JobRunStore { | present (1) |
| 97 | US-031 | `lib/ingestion/default-deps.ts` | `database` | `grep -a -c -F -- 'database' lib/ingestion/default-deps.ts` | 14: * A database and the batch runner to use with it. Only tests inject this (US-031 plan section | present (7) |
| 98 | US-031 | `messages/ro.json` | `Health.dbTimeout` | `grep -a -c -F -- '"dbTimeout":' messages/ro.json` | 246:    "dbTimeout": "Baza de date nu a răspuns la timp.", | present (1) |
| 99 | US-031 | `messages/en.json` | `Health.dbTimeout` | `grep -a -c -F -- '"dbTimeout":' messages/en.json` | 246:    "dbTimeout": "The database did not answer in time.", | present (1) |
| 100 | US-031 | `package.json` | `scripts["smoke:deploy"]` | `grep -a -c -F -- 'smoke:deploy' package.json` | 16:    "smoke:deploy": "tsx scripts/smoke-deploy.ts" | present (1) |
| 101 | US-031 | `lib/smoke/deploy.ts` | `-` | `grep -a -c -F -- 'export async function runDeploySmoke' lib/smoke/deploy.ts` | 213:export async function runDeploySmoke(argv: readonly string[], deps: { fetchImpl: FetchImpl }): Promise<RunDeploySmokeResult> { | present (1) |
| 102 | US-031 | `lib/smoke/deploy.ts` | `-` | `grep -a -c -F -- 'SMOKE_REQUEST_TIMEOUT_MS' lib/smoke/deploy.ts` | 6:export const SMOKE_REQUEST_TIMEOUT_MS = 30_000; | present (2) |
| 103 | US-031 | `scripts/smoke-deploy.ts` | `-` | `grep -a -c -F -- 'runDeploySmoke' scripts/smoke-deploy.ts` | 1:import { runDeploySmoke } from "../lib/smoke/deploy"; | present (2) |
| 104 | US-031 | `test/e2e/fixture-web.ts` | `-` | `grep -a -c -F -- 'createFetchGuard' test/e2e/fixture-web.ts` | 95:export function createFetchGuard(initialMap: FetchMap): FetchGuard { | present (1) |
| 105 | US-031 | `test/e2e/fixture-web.ts` | `-` | `grep -a -c -F -- 'expectedValues' test/e2e/fixture-web.ts` | 125:export function expectedValues(file: string): Record<string, ExpectedValue> { | present (1) |
| 106 | US-031 | `test/e2e/fixture-web.ts` | `-` | `grep -a -c -F -- 'FIXTURE_URLS' test/e2e/fixture-web.ts` | 9:export const FIXTURE_URLS = { | present (13) |
| 107 | US-029 | `spikes/pdf-extraction/compare.mjs` | `-` | — | — | X3: "cross-checked against `spikes/pdf-extraction/compare.mjs`" (US-029 Files changed) |
| 108 | US-030 | `test/helpers/0000_init.sql` | `-` | — | — | X3: "applies every journal migration, not just `0000_init.sql`" (US-030 Files changed, referring to test/helpers/pglite.ts) |

**Extra row (Task 1's move, not from the manifest):** `app/health/failure-text.ts` — `dbTimeout` — present:
`grep -a -c -F -- 'dbTimeout' app/health/failure-text.ts` → `t("dbTimeout")` at line 8 → present (1). This
is where US-031's `Health.dbTimeout` behaviour actually lives now; row 88 above proves `page.tsx` still
reaches it through `failureText`.

### Step 6 — message-key paths (all 8 lines end in `string`)
Key list taken from the extraction (not typed by hand):
`Health.dbTimeout`, `Admin.fields.units.EUR`, `EtfDetail.extractionUnavailable`, `Admin.operations.outcome.not_attempted`.
```
messages/en.json Health.dbTimeout string
messages/en.json Admin.fields.units.EUR string
messages/en.json EtfDetail.extractionUnavailable string
messages/en.json Admin.operations.outcome.not_attempted string
messages/ro.json Health.dbTimeout string
messages/ro.json Admin.fields.units.EUR string
messages/ro.json EtfDetail.extractionUnavailable string
messages/ro.json Admin.operations.outcome.not_attempted string
```

### Conclusion (quoted numbers only)
50 in-scope (story, file) pairs (17 US-029, 22 US-030, 11 US-031), 75 annotation tokens, 2 X3 references,
1 N/A (a mis-attached token, explained in row 71), 108 manifest lines, 108 table rows, **0 MISSING**, both
reconciliation `comm` checks empty, all 8 message-key `node` checks `string`. One grep string (row 22) was
corrected mid-round after a documented false MISSING (wording difference, not a regression). Two path
mis-resolutions in the mechanical extraction itself (`README.md`/`package.json` attributed to `components/`)
were corrected before the table was generated, with the reasoning shown above.

`app/health/page.tsx` was the one file HANDOVER flagged as unverified going into this story (it said
"renders `Health.dbTimeout` for the timeout state only" but the on-disk ternary read `status.error` for
every failure, matching the Vercel build error). Fixed under Task 1: `failureText(status, t)`, now in
`app/health/failure-text.ts` and imported by `app/health/page.tsx`, switches on `"timedOut" in status` /
`"error" in status` with a `const _exhaustive: never = status` default branch.

## Round 1 — 2026-09-28

Verdict: PASS

### Acceptance criteria

**AC1** — `/health` renders the timeout state.
- Test: `app/health/page.failure.test.tsx:68` — HP-F2 (ro/en), query never settles, page shows `dbUnreachable` + `dbTimeout` (not `dbConnected`, not "Error:"/"Eroare:").
- Status: MET
- Evidence: `pnpm test app/health/page.failure.test.tsx` exits 0; HP-F2 (ro/en) both test and pass the timeout path, asserting lines 82–86 absence of `dbConnected` and error strings.

**AC2** — The error state is unchanged.
- Test: `app/health/page.failure.test.tsx:51` — HP-F1 (ro/en), getDb() throws MissingDatabaseUrlError, shows `dbUnreachable` + "DATABASE_URL is not set" (P15 default).
- Status: MET
- Evidence: `pnpm test app/health/page.failure.test.tsx` exits 0; HP-F1 (ro/en) both test and pass the error path, asserting lines 60–62 the error text.

**AC3** — Exhaustive by construction.
- Test: `app/health/page.failure.test.tsx:89` — HP-F3 tests `failureText(status, t)` is called with each `HealthStatus` failure member (timedOut + error), verifying it maps to translated text.
- Status: MET
- Evidence: `pnpm test app/health/page.failure.test.tsx` exits 0; HP-F3 tests both `timedOut` and `error` branches (lines 94–97). The `failureText` function at `app/health/failure-text.ts:7-16` has a `const _exhaustive: never = status` default branch (line 14), so any new `HealthStatus` member fails typecheck.

**AC4** — Cross-check written and clean.
- Status: MET
- Evidence: table above covers every non-test/source+message file from US-029/030/031 "Files changed" (49 rows, excluding test files and prose files); all rows show "present"; nothing was needed restoring. The one unverified file (`app/health/page.tsx`) is now fixed with `failureText` import (line 5) replacing the ternary. Round 1 fix documented above (lines 6–12): earlier version checked only examples, review correctly failed AC4, fixed version is exhaustive.

**AC5** — The four gates pass.
- Test: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test`, all with `DATABASE_URL`, `CRON_SECRET`, `GEMINI_API_KEY`, `GROQ_API_KEY` unset.
- Status: MET
- Evidence:
  - `pnpm install --frozen-lockfile`: exit 0, "Done in 507ms".
  - `pnpm typecheck`: exit 0, "tsc --noEmit" with no output (no TS errors).
  - `pnpm lint`: exit 0, "0 errors, 8 warnings" (8 pre-existing, matching HANDOVER US-031 statement).
  - `pnpm build`: exit 0, "Route (app) … ƒ /health" + 12 routes compiled offline (no DB/key access).
  - `pnpm test`: exit 0, "Test Files 155 passed (155), Tests 1684 passed (1684)" (155 files, 1684 tests, no CPS-1 or PGlite timeout this run).

Denied or attempted commands: none
