# US-007 plan — Report discovery: find the latest report link on a BVB instrument page

Planned by story-planner (opus), 2026-09-23. Complex story (8 ACs, a live-page investigation,
the first network-facing module).

Not blocked: no decision is needed to start. Section 5 lists **contingent** decisions. Each one
only comes up if the Phase A investigation lands on a specific branch. If that happens, the
implementer stops at that point and raises the DEC named there. It does not guess.

Sources read: story US-007, sprint-02.md, SPRINT-02-review.md, US-008 and US-011 (downstream
consumers), requirements (FR3, FR4.1, FR7, FR13, section 3), `architecture/data-model.md`
(`etfs.bvb_url`, `reports.source_url`, `reports.report_date`), ADR-001, DEC-002, DEC-008,
`spikes/pdf-extraction/FINDINGS.md`, `lib/db/seed-data.ts`, `lib/health.ts` (house style for
"never throws" result unions), `package.json`, `vitest.config.ts`, `roles/test-runner.md`.

Environment facts that affect this story:
- WSL1 "Ubuntu". Every non-interactive shell exports
  `NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt` first (DEC-002, DEC-008). The machine
  sits behind Zscaler, so a certificate error from Node means that variable is missing. It does
  not mean bvb.ro is down.
- The planner (this context) has no network tool and has **not** seen the live page. Everything
  below about the page's structure is a hypothesis for Phase A to confirm or refute.
- `lib/extraction/` holds only `.gitkeep`. No module exists yet. US-008 (same sprint) needs the
  same "one attempt, timeout, classify error" fetch semantics for PDFs, so the fetch helper is
  shared (section 2).

---

## 0. Work order

**Phase A — investigate and capture (before writing any parser code).**

1. Pick the request headers first and put them in code: `BVB_REQUEST_HEADERS` in
   `lib/extraction/discovery.ts`, see section 2. Starting values:
   - `Accept: text/html,application/xhtml+xml`
   - `Accept-Language: ro-RO,ro;q=0.9,en;q=0.5` (pins the Romanian page, so the titles the rule
     matches are stable)
   - `User-Agent: etf-monitor2/0.1 (daily ETF report monitor)`

   If bvb.ro answers that User-Agent with 403, a bot challenge or a different page, see
   contingent decision C3. Do not change it silently.
2. Capture each of BTBETRETF, TVBETETF and PTENGETF (URLs from `seedEtfs`) **through Node
   `fetch` with exactly those headers**, and write `await res.text()` to
   `test/fixtures/bvb/<SYMBOL>-instrument-<YYYY-MM-DD>.html`. Use a one-off
   `pnpm exec tsx -e '…'` command that imports the constants by relative path. Record the exact
   command in the README. This way the fixture is byte-for-byte what the parser will receive. A
   browser "Save page as" is not acceptable (story Notes). Also record `res.status`, `res.url`
   (the final URL after redirects), `content-type` (charset) and the response size.
3. If the network call is denied or bvb.ro is unreachable: do **not** retry. Record it under
   "Waiting on the user" in HANDOVER.md, set the story to Blocked, and point to sprint-02.md manual
   QA step 4 (the user captures the pages with curl). Then continue with other stories. If the
   user captures with curl, the README says so and gives the curl command. curl's body equals
   `fetch`'s decoded text when there is no `--compressed` mismatch; the README notes any
   difference.
4. Inspect the captured HTML (read it and grep it; no parser yet). Decide which branch applies:
   - **Branch A: the report links are in the GET response.** The expected case per requirements
     section 3 ("direct and predictable PDF link"). Continue.
   - **Branch B: the Știri list is not in the GET response.** For example, the tab loads through
     an ASP.NET `__doPostBack` (look for `__VIEWSTATE`, `__EVENTVALIDATION` and a tab link whose
     href is `javascript:__doPostBack('…','…')`), or through an XHR/JSON endpoint called from
     inline script.
     - First look for a **single** plain request that returns the list: a GET URL or query
       parameter that selects the tab, or a separate news-list endpoint referenced in the page.
       If one exists, that request *is* the discovery request. Capture its response as the
       fixture and continue as Branch A.
     - If the only way is GET page → read hidden fields → POST postback (two requests), or list →
       news-item page → PDF (two requests), stop. That triggers contingent decision C1.
   - **Branch C: the list only exists after the page's JavaScript runs** (client-rendered, or a JS
     challenge such as a Cloudflare interstitial). Stop, write a `TECHNICAL` DEC per the story
     (headless browser = framework-level dependency, AGENTS.md), and block the story.
5. Write `test/fixtures/bvb/README.md` (section 2 lists its required content), including the
   **expected newest-report URL per fixture, read off the fixture by hand**: find the entries
   in the raw HTML, compare their dates, copy the href, and resolve it by hand. Do this *before*
   the parser exists, so the expected values cannot be copied from its output (story Notes,
   reviewer check).

**Phase B — implement** (section 2) against the documented structure.

**Phase C — tests** (section 1), then `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

---

## 1. Acceptance criteria → proving test

Test files: `lib/extraction/discovery.test.ts` (parser + fetcher) and `lib/extraction/http.test.ts`
(shared single-attempt fetch). Expected URLs in the tests are string literals copied from the
README table. Each has a comment pointing to the README row.

| AC | Criterion (restated) | Proof |
|---|---|---|
| AC1 | The response behind each of BTBETRETF, TVBETETF and PTENGETF is committed under `test/fixtures/bvb/`. The README documents the request, the list structure, the depositary-report rule and the expected newest URL per fixture. | (a) `discovery.test.ts` › "fixtures": for each of the three symbols, exactly one file matches `test/fixtures/bvb/<SYMBOL>-instrument-*.html` and it is non-empty. The test reads the directory, so a missing fixture fails. (b) The README content is a **reviewer check** against the list in section 2: request, where the links are, the identifying rule, the date format, relative/absolute hrefs, the expected URL per fixture, the capture command, and fetch vs browser differences. |
| AC2 | For each fixture, `findLatestReportLink(html, pageUrl)` returns the README's expected absolute URL. | `discovery.test.ts` › "real fixtures" (3 cases). Read the fixture with `fs.readFileSync(…, "utf8")`. `pageUrl` = the final URL recorded at capture (the README's `res.url`, else the seed `bvbUrl`). Assert `pdfUrl` strictly equals the README literal and `title` is non-empty. If the page shows dates, assert `publishedAt` equals the README's value for that entry. Also assert `new URL(pdfUrl).protocol === "https:"`. Reviewer: compare each literal with the fixture by hand (story Notes). |
| AC3 | Several depositary reports out of chronological order → the most recent is returned. Non-report news is never returned. | `discovery.test.ts` › "ordering and filtering", on synthetic pages built by a `buildPage(entries)` helper in the test file. The helper uses the **same markup as the real list**: one entry block copied from a fixture and templated. It is not invented HTML, so the synthetic tests exercise the real selectors. Cases: (1) three reports dated D-2, D, D-1, in that document order → the D entry. (2) The same, plus a non-report news entry dated D+1 that has its own PDF link, placed first → still the D report. This proves the filter is applied before the ordering. (3) A page with only non-report news entries, including PDF links → `null`. (4) Tie on `publishedAt` → the first in document order (section 4, R4). (5) Mixed dated and undated report entries → the newest dated one wins over any undated one. |
| AC4 | No depositary-report entry → the parser returns `null` and `discoverLatestReport` returns `not_found`. No URL is guessed or constructed. | `discovery.test.ts` › "no report": (1) A real fixture with the list container emptied (string surgery on the fixture in the test, done so it fails loudly if the marker is not found) → `findLatestReportLink` gives `null`. (2) The same HTML served by a mocked `fetch` → `discoverLatestReport` gives `{ status: "not_found", … }` with no `pdfUrl` key (`expect(result).not.toHaveProperty("pdfUrl")`). (3) A page where the list container itself is missing (for example an unrelated HTML page) → `null` / `not_found` with `reason: "list_not_found"` (section 2, the additive diagnostic field). Reviewer: grep `discovery.ts` for any URL construction from the symbol or the date (no template literal builds a `.pdf` path). |
| AC5 | Relative hrefs are resolved against the page URL. Absolute hrefs pass through unchanged. | `discovery.test.ts` › "href resolution", using `buildPage` entries with hrefs `/infocont/x.pdf`, `x.pdf`, `../x.pdf`, `//bvb.ro/x.pdf` and `https://other.example/x.pdf`, with `pageUrl` = the seed URL. Assert the exact expected strings; the absolute one is `===` the input. Plus: an href containing `&amp;` is entity-decoded **before** resolution (`?a=1&amp;b=2` → `?a=1&b=2`). An href `javascript:__doPostBack(…)` or `#` is not a candidate, because only `http:`/`https:` results are accepted. |
| AC6 | With a mocked `fetch`, `discoverLatestReport` gives: 2xx + fixture → `found`; non-2xx → `error`/`http_error` + `httpStatus`; rejection → `error`/`network`; slower than `timeoutMs` → `error`/`timeout`. It never throws and calls `fetch` exactly once in every case. | `discovery.test.ts` › "discoverLatestReport". `fetchImpl = vi.fn(...)`. Every case asserts `expect(fetchImpl).toHaveBeenCalledTimes(1)` and awaits the promise, which must resolve (a rejection fails the test). Cases: (1) `new Response(fixtureHtml, { status: 200 })` → `found` with the AC2 URL. (2) 404 and 500 → `http_error`, `httpStatus` 404/500. (3) `Promise.reject(new TypeError("fetch failed"))` → `network`, with a message containing the cause. (4) `fetchImpl` throws **synchronously** → `network`. (5) Timeout with `vi.useFakeTimers()`, `timeoutMs: 1000`: the mock returns a promise that never settles and ignores the signal. Advance 1000 ms and expect `timeout`. This proves the timeout does not depend on `fetch` honouring abort. (6) Timeout with a mock that rejects with an `AbortError` when `init.signal` aborts → `timeout`, not `network`. (7) A body read that rejects (`Response` whose `text()` throws) → `network`. (8) The call passes `BVB_REQUEST_HEADERS` and a `signal` in `init` (asserted on `fetchImpl.mock.calls[0][1]`). This ties production requests to the fixture-capture headers. The same classification is also unit-tested once in `http.test.ts` so US-008 inherits it. |
| AC7 | No test performs a real network request. | (1) In `discovery.test.ts` and `http.test.ts`: `beforeEach(() => vi.stubGlobal("fetch", guard))`, where `guard` is a `vi.fn` that throws "network disabled in tests". `afterEach`: `vi.unstubAllGlobals()`. Every test that injects `fetchImpl` also asserts `guard` was not called. (2) One test calls `discoverLatestReport(etf)` **without** `fetchImpl` while the global stub returns the fixture. It must give `found`, which proves the default is `globalThis.fetch` read **at call time**, not captured at import, so the stub really intercepts it. (3) Reviewer: `grep -rn "fetch(" lib/**/*.test.ts` shows only mocks. |
| AC8 | `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` pass. | story-tester runs all four (with `NODE_EXTRA_CA_CERTS` exported). The module is not imported by any page yet, so `build` only proves nothing else broke. |
| MANUAL-QA | Live discovery against bvb.ro. | Deferred to US-011 AC7 (`pnpm report:latest <SYMBOL>`), as the story says. The US-007 QA checklist also lists the interim browser check: open each seed `bvbUrl` → "Știri" tab → confirm the newest depositary report's link equals the README's expected URL **for the fixture's capture date**. If newer reports have appeared since, confirm the fixture's entry is still listed with the same date. |

---

## 2. Files and boundaries

| File | New/changed | Contents / boundary |
|---|---|---|
| `lib/extraction/http.ts` | new | `fetchOnce<T>(url, read: (res: Response) => Promise<T>, opts: { fetchImpl?: typeof fetch; timeoutMs: number; headers?: Record<string,string> })` returns `Promise<{ ok: true; value: T; status: number; finalUrl: string } \| { ok: false; kind: "http_error" \| "network" \| "timeout"; message: string; httpStatus?: number }>`. One attempt, never throws. `AbortController` + `setTimeout`, and `Promise.race` against a timer promise so a mock that ignores the signal still times out. The timer covers the **body read** too (`read(res)` inside the race) and is cleared in `finally`. Non-2xx → `http_error`, without calling `read` (call `res.body?.cancel()` best-effort, ignore failures). An abort caused by our own timer → `timeout`. Any other rejection or a synchronous throw → `network`. `fetchImpl` defaults to `globalThis.fetch`, resolved inside the call. `finalUrl = res.url \|\| url` (a mocked `Response.url` is `""`). No knowledge of BVB, HTML or PDF. US-008 may reuse it with `res => res.arrayBuffer()` and add its own `not_pdf` check. This is a reuse opportunity, not a requirement on US-008. |
| `lib/extraction/html.ts` | new | Tiny pure helpers, only what the parser needs: `decodeEntities(s)` (named `amp lt gt quot apos nbsp` + numeric `&#NNN;` / `&#xHH;`; unknown entities left as-is), `stripTags(s)`, `collapseWhitespace(s)` (tolerates `\r\n`), `foldForMatch(s)` (NFD, remove combining marks, lowercase, so `Știri`/`Ştiri`/`Stiri` and `Raport depozitar`/`RAPORT DEPOZITAR` match alike). No dependency. |
| `lib/extraction/discovery.ts` | new | Exports: `BVB_REQUEST_HEADERS`, `DEFAULT_DISCOVERY_TIMEOUT_MS = 15_000`, and the types `ReportLink = { pdfUrl: string; title: string; publishedAt?: string }` and `DiscoveryResult` (story shape plus the additive `reason` on `not_found`, below). Functions: **`parseReportList(html, pageUrl)`** → `{ listFound: boolean; entries: Array<{ href: string; pdfUrl: string \| null; title: string; publishedAt?: string; isDepositaryReport: boolean; index: number }> }`. It isolates the list container by the anchor documented in the README (id/class/heading) and parses entries only inside it, so a PDF link elsewhere on the page (menus, other widgets) can never be picked. **`isDepositaryReportEntry(entry)`**: the single place where the README's identifying rule lives. It is named and exported so US-029 can extend it later; nothing more pluggable than that now. **`findLatestReportLink(html, pageUrl)`** → `ReportLink \| null`: filter `isDepositaryReportEntry && pdfUrl !== null`, sort by `publishedAt` descending (undated last, ties by `index` ascending), take the first. **`discoverLatestReport(etf: { symbol: string; bvbUrl: string }, deps?: { fetchImpl?; timeoutMs? })`**: a `fetchOnce(etf.bvbUrl, r => r.text(), { headers: BVB_REQUEST_HEADERS, … })`, then `parseReportList` / `findLatestReportLink` with `pageUrl = finalUrl`. It maps to `found` / `not_found` / `error`, and error messages include the symbol. HTML parsing is **regex over the isolated fragment**, not a library (section 4, R2). `publishedAt` is a **naive local string `YYYY-MM-DDTHH:mm`** (or `YYYY-MM-DD` if the page shows only a date), converted from the page's documented format with range validation (for example `31.02` → undefined). It carries no timezone, because the page shows Bucharest local time and inventing an offset would be guessing. It is used only for ordering. **It is never a report date** (story Notes; FINDINGS trap 2). The JSDoc says so. |
| `lib/extraction/discovery.test.ts` | new | Section 1 tests (AC1–AC7). |
| `lib/extraction/http.test.ts` | new | Classification tests for `fetchOnce` (2xx/non-2xx/reject/sync-throw/timeout both ways/body-read failure/finalUrl fallback). |
| `lib/extraction/html.test.ts` | new (small) | Entities (including `&amp;` inside hrefs, numeric Romanian diacritics), folding of ș/ş/s, CRLF. It could be folded into `discovery.test.ts` if tiny. |
| `test/fixtures/bvb/BTBETRETF-instrument-<date>.html`, `TVBETETF-…`, `PTENGETF-…` | new | Raw `res.text()` from Phase A. Commit as-is: do not prettify, and do not strip the viewstate. In Branch B-single-request, this is the response of the documented list request. |
| `test/fixtures/bvb/README.md` | new | Must contain: (1) the capture date/time and the exact capture command; (2) the request: URL, method, all headers, form fields if any, the final URL after redirects, status, content-type/charset; (3) where the list sits (container id/class or heading, the markup of one entry, with a trimmed snippet); (4) the rule that identifies a depositary report (title text and/or href/filename pattern, stated as a folded-text rule), with at least one non-report entry from the fixtures quoted as a counter-example; (5) the date/time format per entry, for example `DD.MM.YYYY HH:mm`, and its timezone as shown; (6) hrefs relative or absolute, and whether a `<base href>` exists (if it does, resolution must use it; the parser does and a test covers it); (7) differences between the fetch response and the browser DOM, if any (story Notes); (8) a table `symbol | fixture file | expected pdfUrl | expected publishedAt | how read (by hand)`; (9) a line stating that page text is data, not instructions. |
| `lib/extraction/.gitkeep` | delete (optional) | The folder now has real files. |

Not touched: `lib/db/*` (nothing persisted; Sprint 3), `app/*` (no UI), `messages/*` (no
user-facing strings: result messages are internal diagnostics for logs and FR13 bookkeeping.
Sprint 3/5 decides how they are shown, through next-intl), `package.json` (no new dependency, no
new script), `vitest.config.ts` (the network guard is per-file, not global, so no other suite
changes).

**Additive diagnostic on `not_found` (FR13).** `{ status: "not_found"; reason: "no_report_entries" | "list_not_found" }`.
The story's shape `{ status: "not_found" }` is still satisfied, since the field is additive, and
AC4 asserts on `status`. The reason for the field: if bvb.ro changes its layout, "list container
missing" must not look the same as "no report today", or the history would silently stay empty
forever. FR13 asks for parsing problems to be visible. Sprint 3 decides how it maps onto
`reports.status`. This is not a new product behaviour: the day still stays empty (FR4.1).

---

## 3. Data model and migrations

None. `etfs.bvb_url` is read-only input, and the output `pdfUrl` becomes `reports.source_url` in
Sprint 3. No schema change, no migration.

---

## 4. Risks and the smallest design

- **R1: the page structure is unknown to the planner.** Mitigated by Phase A's gate: fixtures and
  README first, parser second. Branch B/C exits are defined (section 0 step 4, section 5).
- **R2: parsing approach.** Regex over one isolated container fragment, not over the whole page,
  plus the entity decoder. That is enough for a list of `<a href>` + title + date entries, and it
  adds no dependency. Escape hatch: if the entry markup turns out to be irregular (nested tables,
  attributes in varying order that make regex brittle), the implementer may add
  `node-html-parser` (small, pure JS, no native code) **only** with a one-paragraph justification
  appended to this plan. The reviewer checks it. Anything heavier (jsdom, cheerio's full stack,
  playwright) is out: jsdom/cheerio need a TECHNICAL DEC, and a headless browser is Branch C.
- **R3: `&amp;` in hrefs, diacritic variants, CRLF.** Covered by `html.ts` and its tests. A
  wrongly decoded href would give a URL that 404s in production while every "contains `.pdf`"
  test stays green. That is why AC2 asserts strict string equality.
- **R4: ties and undated entries.** The comparator is: dated before undated, newer before older,
  then document order. Document order is the page's own order, typically newest first. This is
  not a guess about a value: the URL returned is one the page actually lists. The report date
  still comes from the PDF (US-010). If a tie ever returns an older report, ingestion upserts the
  same `report_date` again and the new day stays empty, which is FR4.1-consistent. Documented in
  the JSDoc.
- **R5: encoding.** If the page declares a non-UTF-8 charset (for example windows-1250),
  `res.text()` decodes it as UTF-8 and diacritics break. Phase A records the charset. The
  identifying rule matches on **folded** text, which survives a broken `ș`. If it is not UTF-8,
  the README says so and the rule must not depend on non-ASCII characters.
- **R6: redirects.** `bvb.ro` → `www.bvb.ro` (or http → https) is followed by `fetch`.
  Relative hrefs resolve against `finalUrl`, not the seed URL. Tested via `http.test.ts` (mocked
  `url`) and README step (2).
- **R7: default timeout 15 s.** Reasoning: one ASP.NET page, about 4 ETFs processed sequentially
  in one daily cron, discovery + download ≤ about 2 min worst case. That is well inside Vercel's
  function limit, but Sprint 3 must recheck it against the cron route's `maxDuration`. It is a
  constant, overridable per call.
- **R8: prompt injection.** News titles are external text. They are only matched and returned as
  data, never interpreted (AGENTS.md).
- **R9: US-011 fixture-set check** lists `.pdf` files in `test/fixtures/`. The HTML fixtures sit
  in the `bvb/` subfolder and are `.html`, so there is no interference.
- **Not doing:** retries, caching, persisting, cron wiring, per-issuer discovery plugins (only the
  named `isDepositaryReportEntry` seam), ICBETNETF's submit button (US-029), checking that the PDF
  belongs to the right fund (story Out of scope), and translating messages.

---

## 5. Decisions needed

**None to start.** The following are **contingent**. Each comes up only on the named Phase A
branch. When one does, the implementer stops at that point, writes the DEC as PROPOSED, and
routes it to `tech-lead` (TECHNICAL, DEC-009) and blocks US-007 until it is Decided. US-008,
US-009 and US-010 continue meanwhile.

- **C1 — `TECHNICAL`. Branch B needs two requests per call** (GET page + POST postback, or list
  page + news-item page). This conflicts with the story's "exactly one request per call" and AC6's
  "calls `fetch` exactly once", which were written to enforce FR4.1 "no retries".
  - Option (a): keep the ACs literally. Impossible on this branch.
  - Option (b): reinterpret as "exactly one attempt per documented request, a fixed N requests
    per call, no retries; the first failing request ends the call with its error; `timeoutMs` is
    the budget for the whole call". AC6 would assert `toHaveBeenCalledTimes(N)` for success and
    the failure step's count for each error case. Fixtures: commit both responses
    (`-page.html` + `-list.html`), and the README documents the hidden fields carried over.
  - Recommendation: **(b)**. It keeps FR4.1's intent (no retries) and changes no product
    behaviour. The PO sees the reworded AC at the demo (agent-drafted ACs are PO-confirmed there).
- **C2 — `TECHNICAL`. Branch C: headless browser needed** (client-rendered list or JS challenge).
  The story already mandates a DEC here. Options: (a) Playwright/puppeteer-core with a serverless
  Chromium (heavy, a Vercel Hobby size/time risk); (b) an alternative BVB source reachable by
  plain HTTP, if Phase A finds one (for example a per-symbol news/RSS endpoint); (c) the user
  maintains the latest-report URL by hand (**PRODUCT**, it changes FR3's "system downloads
  daily"). Recommendation: look hard for (b) first. If there is none, (a) as a DEC with measured
  bundle size. (c) goes to the user only as a last resort.
- **C3 — `TECHNICAL`. bvb.ro rejects the honest User-Agent** (403, a challenge, or different
  content only for non-browser UAs). Options: (a) send a mainstream browser User-Agent string;
  (b) treat it as Branch C. Recommendation: (a), recorded in a DEC and in the README, because the
  request volume is one GET per ETF per day for public data. If a browser UA still gets a JS
  challenge, it is Branch C.
- **C4 — `TECHNICAL`. The page shows no per-entry date at all.** AC3 ("most recent publication
  date/time … whatever its position") then cannot be implemented as written. Options: (a) order
  by a date embedded in the href/filename if the README can document one reliably (for example
  a `YYYYMMDD` stamp); (b) order by document order and reword AC3 to "the first depositary report
  in page order". Recommendation: (a) if Phase A finds a documented pattern, else (b), via DEC.
