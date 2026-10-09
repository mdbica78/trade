# US-001 plan — PDF extraction spike

Not a complex story (spike, no DB/adapter/AI/cron/auth, 5 ACs) — planned directly, not delegated.

## Criteria → work
- AC1 → download 3 real PDFs from bvb.ro (BTBETRETF, TVBETETF, PTENGETF "Știri" report links) into `test/fixtures/<SYMBOL>-<YYYY-MM-DD>.pdf`.
- AC2 → `spikes/pdf-extraction/package.json` (unpdf, pdf-parse, pdfjs-dist deps) + `compare.mjs` that loads each fixture with each library and prints extracted text; must exit 0 for all 9 combinations.
- AC3/AC4/AC5 → `spikes/pdf-extraction/FINDINGS.md`, written from the script's actual output: per-library per-field retrievability with a verbatim excerpt, final recommendation + OCR yes/no, and the exact separator convention observed.

## Environment note
This Windows machine has no Node.js. Run all node/pnpm commands via WSL1 "Ubuntu" (node v20.20.2, pnpm 12.5.1), which mounts the repo at the same path under `/mnt/c/...`. User confirmed this route over installing Node on Windows.

## Files to touch
- `test/fixtures/BTBETRETF-*.pdf`, `test/fixtures/TVBETETF-*.pdf`, `test/fixtures/PTENGETF-*.pdf` (new)
- `spikes/pdf-extraction/package.json`, `spikes/pdf-extraction/compare.mjs` (new)
- `spikes/pdf-extraction/FINDINGS.md` (new)

## No test suite for a spike
Verification = the script actually runs (AC2) and the findings file is checked against its raw output (AC3-5) — story-tester runs the script itself rather than a vitest suite.
