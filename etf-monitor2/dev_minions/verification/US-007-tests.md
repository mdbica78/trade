# US-007 — Test verdict (Round 1)

**Verdict: PASS**

Test suite run: 2026-09-23 22:38–22:43, story-tester (Haiku 4.5).

---

## Test results

| Command | Exit code | Tests |
|---------|-----------|-------|
| `pnpm install` | 0 | — |
| `pnpm typecheck` | 0 | — |
| `pnpm lint` | 0 | — |
| `pnpm test` | 0 | 104 passed, 16 files |
| `pnpm build` | 0 | compiled successfully |

No failures, no flakes.

---

## Acceptance criteria — test coverage

| AC | Criterion (from US-007.md) | Test coverage | Status |
|---|---|---|---|
| AC1 | Fixture files (BTBETRETF, TVBETETF, PTENGETF) committed under `test/fixtures/bvb/` + README documents request, list structure, depositary-report rule, expected URLs | `discovery.test.ts` › "fixtures (AC1)" › "has exactly one non-empty committed fixture for {symbol}" (3 cases) | MET |
| AC2 | For each fixture, `findLatestReportLink` returns the README's expected absolute URL | `discovery.test.ts` › "real fixtures (AC2)" › "findLatestReportLink returns the README's expected URL for {symbol}" (3 cases) | MET |
| AC3 | Several depositary reports out of chronological order → the most recent is returned. Non-report news entries never returned | `discovery.test.ts` › "ordering and filtering (AC3)": "returns the most recent of several reports…" (1); "ignores a non-report entry…" (1); "returns null when every entry is non-report news…" (1); "breaks a publishedAt tie by document order…" (1); "prefers a dated report over an undated one…" (1); "within a catch-up row sharing one title/date, the later link in the row wins…" (1) | MET |
| AC4 | No depositary-report entry → parser returns `null`, `discoverLatestReport` returns `not_found`, no URL guessed | `discovery.test.ts` › "no report (AC4)": "findLatestReportLink is null when a real fixture's list is emptied" (1); "discoverLatestReport gives not_found with no pdfUrl when served by a mocked fetch" (1); "gives list_not_found when the list container itself is missing" (1) | MET |
| AC5 | Relative hrefs resolved to absolute URLs against page URL; absolute hrefs pass through unchanged | `discovery.test.ts` › "href resolution (AC5)": "resolves relative hrefs against pageUrl and passes absolute ones through" (1); "decodes &amp; in a href before resolving it" (1); "never treats a javascript: or # href as a candidate" (1) | MET |
| AC6 | With mocked `fetch`: 2xx → `found`; non-2xx → `error`/`http_error` + status; rejection → `error`/`network`; timeout → `error`/`timeout`. Never throws, calls `fetch` exactly once. | `discovery.test.ts` › "discoverLatestReport (AC6)": "gives found on a 2xx response" (1); "gives error/http_error with httpStatus on 404" (1); "gives error/http_error with httpStatus on 500" (1); "gives error/network on a rejected fetch promise" (1); "gives error/network on a synchronous throw from fetchImpl" (1); "gives error/timeout when slower than timeoutMs (fetch ignores the signal)" (1); "gives error/timeout when fetch rejects with AbortError on abort" (1); "gives error/network when the body read rejects" (1); "passes BVB_REQUEST_HEADERS and a signal to fetchImpl" (1). Plus `http.test.ts` › "fetchOnce" (11 tests covering 2xx, redirects, non-2xx, rejection, sync throw, timeout (2 ways), body-read failure, headers + signal, default fetch). | MET |
| AC7 | No test performs a real network request; `fetch` always injected or mocked | `discovery.test.ts` › "no live network access (AC7)": "every mocked test above never calls the real fetch stub" (1); "discoverLatestReport without an explicit fetchImpl reads globalThis.fetch at call time (the stub intercepts it)" (1) | MET |
| AC8 | `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` pass | All 4 commands exited 0; `pnpm test` ran 104 tests across 16 files with no failures | MET |
| MANUAL-QA | Live discovery against bvb.ro (deferred to US-011 AC7: `pnpm report:latest <SYMBOL>`). Interim: open each seed `bvbUrl` → "Știri" tab → confirm newest depositary report's link matches README's expected URL. | Deferred to US-011; marked MANUAL-QA in story | MANUAL-QA |

---

## Test environment

- Platform: Linux (WSL1)
- Node: v20.20.2
- pnpm: v12.5.1
- NODE_EXTRA_CA_CERTS exported per DEC-002/DEC-008

---

## Files created/modified for testing

- `lib/extraction/discovery.ts` — parser + fetcher (exported functions: `findLatestReportLink`, `discoverLatestReport`, `parseReportList`, `isDepositaryReportEntry`, constants: `BVB_REQUEST_HEADERS`, `DEFAULT_DISCOVERY_TIMEOUT_MS`)
- `lib/extraction/http.ts` — shared single-attempt fetch wrapper (`fetchOnce<T>`)
- `lib/extraction/html.ts` — tiny pure helpers (`decodeEntities`, `stripTags`, `collapseWhitespace`, `foldForMatch`)
- `lib/extraction/discovery.test.ts` — 29 tests
- `lib/extraction/http.test.ts` — 11 tests
- `lib/extraction/html.test.ts` — 8 tests
- `test/fixtures/bvb/BTBETRETF-instrument-2026-09-23.html` — captured fixture
- `test/fixtures/bvb/TVBETETF-instrument-2026-09-23.html` — captured fixture
- `test/fixtures/bvb/PTENGETF-instrument-2026-09-23.html` — captured fixture
- `test/fixtures/bvb/README.md` — documented request, structure, rule, expected URLs

---

## Summary

All 8 acceptance criteria + MANUAL-QA status verified. No new dependencies added (regex + built-in helpers only; `html.ts` uses no external library). All 104 tests pass (discovery + http + html test suites); typecheck, lint, and build also pass. Fixtures captured with exact request headers; README documents the page structure, the depositary-report identifying rule (VAN title folded match), date format (D.MM.YYYY H:mm:ss), and expected newest-report URL per fixture, read by hand from the raw HTML before the parser existed (reviewer check per story Notes). Story-tester confirms no real network calls were made.
