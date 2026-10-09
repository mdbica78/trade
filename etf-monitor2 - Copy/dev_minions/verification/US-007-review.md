# US-007 review — Report discovery: find the latest report link on a BVB instrument page

## Round 1 — 2026-09-23

Reviewer: `story-reviewer` subagent (independent context, did not write this code).

VERDICT: PASS

Local checks run (all green): `pnpm typecheck`, `pnpm lint`, `pnpm test` (16 test files, 104
passed, incl. 29 in `discovery.test.ts`, 11 in `http.test.ts`, 8 in `html.test.ts` — 48 tests for
this story, matching HANDOVER.md's count), `pnpm build`.

Files reviewed (everything under HANDOVER.md's "Files changed" for US-007), full read:
- `test/fixtures/bvb/BTBETRETF-instrument-2026-09-23.html`, `TVBETETF-instrument-2026-09-23.html`,
  `PTENGETF-instrument-2026-09-23.html`
- `test/fixtures/bvb/README.md`
- `lib/extraction/http.ts`, `lib/extraction/html.ts`, `lib/extraction/discovery.ts`
- `lib/extraction/http.test.ts`, `lib/extraction/html.test.ts`, `lib/extraction/discovery.test.ts`
- `lib/extraction/.gitkeep` (deletion confirmed — folder now holds only real files)

Scope check: `grep -rln "discoverLatestReport|findLatestReportLink|parseReportList|fetchOnce|BVB_REQUEST_HEADERS"`
outside `lib/extraction/` returns nothing — no page, route or cron wiring, as the story's "Out of
scope" requires (persistence/cron is Sprint 3). No new runtime dependency was added
(`package.json` unchanged) — the plan's R2 "regex over an isolated fragment" escape hatch was
used as recommended, not `node-html-parser`. No UI/i18n strings, no secrets, no `.env*` touched.

### Acceptance criteria

- **AC1 — MET.** Three fixtures committed under `test/fixtures/bvb/` (`BTBETRETF-`, `TVBETETF-`,
  `PTENGETF-instrument-2026-09-23.html`), non-empty (71–72 KB each, confirmed the news table and
  rows are present by hand: `test/fixtures/bvb/BTBETRETF-instrument-2026-09-23.html:760-776`).
  `test/fixtures/bvb/README.md` documents the request (§1: URL/method/headers/capture command),
  the list structure (§2: `<table id="gv5News">` container, one `<tr>` per entry, the "catch-up
  row" multi-link case), the identifying rule (§3: folded title `startswith("van la data")`), the
  date format (§4), href shape (§5), and the expected newest-report URL per fixture (§7). Proven
  by `discovery.test.ts` › "fixtures (AC1)" (existence via `readdirSync`, one match per symbol).
- **AC2 — MET.** `discovery.test.ts` › "real fixtures (AC2)" reads each committed fixture and
  asserts `findLatestReportLink` returns the exact literal from README §7 for all three symbols,
  plus `title` non-empty, `publishedAt` matching, and `https:` protocol. I independently re-parsed
  the first `<tr>` of the BTBETRETF fixture by hand (`sed -n '767p'`) and confirmed its single
  `<a href>` and `<p class="date">` match both the README table and the test literal — the
  reviewer check the story asks for ("expected URLs read off the fixture by hand, not copied from
  the parser's output") holds up on inspection: the README's method (§7, "first `<tr>` is newest,
  BVB lists most recent first") is a manual, hand-describable procedure, independently verifiable
  against the raw HTML, not circular with the parser.
- **AC3 — MET.** `discovery.test.ts` › "ordering and filtering (AC3)": six cases cover out-of-order
  chronological entries (D-2/D/D-1 → D wins), a non-report entry with its own PDF link placed
  first (still rejected), an all-non-report page (→ null), a `publishedAt` tie broken by document
  order, a dated-vs-undated report (dated wins), and the same-row "catch-up" multi-link tie
  (later link in the row wins, matching README §2's documented convention). All six use
  `buildPage`, templated from the real row markup (README §2's snippet), not invented HTML.
- **AC4 — MET.** `discovery.test.ts` › "no report (AC4)": (1) a real fixture with its `<tbody>`
  emptied by string surgery → `findLatestReportLink` → `null`; (2) the same via a mocked
  `discoverLatestReport` → `{status:"not_found"}` with `expect(result).not.toHaveProperty("pdfUrl")`;
  (3) an unrelated page with no `gv5News` table → `parseReportList().listFound === false` and
  `findLatestReportLink` → `null`. `grep -n '\.pdf\`|\.pdf"' lib/extraction/discovery.ts` shows the
  only `.pdf` reference is `resolved.pathname.toLowerCase().endsWith(".pdf")` — no template literal
  builds a URL from `symbol`/date anywhere in the file; the parser only ever returns an href the
  page itself printed.
- **AC5 — MET.** `discovery.test.ts` › "href resolution (AC5)": relative (`/x.pdf`, `x.pdf`,
  `../x.pdf`, `//bvb.ro/x.pdf`) and absolute (`https://other.example/x.pdf`) hrefs all resolve as
  expected against `pageUrl` via `resolvePdfHref` (`discovery.ts:184-203`, uses `new URL(href,
  pageUrl)`); `&amp;` is decoded before resolution (`?a=1&amp;b=2` → `?a=1&b=2`); `javascript:` and
  `#` hrefs are rejected (never candidates, protocol check at `discovery.ts:196`).
- **AC6 — MET.** `discovery.test.ts` › "discoverLatestReport (AC6)" covers all four required
  branches (2xx → found; 404/500 → `http_error` + `httpStatus`; rejected promise → `network`;
  synchronous throw → `network`; slow response with fake timers → `timeout`; `AbortError` on
  abort → `timeout`; body-read rejection → `network`) plus the headers/signal assertion. Every
  case asserts `fetchImpl` was called exactly once. `lib/extraction/http.ts` implements the shared
  "one attempt, never throws" semantics with `Promise.race` against a timer that covers the body
  read too, matching the plan's `fetchOnce` design; `http.test.ts` unit-tests the same
  classification independently (11 tests) so US-008 can reuse it.
- **AC7 — MET.** Both `discovery.test.ts` and `http.test.ts` stub `globalThis.fetch` with a guard
  that throws if called, in `beforeEach`/`afterEach` (`vi.stubGlobal`/`vi.unstubAllGlobals`), and
  assert the guard was never invoked. `grep -rn "fetch(" lib/extraction/*.test.ts` returns nothing
  — no test literally calls `fetch(`; all real network entry points go through the injected
  `fetchImpl`.
- **AC8 — MET.** Ran all four locally: `pnpm typecheck` (clean), `pnpm lint` (clean), `pnpm test`
  (16 files / 104 tests passed, 0 failed), `pnpm build` (webpack build succeeded, routes
  unchanged: `/`, `/_not-found`, `/health` — this story adds no route, as expected).

### Findings (ordered by severity)

No Critical or Warning findings.

1. (Note) `test/fixtures/bvb/README.md:39-41` — the "Size" column (71255/70842/71374 bytes) is
   consistently 9 bytes smaller than each committed file's actual size on disk (71264/70851/71383,
   confirmed via `ls -la`). This is very likely `console.log(..., text.length)` (JS UTF-16 code
   units) being reported as if it were the byte count, while `writeFileSync(..., "utf8")` encodes
   non-ASCII characters (e.g. `ș`/`â`/`î` in the PDF titles) as 2 bytes each — 9 such characters
   would exactly produce this delta on all three files, which is consistent with what's in the
   fixtures. I independently confirmed the row content in the `.html` files matches README §7 and
   the test literals, so this looks like a units mislabel in the capture log, not a stale/mismatched
   recapture. Doesn't affect any acceptance criterion — flagging only so it isn't mistaken later
   for evidence of drift between the README and the committed fixtures.
2. (Note) `discovery.ts:171,176` — `discoverLatestReport` parses the fetched HTML twice
   (`parseReportList` directly for the `listFound` check, then again inside `findLatestReportLink`).
   Harmless (one HTTP call either way, small HTML), just a minor duplication worth folding together
   if this function is touched again.
3. (Note) The `list_not_found` branch of `discoverLatestReport` itself (as opposed to
   `parseReportList` directly) isn't exercised through a mocked-`fetch` call in
   `discovery.test.ts` — it's covered at the `parseReportList`/`findLatestReportLink` level only
   (`describe("no report (AC4)")`, test 3). The code path is a one-line conditional
   (`discovery.ts:172-174`) so the risk is low, but a full round-trip test would close the loop.
4. (Note, story Notes item) README §3 states no fixture actually contains a non-report entry to
   quote as a real counter-example (all three "Top 5 news" widgets only show VAN filings on
   capture day) and instead points to the synthetic counter-example in `discovery.test.ts`. This is
   an honest, documented deviation from the plan's §2 wish-list item ("at least one non-report
   entry from the fixtures quoted as a counter-example") that reflects what the live page actually
   contained, not something invented — acceptable, not a defect.

### Scope deviations

None. Everything built is inside the story's Task list and file boundaries (plan §2); nothing in
`app/*`, `messages/*`, `lib/db/*`, `package.json`, `vitest.config.ts` was touched, matching the
plan's "Not touched" list.

### Not independently verifiable here

- MANUAL-QA (deferred to US-011's QA, per the story): live discovery against bvb.ro, and the
  interim browser check that the fixtures' README §7 URLs are still the newest listed report.
  Not checked as part of this review — correctly deferred, not an AC of this story.
