## QA run 1 — 2026-09-24 16:18

Verdict: PASS
Machine checks: 6/6   Left for the user: 0

| # | Check (source) | Type | Result | Evidence |
|---|---|---|---|---|
| 1 | `unpdf` is a runtime dependency; `pdfjs-dist` and `pdf-parse` are absent (AC1) | AUTO | PASS | `lib/extraction/pdf.test.ts` dependency check passed. |
| 2 | All three committed PDFs extract the five required labels with flattened text (AC2) | AUTO | PASS | Focused `pnpm exec vitest run lib/extraction/pdf.test.ts --reporter=dot` passed 39/39. |
| 3 | Random, truncated, garbage and empty inputs return `unreadable` without throwing (AC3) | AUTO | PASS | Focused PDF test passed 39/39, including all four unreadable-input cases. |
| 4 | Mocked download makes one request and classifies success, HTTP, non-PDF, network and timeout cases (AC4) | AUTO | PASS | Focused PDF test passed 39/39, including mocked download cases and one-call assertions. |
| 5 | Extraction tests use fixtures and no real network request (AC5) | AUTO | PASS | Focused PDF test passed 39/39 with its guarded global `fetch`. |
| 6 | Typecheck, lint and production build succeed without `DATABASE_URL` (AC6) | AUTO | PASS | `pnpm typecheck` exit 0; `pnpm lint` exit 0 (one known unused test-parameter warning); `pnpm build` exit 0. |

### For the user (only what a machine couldn't settle)

- None. The story has no MANUAL-QA item; its live BVB download check is covered by US-011.

