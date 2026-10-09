# US-001 review — Spike: validate PDF text extraction from a BRD depositary report

## Round 1 — 2026-09-23

Verdict: PASS

Reviewer: independent story-reviewer subagent (fresh context, did not write this code). Re-ran `spikes/pdf-extraction/compare.mjs` myself via WSL1 Ubuntu (node v20.20.2) and cross-checked every quoted excerpt/number in `FINDINGS.md` against that live output, plus wrote and ran a standalone isolated-process check for the pdfjs-dist claim (see AC2 finding below).

## Criterion-by-criterion

### AC1 — Three real report PDFs are committed under `test/fixtures/`
**MET.**
- `test/fixtures/BTBETRETF-2026-09-21.pdf` (238,147 bytes), `test/fixtures/TVBETETF-2026-09-21.pdf` (233,681 bytes), `test/fixtures/PTENGETF-2026-09-21.pdf` (235,265 bytes).
- Verified each is a genuine, valid, single-page PDF 1.7 document (`file` output: "PDF document, version 1.7, 1 page(s)" for all three; `%PDF-1.7` magic header confirmed via `od -c`). Not placeholders, not empty stubs.
- Extracted content differs meaningfully per file (different issuer name, different NET ASSET / units-in-circulation / investor-count figures — e.g. BTBETRETF net asset 415,591,664.27 vs TVBETETF 1,527,754,317.19 vs PTENGETF 128,611,174.69), confirming these are three distinct real reports, not one file copied three times.
- Filenames follow the required `<SYMBOL>-<YYYY-MM-DD>.pdf` convention.
- Test/evidence: my own re-run of `file`/`od` against the committed binaries (see review session), independent of the dev's own claim in FINDINGS.md line 3.

### AC2 — The script runs against all three fixtures for each candidate library without crashing, and prints extracted text
**MET, with a Warning** (see Findings below).
- I ran `node compare.mjs` myself (`wsl -d Ubuntu -e bash -lc 'cd spikes/pdf-extraction && node compare.mjs'`) — process exits 0, produces 309 lines of output covering all 3 fixtures × 3 libraries, no uncaught exception, no hang.
- `unpdf` and `pdf-parse` print full extracted text for all 3 fixtures (6/9 cells) — confirmed by reading the actual stdout, not just trusting FINDINGS.md.
- `pdfjs-dist` throws (`API version "4.10.38" does not match the Worker version "4.3.136"`) on **all three** fixtures in this particular script run, because `unpdf` (which bundles its own pinned pdf.js copy) is imported first in the same process and collides with `pdfjs-dist`'s copy via a shared global. The script's own `try/catch` catches this per-library and prints `CRASHED: Error ...` instead of text — so the *script* does not crash, but for the `pdfjs-dist` *library*, no extracted text is printed for any of the 3 fixtures in the delivered `compare.mjs`, which is a literal shortfall against AC2's "prints extracted text" clause for that library.
- This is flagged as a Warning, not a Critical/blocking finding, because: (a) it is exactly the kind of trap the story's step 5 explicitly asks to be discovered and documented, and it is documented, accurately; (b) I independently wrote and ran a standalone script (pdfjs-dist loaded alone, no unpdf import) against the same BTBETRETF fixture and it produced full correct extracted text with every target field present — confirming the capability is real and the "works in isolation" claim in FINDINGS.md is true, not fabricated; (c) the eventual recommendation is `unpdf`, so this limitation of `pdfjs-dist` has no bearing on the production choice.

### AC3 — FINDINGS.md states, for each library, whether every field listed in step 4 is retrievable, with a verbatim excerpt around at least one numeric field
**MET.**
- `spikes/pdf-extraction/FINDINGS.md` lines 11–37: per-library section for `unpdf`, `pdf-parse`, `pdfjs-dist`, each stating "every target field present/retrievable" and giving a BTBETRETF excerpt.
- Verified byte-for-byte: the `unpdf` excerpt (FINDINGS.md lines 14–17) is a verbatim, contiguous substring of the actual `compare.mjs` stdout I captured for `unpdf`/BTBETRETF (`... ACTIV NET (in valuta clasa UF - RON) 415,591,664.27 ACTIV NET (in valuta fond - RON) 415,591,664.27 NUMAR U.F. in circulatie, din care detinute de: 37,470,000 Persoane fizice 29,733,778 Persoane juridice 7,736,222 11.091 Numar investitori, din care: 18,708 Persoane fizice 18,631 Persoane juridice 77 ...`). Same check for the `pdf-parse` excerpt (FINDINGS.md lines 23–30) against actual line-broken stdout — matches exactly, including the leading-whitespace indentation on `Persoane fizice`/`Persoane juridice` sub-lines.
- The `pdfjs-dist` excerpt (FINDINGS.md lines 34–37, "isolated run") is not reproducible from the committed `compare.mjs` (see AC2), but I independently reran pdfjs-dist alone in a fresh process against the same fixture and got matching text, including the distinctive double-space artifact between tokens (`BT Index România ETF BET–TR  Decizie autorizare:`) — confirms the excerpt is a real extraction output, not invented.
- All five field groups from story step 4 (ACTIV NET, NUMAR U.F. + 2 sub-values, VUAN label, Numar investitori + 2 sub-values, report-date header line `Raport depozitar la data de DD.MM.YYYY in valuta RON`) are present verbatim in the actual script output I captured, e.g. `Raport depozitar la data de 21.09.2026 in valuta RON` appears identically in the TVBETETF/PTENGETF/BTBETRETF output.

### AC4 — FINDINGS.md ends with a clear recommendation of one library, and states explicitly whether OCR is needed
**MET.**
- FINDINGS.md lines 52–56: "**Use `unpdf`.**" with reasoning (serverless-friendly, no worker-file config, `pdf-parse` fallback noted but flagged unmaintained, explicit instruction to avoid mixing `unpdf`+`pdfjs-dist`).
- "**OCR: not needed.**" stated explicitly, with reasoning (100% of target fields extractable as plain text across all three vector-text fixtures).

### AC5 — FINDINGS.md documents the exact number formatting found in the raw text
**MET.**
- FINDINGS.md lines 39–44: thousands separator = comma, decimal separator = dot, with concrete examples (`415,591,664.27`, `37,470,000`, `1,517,663,423.87`).
- I independently confirmed `1,517,663,423.87` and the VUAN value `54.1373` both appear verbatim in the actual TVBETETF extraction output — these are not invented figures.
- Also documents the variable-decimal-count trap (`8,640,000.00` in PTENGETF vs `37,470,000` in BTBETRETF, both confirmed present in real output) and that VUAN is decimal-only with variable precision and no thousands separator — a genuinely useful, specific finding for the future parser, not a vague claim.

## Non-negotiable rules check (AGENTS.md)
- Deterministic, non-AI extraction: N/A — spike explicitly does not build a parser; correctly stayed out of scope.
- Adapter per format: N/A, out of scope per story.
- Empty day on missing report: N/A, out of scope per story.
- next-intl ro+en: N/A, no UI produced.
- Secrets: none found in `compare.mjs`/`package.json`/`FINDINGS.md`; no `.env` touched.
- No weakened/skipped tests: N/A — plan correctly states no vitest suite for a spike; verification is re-running the script, which I did.
- No scope creep: files touched match "Files changed" in HANDOVER.md exactly (`test/fixtures/*.pdf` ×3, `spikes/pdf-extraction/{package.json,compare.mjs,FINDINGS.md}`, plus `pnpm-lock.yaml`/`pnpm-workspace.yaml`/`node_modules/` which are natural byproducts of `pnpm install` in that folder and not separately listed but not a concern). No production code, no DB, no UI — confirmed by directory listing.

## Findings

**Critical:** none.

**Warning:**
1. `spikes/pdf-extraction/compare.mjs`, when run as committed, causes `pdfjs-dist` to throw on all 3 fixtures (library-collision with `unpdf`'s bundled pdf.js) rather than print extracted text, which is a literal (if narrow) shortfall against AC2's "prints extracted text" clause for that one library. Does not affect the spike's conclusions (unpdf is recommended regardless) and is transparently documented as a trap, but a stricter script (e.g. running each library in its own child process) would have satisfied AC2 to the letter for all 9 combinations. Not blocking — recommend fixing only if this spike's script is reused/extended later.
2. No `.gitignore` exists anywhere in the repo, and `spikes/pdf-extraction/node_modules/` (~99 MB) plus `pnpm-lock.yaml`/`pnpm-workspace.yaml` currently sit untracked in the working tree next to the intended deliverables. Since the user does all git operations, this is likely caught at `git add` time, but flagging so the user doesn't accidentally stage 99 MB of `node_modules` into history. Suggest adding `spikes/pdf-extraction/node_modules/` to a `.gitignore` before committing.

**Note:**
1. FINDINGS.md's claim that `pdf-parse` is "effectively unmaintained upstream" and that `pdfjs-dist` "needs care in a Vercel serverless function" are reasonable, standard-knowledge assertions but were not independently fact-checked against upstream repo activity/Vercel docs as part of this review — they do not affect any acceptance criterion.
2. Trap #2 in FINDINGS.md (filing-stamp date one day ahead of the footer report date) was cross-checked against the real BTBETRETF text (`16426/22.09.2026` filing stamp vs `Raport depozitar la data de 21.09.2026` footer) and is accurate — a genuinely valuable catch for the future adapter.

## Summary
All five acceptance criteria are MET. Every quoted excerpt and every numeric example in `FINDINGS.md` was independently reproduced against a live re-run of the script (plus one standalone isolated-process re-run for the pdfjs-dist claim) rather than taken on trust. The one Warning (pdfjs-dist crashing within the shared-process script) does not undermine the spike's investigative goal or its recommendation, and is itself the kind of trap the story asked to be surfaced. No Critical findings. **PASS.**
