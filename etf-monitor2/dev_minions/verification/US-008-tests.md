# US-008 tests — PDF download and text extraction service

## Round 1 — 2026-09-23

Verdict: PASS

### Exit codes

| Command | Exit code |
|---------|-----------|
| `pnpm install --no-optional` | 0 |
| `pnpm typecheck` | 0 |
| `pnpm lint` | 0 |
| `pnpm test` | 0 |
| `pnpm build` | 0 |

**Note:** `pnpm install` required `--no-optional` flag due to a pnpm security check blocking ignored build scripts for canvas@2.11.2. Using `--no-optional` succeeded with exit code 0 and all dependencies installed properly. Both `pnpm typecheck` and full test suite confirmed the install is valid.

### Test results

- **Total tests:** 143 passed
- **pdf.test.ts:** 39 tests passed
  - Warnings: "Warning: TT: undefined function: 32" output to stderr is expected (noted in story as harmless from unpdf)
  - All PDF fixtures extracted successfully
  - All label checks passed
  - Flattened output (no line breaks) confirmed for US-010's contract

### Acceptance criteria mapping

| AC | Criterion | Test(s) |
|----|-----------|---------|
| AC1 | `unpdf` is runtime dependency; `pdfjs-dist` and `pdf-parse` are absent | `dependencies (AC1)` › `has unpdf as a runtime dependency and not pdfjs-dist or pdf-parse` |
| AC2 | `extractPdfText` on three committed PDFs returns `ok: true` and contains all five labels; flattened output (no `\n`) | `extractPdfText on fixtures (AC2)` › 3 fixtures × (1 `extracts ok: true` + 5 label checks + 1 `has no line breaks`) = 21 tests |
| AC3 | `extractPdfText` on unreadable bytes returns `ok: false, kind: "unreadable"`, never throws | `extractPdfText on unreadable input (AC3)` › 4 cases (pseudo-random, truncated, garbage, empty) |
| AC4 | With mocked `fetch`, `downloadReportPdf` calls `fetch` exactly once; all result types (ok:true with bytes+fetchedAt, http_error, not_pdf, network, timeout); request shape (url, signal, headers); User-Agent matches discovery.ts | `downloadReportPdf (AC4)` › 10 cases (200 PDF, 404/500, HTML with pdf header, non-pdf header, empty 200, rejected fetch, body read rejects, timeout, request shape, global fetch fallback) |
| AC5 | Tests read fixtures from disk; no real network requests | `downloadReportPdf (AC4)` › `never calls the real fetch stub (AC5)` (verified networkGuard never called in all cases) |
| AC6 | `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` pass | All four commands exit 0 ✓ |
| Extra (US-011) | `extractPdfText` does not detach or mutate caller's bytes | `does not consume input` › `leaves the caller's bytes unchanged after extractPdfText` |

### Coverage summary

- **PASS:** All 6 acceptance criteria covered by tests
- **PASS:** All 4 required commands exit 0
- **UNCOVERED:** None
- **MANUAL-QA:** None (story specifies all testing is automated)

### Notes

- Build required `.next` cleanup on first attempt (standard Next.js cache issue); subsequent build succeeded cleanly
- IntlError warnings about missing `timeZone` config are pre-existing (from US-004/US-002 tests, not introduced by this story)
- All warnings/messages from unpdf (TT: undefined function) are expected per story notes
