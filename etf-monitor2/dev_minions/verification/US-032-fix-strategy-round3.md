# US-032 — Fix strategy, round 3 (AC4 only)
> story-planner, 2026-09-28. Written at the orchestrator's request, before a third attempt at AC4.

## Why rounds 1 and 2 failed
Both rounds built the table by hand: the author went through the files one at a time and picked a
"headline symbol" for each. That approach loses rows in three ways, and every gap either review
found falls into one of them:
1. **One row per file instead of one per (file, story).** `messages/en.json`, `messages/ro.json`,
   `lib/ingestion/run-daily.ts`, `lib/ingestion/default-deps.ts`, `lib/cron/default-deps.ts` and
   `dev_minions/architecture/data-model.md` were each changed by two stories. Only one story's
   change got checked. Neither review caught data-model.md's US-029 wording change (the
   InterCapital `Data:` line).
2. **One symbol per pair even when HANDOVER lists several.** Examples: US-030's
   `run-daily.ts` lists seven names, `brd-depositary.ts` (US-029) lists `./text` and
   `BRD_BLOCK_TOKENS = 7`, and `README.md` (US-031) lists the smoke section and the `/health`
   timeout note.
3. **Exclusions decided file by file.** `test/e2e/fixture-web.ts` was dropped without matching any
   stated rule.

The table also claimed counts it never measured ("49 rows" when it had 33, and "all present").

The fix is to **generate the table from HANDOVER.md by script and reconcile it against HANDOVER.md
by set difference.** Nothing gets typed into the table by hand. The only hand-written input is a
mapping from each annotation token to a grep string, and the reconciliation fails if that mapping
leaves out any file or any token.

## Unit of the table
Each row is one **(story, file, token)** triple:
- **story**: US-029, US-030 or US-031.
- **file**: every path in that story's `## Files changed (US-0NN, …)` section of
  `dev_minions/HANDOVER.md` (headings at lines 81, 118 and 217 today).
- **token**: every backticked name in that file's annotation, for example
  `CRON_MAX_DURATION_S` or `Admin.fields.units.EUR`.

## Closed exclusion rules (decided by the file path, no judgment)
- **X1**: the basename matches `\.test\.tsx?$`, which includes `*.pglite.test.ts`. It is a test file.
- **X2**: the path starts with `dev_minions/verification/`. It is a process artifact.
- **X3**: the path appears only as a *reference* inside another file's annotation and was not
  changed. Each X3 needs a manifest line that quotes the HANDOVER words showing it is a reference.
  I expect exactly two:
  - `spikes/pdf-extraction/compare.mjs` (US-029, "cross-checked against")
  - the bare `0000_init.sql` (US-030, "not just `0000_init.sql`"). It resolves to
    `test/helpers/0000_init.sql`, which does not exist.

Everything else gets checked. That includes `test/helpers/*.ts`, `test/e2e/fixture-web.ts`, the
`drizzle/` files, `README.md`, `data-model.md`, the spike notes and the test fixture data
(`expected.json`, the ICBETNETF HTML and PDF, and both fixture READMEs). Grepping those is cheaper
than arguing whether they count as "source". This drops the round-2 table's "pure prose/data"
exclusion. That exclusion was a judgment call, and judgment calls are what broke the method
(TECHNICAL, settled here, see Decisions).

## Procedure
Run everything from the repo root. It writes only under `/tmp/us032/` and reads only
`dev_minions/HANDOVER.md` and the checked files. It reads no `.env*` file and runs no git.

### Step 1: extract tokens (mechanical)
```bash
export LC_ALL=C; H=dev_minions/HANDOVER.md; OUT=/tmp/us032; mkdir -p "$OUT"
# guard: a section line with an odd number of backticks would mis-pair tokens. Expected output: nothing.
for s in 029 030 031; do
  awk -v s="$s" '$0 ~ ("^## Files changed \\(US-" s) {f=1; next} f && /^#/ {f=0} f' "$H" \
  | awk -F'`' -v s="$s" 'NF%2==0 {print "ODD-BACKTICKS US-" s ": " $0}'
done
# tokens: FILE rows (resolved path) and SYM rows (token attached to the most recent FILE)
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
A bare name such as `text.test.ts` or `default-registry.ts` resolves against the directory of the
most recent full path in the same section. That is how HANDOVER abbreviates them.

### Step 2: classify and check that paths exist (mechanical)
```bash
awk -F'\t' '$2=="FILE" { c="IN"; if ($3 ~ /\.test\.tsx?$/) c="X1"; else if ($3 ~ /^dev_minions\/verification\//) c="X2";
  print $1 "\t" $3 "\t" c }' "$OUT/tokens.tsv" | sort -u > "$OUT/pairs.tsv"
cut -f3 "$OUT/pairs.tsv" | sort | uniq -c                       # counts per class, quote this
while IFS=$'\t' read -r st p c; do [ -e "$p" ] || printf 'NOT-FOUND\t%s\t%s\t%s\n' "$st" "$p" "$c"; done < "$OUT/pairs.tsv"
```
Every `IN` path that comes back NOT-FOUND is either an X3 reference or a real deletion or
regression. Investigate each one. Never drop one silently. An X1 or X2 NOT-FOUND is a resolution
detail: note it and move on.

### Step 3: write the manifest (the only hand-written input)
Create `/tmp/us032/manifest` with one line per check, in the format `story|file|token|grep-string`:
- **token**: a SYM token copied verbatim from `tokens.tsv`, or `-` for a check added because the
  pair had no usable token.
- **grep-string**: a fixed string grepped in *that* file. It can instead be `X3: <quoted HANDOVER
  words>` or `N/A: <reason>`.

Mapping rules:
- **Identifier** (`canStartEtf`, `FakeLinkStore`): use it as is.
- **Assignment with a value** (`BRD_BLOCK_TOKENS = 7`, `MAX_REQUESTS_PER_ETF = 2`,
  `HEALTH_QUERY_TIMEOUT_MS = 8_000`): use the whole literal, so the value is checked too.
- **Call or brace expression** (`createDailyRunDeps({ now, fetchTimeoutMs? })`,
  `{ startedAt, now }`): write one line per identifier inside it. The same token may appear on
  several lines.
- **Dotted message key** (`Admin.fields.units.EUR`): grep the leaf key, e.g. `"EUR":`. The full
  path is proven in Step 6. The four message keys are attached only to `messages/ro.json` in
  HANDOVER, because the annotation follows the second file. Give `messages/en.json` the same
  lines for each of its stories.
- **`./text`**: grep `"./text"`.
- **`scripts["smoke:deploy"]`**: grep `"smoke:deploy"`.
- **`reportUrl?`**: grep `reportUrl`.
- **`EtfHistory.etf`**: grep `EtfHistory`.
- **Pair with zero tokens** (`test/helpers/pglite.ts`, `lib/extraction/adapters/text.ts`,
  `test/e2e/fixture-web.ts`, the `drizzle/` files, fixture and spike files): add `-` lines:
  - New code file: two or three `^export` names. For `fixture-web.ts` these are
    `createFetchGuard`, `expectedValues` and `FIXTURE_URLS`.
  - `pglite.ts`: `_journal.json`.
  - Generated or data file: a distinctive string. Use `etf_report_links` for the snapshot and
    `0001_etf_report_links` for the journal. Use `ICBETNETF` for `expected.json`, the HTML and
    `bvb/README.md`. Use `%PDF-` for the PDF (`grep -a`). For `extracted-text-sample.txt`, use a
    label from the report such as `VUAN`. For `FINDINGS.md`, grep the heading that marks the §7
    section. Read the file once to choose it, and quote the string in the row.
- **Quantified annotation** ("+8 `intercapital-nav` catalogue rows"): use a grep string whose count
  can be compared with the claim, e.g. `adapterKey: "intercapital-nav"`. The row's `present (N)`
  must show N ≥ 8.
- **`app/health/page.tsx` (US-031, token `Health.dbTimeout`)**: US-032 Task 1 moved the timeout
  text into `app/health/failure-text.ts`. Grep `failureText` in `page.tsx`. Below the reconciled
  table, add one clearly labelled extra row: `app/health/failure-text.ts` → `dbTimeout`.
- **`N/A` is allowed only for a token the extraction attached to the wrong file.** This happens
  when a referenced path inside another annotation becomes the "current file". The known case is
  `lib/` attached to `lib/monitoring/home.ts` from `boundaries.test.ts`'s BD-16 note. The reason
  must name the annotation the token really belongs to.

### Step 4: reconcile (mechanical; both commands must print nothing)
```bash
# (a) every IN (story,file) pair has ≥1 manifest line, and the manifest names no other pair
awk -F'\t' '$3=="IN"{print $1"\t"$2}' "$OUT/pairs.tsv" | sort -u > "$OUT/expected-pairs"
cut -d'|' -f1,2 "$OUT/manifest" | tr '|' '\t' | sort -u > "$OUT/manifest-pairs"
comm -3 "$OUT/expected-pairs" "$OUT/manifest-pairs"
# (b) every annotation token attached to an IN pair appears in the manifest
awk -F'\t' 'NR==FNR { if ($3=="IN") inp[$1"\t"$2]=1; next }
            $2=="SYM" && (($1"\t"$3) in inp) { print $1"\t"$3"\t"$4 }' "$OUT/pairs.tsv" "$OUT/tokens.tsv" \
  | sort -u > "$OUT/expected-tokens"
awk -F'|' '$3!="-" {print $1"\t"$2"\t"$3}' "$OUT/manifest" | sort -u > "$OUT/manifest-tokens"
comm -23 "$OUT/expected-tokens" "$OUT/manifest-tokens"
wc -l "$OUT/expected-pairs" "$OUT/expected-tokens" "$OUT/manifest"   # quote these counts
```
The manifest is not finished until both `comm` commands print nothing. Fix the manifest, never the
extraction. If the extraction itself is wrong, say so in the table header and give the corrected
command.

### Step 5: generate the table (mechanical; paste verbatim)
```bash
{ echo '| # | Story | File | Token | Command | First hit (≤160 chars) | Result |'
  echo '|---|---|---|---|---|---|---|'; n=0
  while IFS='|' read -r st f tok g; do n=$((n+1))
    case "$g" in X3:*|N/A:*) printf '| %d | %s | `%s` | `%s` | — | — | %s |\n' "$n" "$st" "$f" "$tok" "$g"; continue;; esac
    cnt=$(grep -a -c -F -- "$g" "$f" 2>&1)
    hit=$(grep -a -n -m1 -F -- "$g" "$f" 2>&1 | tr -cd '[:print:]' | cut -c1-160 | sed 's/|/\\|/g; s/`/'"'"'/g')
    if [ "$cnt" -ge 1 ] 2>/dev/null; then r="present ($cnt)"; else r="MISSING"; fi
    printf "| %d | %s | \`%s\` | \`%s\` | \`grep -a -c -F -- '%s' %s\` | %s | %s |\n" "$n" "$st" "$f" "$tok" "$g" "$f" "$hit" "$r"
  done < "$OUT/manifest"; } > "$OUT/table.md"
grep -c '| MISSING |' "$OUT/table.md"; grep -c '^| [0-9]' "$OUT/table.md"   # quote both
```

### Step 6: prove the full message-key paths (mechanical)
First get the key list from the extraction, not by hand:
`awk -F'\t' '$2=="SYM" && $3 ~ /^messages\//{print $4}' /tmp/us032/tokens.tsv | sort -u`. I expect
four keys: `Health.dbTimeout`, `Admin.fields.units.EUR`, `EtfDetail.extractionUnavailable` and
`Admin.operations.outcome.not_attempted`. Then run:
```bash
for f in messages/en.json messages/ro.json; do for k in <keys from the command above>; do
  node -e 'const [f,k]=process.argv.slice(1);const v=k.split(".").reduce((o,p)=>o==null?o:o[p],require(require("path").resolve(f)));console.log(f,k,typeof v)' "$f" "$k"
done; done
```
Every line must end in `string`. An `undefined` means either the key path differs from HANDOVER's
wording or the key regressed. Investigate, record exactly what you find, and restore the key if it
regressed (Task 2).

### Step 7: rewrite the implementer section of `US-032-tests.md`
Replace **only** the top section, everything above `## Round 1 — 2026-09-28`. That lower part is
the story-tester's verdict. Do not edit it, even its wrong "49 rows" line (AGENTS.md: never edit
another agent's verdict). The round-3 tester records the true count in its own new round.

The new top section contains, in order:
1. The method: the Step 1–6 commands verbatim, and the full manifest verbatim in a fenced block,
   so a reviewer can re-run everything.
2. The quoted outputs:
   - the odd-backtick guard (empty)
   - class counts
   - NOT-FOUND lines, each resolved as X3 or explained
   - both `comm` outputs (empty)
   - the `wc -l` counts
   - the MISSING count and the row count
   - the eight `node` lines
3. `/tmp/us032/table.md`, pasted verbatim, and below it the one labelled extra row for
   `app/health/failure-text.ts`.
4. A one-line conclusion **built only from quoted numbers**, e.g. "N rows, 0 MISSING, 0 unreconciled
   pairs, 0 unreconciled tokens". Write no "every" and no "all" unless a command output above
   proves it.

If a row is MISSING, follow Task 2: restore it from that story's plan and story file, list what was
restored, re-run that story's focused tests, and re-run Steps 5–6.

## What round 3 reviewer and tester check (their own evidence, DEC-015)
- **Reviewer:** re-runs Steps 1, 2 and 4 against HANDOVER.md, but with its **own** copy of the
  manifest taken from the pasted block. It confirms that both `comm` outputs are empty and that
  the class counts match. It re-runs Step 5 in full (it takes seconds) and diffs the result
  against the pasted table. It reads every `-`, `X3` and `N/A` line and judges whether the reason
  holds. It also re-derives the pair list itself from HANDOVER once, by reading, as a check on the
  extraction regex.
- **Tester:** re-runs Steps 5–6 and quotes the MISSING count, the row count and the node lines.
  AC1–AC3 and AC5 did not change. Re-run `app/health/page.failure.test.tsx` and quote it; the
  full four gates are optional, since no code changes this round.

## Expected size (from my reading of HANDOVER; the script's output wins)
- **In-scope (story, file) pairs:** about 50 in total: 17 for US-029, 22 for US-030 and 11 for
  US-031.
- **X3:** 2.
- **Manifest lines:** about 110–130, since most US-030 pairs carry several tokens.

If the script disagrees with these numbers, explain the difference in the header. Do not adjust
either side to make them match.

## Files touched this round
- `dev_minions/verification/US-032-tests.md`: implementer section only.
- `/tmp/us032/*`: scratch, not in the repo.

No application code, test code or HANDOVER "Files changed" entry changes, beyond keeping US-032's
existing line accurate.

## Risks
- **The extraction regex misses a path format**, for example a path with a space. Mitigation: the
  reviewer's independent read-through of the three sections, and the NOT-FOUND list.
- **HANDOVER.md is edited mid-round.** Only the US-032 sections are expected to change, and the
  section headings being matched are unique. Run Steps 1–4 once, after the last HANDOVER edit
  before the table is written.
- **Weak grep strings** such as `now` or `links` in files that contain those words for other
  reasons. This is accepted. AC4 asks whether each change survived, and every such file also
  carries a stronger, specific token for the same pair.

## Decisions needed
- **TECHNICAL, settled here, not blocking:** the scope of "non-test source or message file". It
  now means every path in the three sections except X1, X2 and X3, so fixtures, spike notes and
  docs are included. The alternative, excluding "prose/data" by judgment, is what let files drop
  out in rounds 1 and 2.

No PRODUCT items. Not blocked.
