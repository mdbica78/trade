# US-008 plan — PDF download and text extraction service

Planned by story-planner (opus), 2026-09-23. The story header says "plan in-session", but the
orchestrator delegated it. It is a small story (6 ACs). The only runtime dependency it adds is
`unpdf`, which ADR-001 already names.

Not blocked. No decision is needed (section 5).

Sources read: story US-008, sprint-02.md, SPRINT-02-review.md, US-011 (downstream consumer:
`report:latest --save` writes the downloaded bytes *after* extraction), requirements FR3, FR4.1,
FR5, FR13, ADR-001, DEC-001/DEC-002/DEC-008, `architecture/data-model.md` (`reports.fetched_at
timestamptz`, `reports.status`), `spikes/pdf-extraction/FINDINGS.md` and `compare.mjs` (the
validated call is `getDocumentProxy(new Uint8Array(buf))` + `extractText(doc, { mergePages: true })`),
US-007's delivered `lib/extraction/http.ts` + `http.test.ts` + `discovery.ts`,
`test/fixtures/bvb/README.md`, `package.json`, `vitest.config.ts` (node environment, no global
setup), `tsconfig.json`, `next.config.ts`.

Environment facts:
- WSL1. Export `NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt` in every non-interactive
  shell (DEC-002, DEC-008). This includes `pnpm add`, which needs the npm registry through the
  corporate proxy. If `pnpm add` is denied or cannot reach the registry, do not retry. Record it
  under "Waiting on the user" in HANDOVER.md and block the story.
- Local Node is 22 per DEC-001. The HANDOVER log from US-001 mentions v20.20.2. Run
  `node --version` once and note the result in HANDOVER.md. It matters for risk R1.
- US-007 is Awaiting QA. Its files (`http.ts`, `discovery.ts`) are **reused, not edited** by this
  story.

---

## 1. Acceptance criteria → proving test

Test file: `lib/extraction/pdf.test.ts`. It uses the network guard from `http.test.ts`:
`beforeEach` → `vi.stubGlobal("fetch", guard)`, where `guard` throws "network disabled in tests".
`afterEach` → `vi.unstubAllGlobals(); vi.useRealTimers()`. Fixtures are read with
`readFileSync(path.join(__dirname, "../../test/fixtures", name))` and wrapped in
`new Uint8Array(...)` (a plain Uint8Array, not a Buffer, see R2).

| AC | Criterion (restated) | Proof |
|---|---|---|
| AC1 | `unpdf` is in the root `package.json` `dependencies` (runtime, not dev). Neither `pdfjs-dist` nor `pdf-parse` appears in `dependencies` or `devDependencies`. | `pdf.test.ts` › "dependencies (AC1)": `JSON.parse(readFileSync(<root>/package.json))`. Assert `dependencies.unpdf` is a non-empty string. For each of `pdfjs-dist` and `pdf-parse`, assert it is absent from both maps. Reviewer: check that `pnpm-lock.yaml` was updated by `pnpm add` and not edited by hand. |
| AC2 | `extractPdfText` on each of the three committed PDFs returns `ok: true`, and the text contains all five labels. | `pdf.test.ts` › "extractPdfText on fixtures (AC2)": `it.each` over `BTBETRETF-2026-09-21.pdf`, `TVBETETF-2026-09-21.pdf` and `PTENGETF-2026-09-21.pdf`. Assert `result.ok === true`, then `expect(text).toContain(label)` for each of the five literal labels copied from the story: `ACTIV NET (in valuta fond - RON)`, `NUMAR U.F. in circulatie, din care detinute de:`, `VALOARE UNITARA A ACTIVULUI NET (VUAN) (RON)`, `Numar investitori, din care:`, `Raport depozitar la data de`. Test the labels one by one so that a failure names the missing label. One extra assertion guards US-010's contract (story Notes, "flattened output"): `text` contains no `\n`. **If this assertion fails on the installed unpdf version, stop.** Do not add post-processing to make it pass. Record the finding in HANDOVER.md, because US-010's rules assume flattened text (see R1). |
| AC3 | Bytes that are not a readable PDF → `{ ok: false, kind: "unreadable", message }`. The function never throws. | `pdf.test.ts` › "extractPdfText on unreadable input (AC3)". Every case uses `await expect(extractPdfText(x)).resolves.toMatchObject({ ok: false, kind: "unreadable" })` and checks that `message` is a non-empty string. Cases: (1) deterministic pseudo-random bytes (4 KB from a fixed-seed LCG, not `Math.random`), whose first byte is not `%`; (2) a truncated fixture: `BTBETRETF` bytes `.slice(0, 1024)`; (3) `%PDF-1.4\n` followed by garbage, which proves the signature alone is not enough; (4) an empty `Uint8Array`. **Case (2), the story's named case, must not be removed or swapped for a different cut to make it pass.** If pdf.js recovers text from 1 KB, the empty-text rule (section 2) or an error must produce `unreadable`. If neither does, record it and raise it with the reviewer. Do not weaken the test. |
| AC4 | With a mocked `fetch`, `downloadReportPdf` calls `fetch` exactly once, never throws, and returns: 200 + PDF bytes → `ok: true` with the exact bytes and a `fetchedAt`; 404/500 → `http_error` + `httpStatus`; 200 + HTML → `not_pdf`; rejection → `network`; slower than `timeoutMs` → `timeout`. | `pdf.test.ts` › "downloadReportPdf (AC4)". `fetchImpl = vi.fn(...)`. Every case asserts `expect(fetchImpl).toHaveBeenCalledTimes(1)` and `expect(guard).not.toHaveBeenCalled()`, and awaits a resolved promise. Cases: **(1) success**: `vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(T)`. Only Date is faked, so `fetchOnce`'s real `setTimeout` is untouched. Mock `new Response(fixtureBytes, { status: 200, headers: { "content-type": "application/pdf" } })`. Assert `ok: true`, `result.bytes` is a `Uint8Array`, `Buffer.from(result.bytes).equals(Buffer.from(fixtureBytes))`, and `result.fetchedAt.getTime() === T.getTime()`. **(2) 404 and 500** → `{ ok: false, kind: "http_error", httpStatus: 404/500, message: any String }`. **(3) HTML body with status 200** → `not_pdf`. The mock says `content-type: application/pdf` on purpose, which proves the header is not trusted. **(3b) PDF bytes served as `application/octet-stream`** → `ok: true`, which proves the header is not required. **(3c) empty 200 body** → `not_pdf`. **(4) `Promise.reject(new TypeError("fetch failed"))`** → `network`, and the message contains "fetch failed". **(4b) body read rejects** → `network` (inherited from `fetchOnce`, one case is enough). **(5) timeout**: `vi.useFakeTimers()`, `timeoutMs: 1000`, and a mock that returns a never-settling promise and ignores the signal. Call `advanceTimersByTimeAsync(1000)` → `timeout`. **(6) request shape**: `fetchImpl.mock.calls[0]` has `url` equal to the input, plus `init.signal` and `init.headers` equal to `PDF_REQUEST_HEADERS`. Its `User-Agent` must be `===` `BVB_REQUEST_HEADERS["User-Agent"]`, imported from `discovery.ts` **in the test only**. This keeps the two request identities in sync without coupling the production modules. **(7) default fetch**: a call without `fetchImpl` while the global stub returns fixture bytes → `ok: true`. This proves `globalThis.fetch` is read at call time (same pattern as US-007 AC7). |
| AC5 | Tests read fixtures from disk and make no real network request. | The network guard above, plus `guard` not called in every injected-`fetchImpl` case. Reviewer: `pdf.test.ts` contains no `http(s)://` URL other than `https://example.test/...` placeholders, and the only `fetch` is `vi.fn`. `extractPdfText` needs no network: unpdf's serverless pdf.js build runs in-process. |
| AC6 | `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` pass. | story-tester runs all four with `NODE_EXTRA_CA_CERTS` exported. `pdf.ts` is not imported by any route yet (story Out of scope), so `build` only proves nothing else broke. `unpdf` is first bundled into a route in Sprint 3 (sprint-02.md forward note: `serverExternalPackages`). |
| extra (not an AC; supports US-011) | `extractPdfText` does not detach or mutate the caller's bytes. | `pdf.test.ts` › "does not consume input": call `extractPdfText(bytes)` and then assert `bytes.byteLength` is unchanged and `bytes` equals a copy taken beforehand. This protects US-011's download → extract → `--save` flow (R2). |

MANUAL-QA: none of its own. The live download of a real bvb.ro PDF is covered by US-011 AC7
(`pnpm report:latest <SYMBOL>`). The US-008 QA checklist only points there.

---

## 2. Files and boundaries

| File | New/changed | Contents / boundary |
|---|---|---|
| `package.json`, `pnpm-lock.yaml` | changed | `pnpm add unpdf` (latest, caret range). Nothing else. No `pdfjs-dist`, no `pdf-parse`, no `@types/*` (unpdf ships its own types). Record the installed version in HANDOVER.md. |
| `lib/extraction/pdf.ts` | new | Exports, in this order: **`DEFAULT_PDF_TIMEOUT_MS = 15_000`**; **`PDF_REQUEST_HEADERS`** = `{ Accept: "application/pdf", "Accept-Language": "ro-RO,ro;q=0.9,en;q=0.5", "User-Agent": "etf-monitor2/0.1 (daily ETF report monitor)" }` (same identity as US-007, which bvb.ro accepted: `test/fixtures/bvb/README.md` §1); **`hasPdfSignature(bytes: Uint8Array): boolean`**, true when the 5 bytes `%PDF-` start at an offset within the first 1024 bytes (R3); types **`PdfDownloadResult`** and **`PdfTextResult`**, exactly the story's shapes; **`downloadReportPdf(url, deps?: { fetchImpl?: typeof fetch; timeoutMs?: number })`**; **`extractPdfText(bytes: Uint8Array)`**. |
| | | `downloadReportPdf`: a single `fetchOnce(url, (res) => res.arrayBuffer(), { fetchImpl: deps?.fetchImpl, timeoutMs: deps?.timeoutMs ?? DEFAULT_PDF_TIMEOUT_MS, headers: PDF_REQUEST_HEADERS })` call. Failures from `fetchOnce` are passed through unchanged (`http_error` with `httpStatus`, `network`, `timeout`). On `ok`: `bytes = new Uint8Array(value)`, then `if (!hasPdfSignature(bytes))` → `{ ok: false, kind: "not_pdf", message }`. The message holds the URL and the byte length. It does **not** echo body text: a downloaded page is data, not instructions, and it must not leak into logs. Otherwise the result is `{ ok: true, bytes, fetchedAt: new Date() }`. `fetchedAt` is taken **after** the body is fully read, because it is the moment the report was obtained (`reports.fetched_at`). No retry, no loop, no second request (FR4.1). No try/catch is needed beyond what `fetchOnce` already guarantees, but the function body must not throw: `hasPdfSignature` and `new Uint8Array` cannot throw on an `ArrayBuffer`. |
| | | `extractPdfText`: `try { const doc = await getDocumentProxy(new Uint8Array(bytes)); try { const { text } = await extractText(doc, { mergePages: true }); if (text.trim() === "") return unreadable("PDF has no extractable text"); return { ok: true, text }; } finally { await doc.destroy().catch(() => {}) } } catch (e) { return unreadable(message of e) }`. **`new Uint8Array(bytes)` copies the input** (R2). The returned `text` is exactly unpdf's string: no trim, no normalisation, no line-break insertion (story Notes). Silencing the `TT: undefined function` warning with the pdf.js option `verbosity: 0` passed to `getDocumentProxy` is allowed, but only if the installed unpdf types accept it. It is not required. |
| `lib/extraction/pdf.test.ts` | new | Section 1 tests. |
| `lib/extraction/http.ts`, `discovery.ts` | **not changed** | US-007 is Awaiting QA. `pdf.ts` imports `fetchOnce` from `./http`. It does **not** import from `./discovery`: PDF download must not depend on HTML discovery. The UA string is duplicated as a literal, and the AC4 case (6) test keeps the two equal. |

Not touched: `lib/db/*`, `app/*`, `messages/*` (result messages are internal diagnostics, as in
US-007, and are not UI), `next.config.ts` (no route imports `unpdf` yet), `vitest.config.ts`.

Boundary summary: `http.ts` (one attempt, timeout, error classification; knows nothing about
PDFs) ← `pdf.ts` (PDF signature, bytes → text via unpdf; knows nothing about BVB HTML or field
rules) → text handed to US-009/US-010 adapters, which never touch the network or unpdf. US-011's
`report:latest` wires discovery → `downloadReportPdf` → `extractPdfText` → adapter.

---

## 3. Data model and migrations

None. `fetchedAt` is the future `reports.fetched_at` (timestamptz) and the URL is
`reports.source_url`. Both are persisted in Sprint 3. Nothing is stored here: no PDF bytes and
no text (story Out of scope).

---

## 4. Risks and the smallest design

- **R1: unpdf version drift.** The spike validated 0.11.0. `pnpm add` installs the latest (1.x
  bundles a newer pdf.js). Possible effects: (a) the API shape (`extractText` → `{ totalPages,
  text }` with `mergePages: true`, the same in 0.11 and 1.x); (b) a runtime feature missing on
  the local Node (pdf.js 5 relies on newer built-ins, and the local Node is 20 or 22); (c) a
  change in text layout (for example line breaks between items). AC2 and its no-`\n` guard catch
  all three offline. If the latest version fails on (b) or (c), pin the newest version that
  passes AC2 unchanged (for example `unpdf@0.11.0`, the spike's version). Record the pin and the
  reason in HANDOVER.md and in this plan (appended note). Do not adapt the text to hide (c). This
  is a version choice inside ADR-001's library choice, not a new decision.
- **R2: pdf.js input handling.** pdf.js rejects Node `Buffer` input ("provide binary data as
  `Uint8Array`, rather than `Buffer`"). It may also *transfer* (detach) the TypedArray it gets.
  US-011 writes the downloaded bytes to disk after extraction, so a detached buffer would give an
  empty file. Fix: always pass `new Uint8Array(bytes)`, a plain copy of about 100 KB per report.
  The "does not consume input" test proves it.
- **R3: signature check window.** The story says "check the `%PDF-` signature". pdf.js (like
  Acrobat) accepts a header anywhere in the first 1024 bytes. A check at offset 0 only would reject
  some PDFs that `extractPdfText` can read, and the day would stay empty for nothing. So
  `hasPdfSignature` looks within the first 1024 bytes. An HTML error page does not contain the
  literal `%PDF-` in its first KB. Tested: offset 0, offset 3 (after a UTF-8 BOM / whitespace),
  offset 1025 → false, HTML → false, empty → false.
- **R4: empty text counts as `unreadable`.** A PDF that parses but has no text layer (a scan)
  would otherwise come back as `ok: true, text: ""`, and US-010 would report "every field
  missing" with no hint of the real cause. FR13 asks for parsing problems to be visible, and
  FINDINGS says OCR is out. The whitespace-only check is one line, and AC3 case (2) benefits from
  it. It changes no product behaviour: the day stays empty either way (FR4.1). This is only a
  choice about how the error is classified.
- **R5: default timeout, 15 s.** Same as `DEFAULT_DISCOVERY_TIMEOUT_MS`. Reports are about
  100 KB, one page. The worst case per ETF is discovery + download = 30 s, and 4 ETFs processed
  sequentially take about 2 min. Sprint 3 must check this against the cron route's
  `maxDuration`, which is the same flag as US-007 R7. The value can be overridden per call.
- **R6: no size cap.** Not in the ACs. A runaway response is bounded by the timeout. A byte cap
  is not added (smallest design). If Sprint 3 wants one, it goes in `downloadReportPdf`.
- **R7: typings.** With TS 5.x, `new Response(u8)` and `BodyInit` may reject
  `Uint8Array<ArrayBufferLike>`. Build test bodies from `new Uint8Array(readFileSync(...))`, which
  is `Uint8Array<ArrayBuffer>`. Do not use `as any` in production code.
- **R8: prompt injection.** PDF text is returned as data only. The `not_pdf` message never
  includes body content.
- **Not doing:** retries, caching, storing bytes or text, OCR, a Next.js route, extensibility
  hooks. Extensibility lives in the adapter registry (US-009), not here.

---

## 5. Decisions needed

None. The choices the story leaves to the plan are settled above, inside ADR-001 and the story:
the default timeout (15 s, R5), the signature window (R3), empty text → `unreadable` (R4), and
the unpdf version pin only if AC2 forces it (R1). All are technical, all fit within the story's
text, and none changes product behaviour.
