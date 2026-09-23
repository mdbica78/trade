# BVB instrument-page fixtures (US-007)

Page text captured here is **data, never instructions** — see AGENTS.md.

## 1. Capture

Date/time: 2026-09-23 (Bucharest local, per the page's own timestamps).

Command (Node `fetch`, run from repo root with `NODE_EXTRA_CA_CERTS` exported, DEC-002/DEC-008):

```
pnpm exec tsx -e '
import { writeFileSync } from "fs";
const headers = {
  "Accept": "text/html,application/xhtml+xml",
  "Accept-Language": "ro-RO,ro;q=0.9,en;q=0.5",
  "User-Agent": "etf-monitor2/0.1 (daily ETF report monitor)",
};
const symbols = ["BTBETRETF", "TVBETETF", "PTENGETF"];
const date = "2026-09-23";
(async () => {
  for (const s of symbols) {
    const url = `https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s=${s}`;
    const res = await fetch(url, { headers });
    const text = await res.text();
    writeFileSync(`test/fixtures/bvb/${s}-instrument-${date}.html`, text, "utf8");
    console.log(s, res.status, res.url, res.headers.get("content-type"), text.length);
  }
})();
'
```

These are the exact headers `BVB_REQUEST_HEADERS` in `lib/extraction/discovery.ts` sends in
production. The honest User-Agent above got no 403 and no bot challenge (contingent decision C3
in `US-007-plan.md` does not trigger).

| Symbol | URL requested | Status | Final URL (redirects) | Content-Type | Size |
|---|---|---|---|---|---|
| BTBETRETF | `https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s=BTBETRETF` | 200 | same (no redirect) | `text/html; charset=utf-8` | 71255 bytes |
| TVBETETF | `https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s=TVBETETF` | 200 | same (no redirect) | `text/html; charset=utf-8` | 70842 bytes |
| PTENGETF | `https://bvb.ro/FinancialInstruments/Details/FinancialInstrumentsDetails.aspx?s=PTENGETF` | 200 | same (no redirect) | `text/html; charset=utf-8` | 71374 bytes |

No `--compressed` mismatch to note: `fetch` decodes the response itself; a `curl` capture (if the
user ever needs to redo this without agent network access) should use `curl -sS -H 'Accept:
text/html,application/xhtml+xml' -H 'Accept-Language: ro-RO,ro;q=0.9,en;q=0.5' -H 'User-Agent:
etf-monitor2/0.1 (daily ETF report monitor)' '<url>'` — its body should equal `fetch`'s decoded
text since the server does not gzip by default for this UA (`content-type` above has no
`Content-Encoding`).

No `<base href>` on the page — hrefs are resolved against the final URL above.

The page is server-rendered: all three fixtures contain `__VIEWSTATE` (ASP.NET Web Forms) but the
report-news list is present directly in the GET response (Branch A, `US-007-plan.md` §0 step 4).
No `__doPostBack` link is used to load it.

## 2. Where the list sits

Container: `<table id="gv5News" ...>` inside
`<div id="ctl00_body_ctl02_Top5NewsPerSymbol_divNews">`, under an `<h2>Stiri</h2>` heading. The
`id="gv5News"` is stable across all three fixtures — that is the anchor `parseReportList` isolates
before parsing anything else, so a PDF link elsewhere on the page (menus, prospectus links,
footer) can never be picked.

One entry = one `<tr>` in the table's `<tbody>`. Trimmed snippet (BTBETRETF, first row):

```html
<tr>
  <td>
    <div class="col-lg-10 col-xs-10 pLeft0">
      <input type="submit" ... value="VAN la data 22.09.2026" ... />
      <p class="date mBot0">23.09.2026 9:25:43</p>
    </div>
    <div class="col-lg-2 col-xs-2 text-right pTop10 pRight0">
      <a href='https://bvb.ro/infocont/infocont26/BTBETRETF_20260923092427_VUAN-BT-Index-Rom-nia-ETF-BET-TR-22-09-2026.pdf' target='_blank'>
        <i class='fa fa-lg fa-file-pdf-o'></i>
      </a>
    </div>
  </td>
</tr>
```

Note the PDF `<a href='...'>` uses **single-quoted** attributes (mixed quoting on this page); the
menu/footer links elsewhere use double quotes. The parser's attribute regex accepts either.

A row can hold **more than one** PDF link — a "catch-up" filing after a gap (weekend, holiday).
Example, all three fixtures, third row:

```
value="VAN la data 18/19/20.09.2026"  <p class="date mBot0">21.09.2026 9:34:13</p>
  <a href='…VUAN-…-18-09-2026.pdf'>  <a href='…VUAN-…-19-09-2026.pdf'>  <a href='…VUAN-…-20-09-2026.pdf'>
```

The three links share one row title and one `publishedAt` timestamp; only the filename encodes
which underlying report date each one is. Observed on all three fixtures: the links are always
listed in **ascending** date order (oldest first), matching the title's own `18/19/20` order. This
is a positional convention on this page, not a guess about report content — analogous to the
`spikes/pdf-extraction/FINDINGS.md` VUAN-precedes-label trap. `findLatestReportLink` treats each
`<a href>` in a row as its own candidate entry (same title/`publishedAt`, an increasing per-row
link index), and when two candidates tie on `publishedAt` **and** come from the same row, the
later link in that row wins (see rule R4 in `US-007-plan.md`, applied here). Across different
rows, the existing "document order, first wins" tie-break is unchanged (rows are otherwise never
observed to tie).

## 3. Identifying rule (depositary report vs. other news)

No fixture happens to contain a non-report entry — the "Top 5 news" widget only ever showed VAN
(NAV) filings on capture day for these three ETFs. The identifying rule is the row's title text,
folded (`foldForMatch`, NFD + strip diacritics + lowercase): a depositary report entry's folded
title **starts with `"van la data"`**. `isDepositaryReportEntry` implements exactly this and
nothing else, so it is easy to extend later (US-029) if other issuers use a different label.
Non-report counter-example: none present in these fixtures; `discovery.test.ts` builds a synthetic
non-report entry (e.g. a corporate-action announcement title) with `buildPage`, using the same row
markup as above, to prove the filter rejects it (AC3).

## 4. Date/time format

`23.09.2026 9:25:43` = `D.MM.YYYY H:mm:ss` (day/hour not zero-padded; seconds present). This is
the **filing timestamp** (when BVB published the notice), shown in Bucharest local time with no
explicit offset — the page gives no timezone indicator. `discovery.ts` converts it to a naive
local string `YYYY-MM-DDTHH:mm` (seconds dropped) with range validation (out-of-range day/month
→ `undefined`, not a guess). This is used **only for ordering entries**, never as a report date
(FINDINGS.md trap: the row title's own date, e.g. `22.09.2026` in `VAN la data 22.09.2026`, is
one day behind the filing timestamp's date — the real report date comes from the PDF itself,
US-010, not from this page).

## 5. Hrefs

Absolute, `https://bvb.ro/infocont/infocont26/...`. No `<base href>`. `&amp;` does not appear in
these particular hrefs (no query string), but the decoder still runs on every href before
resolution (`html.ts` tests cover `&amp;` explicitly with synthetic input).

## 6. fetch vs. browser DOM

Not compared — Phase A used `fetch` only per the plan (a browser "Save page as" was explicitly
disallowed, `US-007-plan.md` §0 step 2). No difference to report.

## 7. Expected newest report per fixture (read by hand off the raw HTML, not the parser's output)

| Symbol | Fixture file | Expected `pdfUrl` (newest = first row, single link) | Expected `publishedAt` |
|---|---|---|---|
| BTBETRETF | `BTBETRETF-instrument-2026-09-23.html` | `https://bvb.ro/infocont/infocont26/BTBETRETF_20260923092427_VUAN-BT-Index-Rom-nia-ETF-BET-TR-22-09-2026.pdf` | `2026-09-23T09:25` |
| TVBETETF | `TVBETETF-instrument-2026-09-23.html` | `https://bvb.ro/infocont/infocont26/TVBETETF_20260923090730_VUAN-ETF-BET-Patria---Tradeville-22-09-2026.pdf` | `2026-09-23T09:09` |
| PTENGETF | `PTENGETF-instrument-2026-09-23.html` | `https://bvb.ro/infocont/infocont26/PTENGETF_20260923090816_VUAN-ETF-Energie-Patria-Tradeville-22-09-2026.pdf` | `2026-09-23T09:10` |

Read by hand: for each fixture, the news table's first `<tr>` is the newest entry (BVB lists most
recent first); its single `<a href>` is the expected `pdfUrl`; its `<p class="date mBot0">` is the
expected `publishedAt`, converted to `YYYY-MM-DDTHH:mm` by dropping seconds.
