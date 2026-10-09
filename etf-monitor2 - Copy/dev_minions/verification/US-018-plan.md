# US-018 — Plan: ETF detail page, historical values table
Planned by `story-planner`, 2026-09-25. Story: `backlog/stories/US-018.md` (the tech-lead approved it
with no change in `SPRINT-04-review.md`; N1, N2 and N3 there apply). This plan builds on US-016 and
US-017 (both Awaiting QA): `lib/monitoring/home.ts`, `lib/format/{number,date}.ts`,
`components/HomeTable.tsx`, `test/helpers/pglite.ts`.

No new decision is needed. The story's three PRODUCT items (sprint-04.md #8, #9, #10) are
non-blocking, and the story says "This story implements" option A for each. This plan implements
option A, and the PO confirms at the demo. The review's N2 (which message wins when there are
neither tracked fields nor `ok` reports) is settled here as an implementation detail, see §4.4.

## 1. Acceptance criteria → tests

| AC | Restated | Proven by |
|---|---|---|
| AC1 | `/etf/<SYMBOL>` renders a heading with the symbol and the stored name. Lookup by exact symbol. Unknown symbol → `notFound()` (404). | **Read model**, `lib/monitoring/history.pglite.test.ts`: the seeded `BTBETRETF` → `etf = { symbol: "BTBETRETF", name: "BT Index Romania ETF BET-TR", isActive: true }`. `NOPE` → `null`. `btbetretf` (lower case) → `null` (exact match). `BTBETRETF ` (trailing space) → `null`. `x' or '1'='1` → `null`, and the `etfs` row count is unchanged afterwards. A statement test checks that `buildHistoryEtfStatement(mockDb, "SYM").getQuery()` has `"SYM"` in `params` and not in the SQL text (bound parameter, story Notes). **Page**, `app/etf/[symbol]/page.test.tsx`: the loader is mocked to return a history → the `<h1>` contains both `BTBETRETF` and the stored name. The loader returns `null` → the page rejects with the sentinel thrown by the mocked `notFound`, and `notFound` was called exactly once. The page is called with `params: Promise.resolve({ symbol })`, the Next.js 16 shape. The loader is called with exactly the symbol from `params`. |
| AC2 | Every home-table row has a translated link to `/etf/<symbol>`, separate from the symbol's PDF link, which is unchanged. | `components/HomeTable.test.tsx`: in the `BTBETRETF` row (the markup between that row's `<tr>` and `</tr>`) there are both `href="https://bvb.ro/report.pdf"` (on the `<a>` with `target="_blank"` that wraps the symbol) and `href="/etf/BTBETRETF"`, and they are two different `<a>` elements. The `NOADAPTER` row (no PDF) still has `href="/etf/NOADAPTER"`. The link text is `Home.historyLink` in `ro` and in `en`, and never the other locale's text. The existing US-016 link test is tightened, not loosened (see R3). |
| AC3 | One row per `ok` report, newest first. One column per tracked field (`display_order`, then `field_key`) headed by the catalogue label for the ETF's own `adapter_key` in the locale, `field_key` as fallback. Cells are stored values via `formatNumber`. A missing value is an empty cell. An untracked stored field never appears. | **Read model** (`history.pglite.test.ts`): (a) three `ok` reports inserted out of order → `rows.map(r => r.reportDate)` is newest first. (b) Order: `b_field` order 0, `a_field` order 1, `c_field` order 1 → `["b_field", "a_field", "c_field"]`. (c) Labels: the ETF's own adapter (`brd-depositary`) and another adapter (`a-adapter`, alphabetically first) define the same `field_key` with different labels → the `brd-depositary` label wins. A field with no catalogue row → `field_key` for both labels. An ETF with `adapter_key = NULL` → `field_key` labels. (d) A report stores `nav_per_unit`, `units_in_circulation` and `net_asset`, and only the first two are tracked → `fields` has exactly the two, and every `row.values` has exactly the keys `nav_per_unit` and `units_in_circulation`. The `net_asset` value appears nowhere in `JSON.stringify(result)`. (e) An `ok` report with a value for only one of the two tracked fields → the other is `null`. An `ok` report with no values at all still yields a row, with every value `null`. (f) Another ETF's reports never appear. **Component**, `components/HistoryTable.test.tsx`: headers in the column order with the locale's label. A `null` value renders exactly `<td></td>`. `37470000` renders `37470000` in both locales, with no grouping character. |
| AC4 | Missing days are never filled. | `history.pglite.test.ts`: `ok` reports on 2026-09-21 and 2026-09-23 only → `rows` has exactly 2 entries, `2026-09-23` then `2026-09-21`. No entry has `reportDate` `2026-09-22`. Second case, for "no carried-forward number": the 2026-09-23 report lacks `units_in_circulation`, which the 2026-09-21 report has → that 09-23 value is `null`, not the 09-21 number. |
| AC5 | Only `ok` reports. | `history.pglite.test.ts`: `ok` 09-21, `parse_error` 09-22 **with** a stored `nav_per_unit` of `999`, `ok` 09-23 → dates `[09-23, 09-21]`, and `"999"` is absent from `JSON.stringify(result)`. Same for a `missing` and a `no_adapter` row (the other two values of the `status` enum), so "`ok` only" is proven for every non-`ok` status. An ETF whose only report is `parse_error` → `rows: []`. |
| AC6 | No `ok` report → translated "no history yet" instead of an empty table. No tracked fields → translated message. DB read throws → translated error, no throw, no exception text, no environment value. | **Component**, `components/EtfDetail.test.tsx`, `ro` and `en`: `rows: []` with fields → `EtfDetail.noHistory`, and no `<table>`. `fields: []` with rows → `EtfDetail.noTrackedFields`, no `<table>`. Both empty → `noTrackedFields` only, `noHistory` absent (§4.4, review N2). The heading is still shown in these states. **Page**, `page.test.tsx`: the loader throws `new Error("connection refused: postgres://user:secret@db.example.com/etfs")` → the render contains `EtfDetail.loadError` and none of `connection refused`, `postgres://`, `secret`. `notFound` is **not** called (a DB error is not a 404). A second case sets `process.env.DATABASE_URL` to a marker value inside the test, restores it in `afterEach`, makes the loader throw an error whose message contains that marker, and checks the marker is absent. A third case has the mocked `getDb` itself throw (the real `MissingDatabaseUrlError` path) → the same translated error. **Read model**: the "no tracked fields" and "no `ok` report" shapes come out of PGlite as `fields: []` and `rows: []`. |
| AC7 | An inactive ETF's page still renders its history. The home table does not list it. | `history.pglite.test.ts`: an ETF inserted with `is_active = false`, one tracked field and one `ok` report → a non-null result with `isActive: false` and one row. Page/component: an `isActive: false` history renders the table. Home side: already proven by US-016's `home.pglite.test.ts` "AC1: … inactive excluded". No change is needed; cite it in the review. |
| AC8 | Every new string goes through next-intl, in both catalogues. Key parity passes. `ro`/`en` renders show the locale's headers, date format and decimal mark. The stored name is shown untranslated. | `HistoryTable.test.tsx` for `ro` and `en`: the header `EtfDetail.dateColumn` plus the field labels (`labelRo`/`labelEn`). Date `2026-09-22` → `22.09.2026` (`ro`) / `2026-09-22` (`en`). Value `11.171` → `11,171` / `11.171`. `EtfDetail.test.tsx`: the stored name `Fondul Deschis de Investiții BT Index România ETF BET-TR` appears byte-identical in both locales. Each locale's new message texts appear, and the other locale's differing texts do not. `i18n/messages.test.ts` (parity, non-empty leaves) stays green, unchanged. |
| AC9 | Offline and build-safe. | The read-model tests use `createTestDatabase()` and `createEtfHistoryLoader(db.mockDb, db.runner)`, the statements the page runs. The page test mocks `@/lib/db` and `@/lib/monitoring/history`. No test imports `@neondatabase/serverless` or reads `DATABASE_URL`, except AC6's marker test, which sets and restores it. `pnpm build` with `DATABASE_URL` unset: the implementer runs it and records in HANDOVER that the route table shows `ƒ /etf/[symbol]` (dynamic). |
| AC10 | Gates | `pnpm typecheck && pnpm lint && pnpm test && pnpm build`. |

**MANUAL-QA (live, user)**: sprint-04.md step 6, the table part only. The charts are US-019.
1. On the deployed home page, each row shows the "Istoric" link next to the symbol. Clicking the symbol still opens the newest PDF in a new tab.
2. Click "Istoric" for BTBETRETF → `/etf/BTBETRETF`. The heading shows the symbol and the stored name. There is one row per stored `ok` report date, newest first, with columns "Unități de fond în circulație" and "Valoare unitară a activului net (VUAN)". Dates are `dd.MM.yyyy`, values have a decimal comma and no grouping. Compare the newest row with the home-table row: it has the same date and the same values.
3. Switch to EN: headers "Units in circulation" / "Net asset value per unit", ISO dates, decimal dot. The ETF name is unchanged.
4. Open `/etf/NOPE` → a 404 page.
5. Cross-check against Neon (optional): `select report_date from reports r join etfs e on e.id = r.etf_id where e.symbol = 'BTBETRETF' and r.status = 'ok' order by report_date desc;` returns exactly the dates in the table.

Codex QA (local, `scripts/claude/qa-serve.sh`, no `DATABASE_URL`): `/etf/BTBETRETF` and `/etf/NOPE` both show the translated error message, not a crash. Without a database the app cannot tell an unknown symbol from a known one, so no 404 is expected locally. The home page's error state is unchanged.

## 2. Files and boundaries

| File | Change | Boundary |
|---|---|---|
| `lib/monitoring/history.ts` | **New.** Types `EtfHistory`, `HistoryField`, `HistoryRow`. Exported statement builders `buildHistoryEtfStatement`, `buildHistoryFieldsStatement`, `buildHistoryRowsStatement` (each `(db, symbol)`). `createEtfHistoryLoader(db, run = neonBatchRunner(db))` returns `(symbol: string) => Promise<EtfHistory \| null>`. | Read-only. One `BatchRunner` call per page load. Reuses `BatchRunner`, `neonBatchRunner` and `rowsOf` from `lib/ingestion/store.ts`, like `home.ts`. It does not import `home.ts`, and `home.ts` is not changed. It does no formatting. `null` means "no ETF with that symbol". Errors propagate to the caller. |
| `lib/monitoring/history.pglite.test.ts` | **New.** AC1, AC3, AC4, AC5, AC7 on PGlite, plus the bound-parameter statement test | Helpers (`insertEtf`, `trackField`, `insertCatalog`) copied locally in the style of `home.pglite.test.ts`. Reports are written with `createDrizzleReportStore(...).saveReport`, as in US-016, so the fixtures match what ingestion writes. |
| `components/HistoryTable.tsx` | **New.** Props `{ fields: readonly HistoryField[]; rows: readonly HistoryRow[] }`. Renders `<table>`: a date column, then one column per field. | Presentational and synchronous. Uses `useTranslations("EtfDetail")` and `useLocale()`. Only calls `formatReportDate` and `formatNumber`. No state messages: the parent decides whether a table is rendered. |
| `components/HistoryTable.test.tsx` | **New.** AC3 (component part) and AC8 | — |
| `components/EtfDetail.tsx` | **New.** Props `{ status: "error" } \| { status: "ok"; history: EtfHistory }`. Renders the heading, then the state message or `<HistoryTable>`. | Presentational and synchronous, the same pattern as `HomeTable` (hooks cannot be used in an async page, Sprint 1 audit W3). US-019 adds its charts here, below the table. |
| `components/EtfDetail.test.tsx` | **New.** AC6 (states, N2 precedence), AC7 (inactive renders), AC8 (name untranslated, locale texts) | — |
| `app/etf/[symbol]/page.tsx` | **New.** `export default async function EtfDetailPage({ params }: { params: Promise<{ symbol: string }> })` | Awaits `params`, loads through `createEtfHistoryLoader(getDb())(symbol)` inside a `try/catch` that maps any error to `{ status: "error" }`. It calls `notFound()` **outside** the `try` (§4.3). No `generateStaticParams`, no `generateMetadata`, no DB access at module scope. |
| `app/etf/[symbol]/page.test.tsx` | **New.** AC1 (page part), AC6 (error and leak cases), AC9 mocks | Mocks `@/lib/db`, `@/lib/monitoring/history` and `next/navigation` (`notFound: vi.fn(() => { throw NOT_FOUND_SENTINEL })`). Renders with `NextIntlClientProvider` and `renderToStaticMarkup`, the same way as `app/page.test.tsx`. |
| `components/HomeTable.tsx` | **Edit.** In the symbol `<td>`, after the PDF link or plain symbol and after the "extraction unavailable" marker, add `{" "}<Link href={`/etf/${encodeURIComponent(row.symbol)}`}>{t("historyLink")}</Link>` (`next/link`). | The PDF link markup is unchanged. The link goes in the first `<td>`, not in a new last column. US-017's `cellTextFor` helper reads the row's **last** `<td>`, and a new trailing column would break its tests. |
| `components/HomeTable.test.tsx` | **Edit.** Adds the AC2 test. Tightens one existing assertion (R3). | — |
| `messages/ro.json`, `messages/en.json` | **Edit.** `Home.historyLink`: "Istoric" / "History". New namespace `EtfDetail`: `dateColumn` "Dată" / "Date"; `noHistory` "Nu există încă istoric pentru acest ETF." / "No history yet for this ETF."; `noTrackedFields` "Acest ETF nu are câmpuri urmărite." / "This ETF has no tracked fields."; `loadError` with the same text as `Home.loadError`. | The PO confirms the Romanian copy at the demo (US-004 precedent). |

No new dependency. No change to `lib/monitoring/home.ts`, `app/page.tsx`, `app/layout.tsx`, the schema or the migrations.

## 3. Data model
None. Read-only. No schema change and no migration (story Out of scope, sprint DoD). The existing
`etfs_symbol_unique` constraint guarantees at most one ETF per symbol, and
`reports_etf_id_report_date_unique` guarantees at most one row per date.

## 4. Design

### 4.1 Read model (`lib/monitoring/history.ts`)
```ts
export type HistoryField = { fieldKey: string; labelRo: string; labelEn: string };
export type HistoryRow = { reportDate: string /* YYYY-MM-DD */; values: Record<string, string | null> /* one key per field */ };
export type EtfHistory = {
  etf: { symbol: string; name: string; isActive: boolean };
  fields: readonly HistoryField[];   // display_order, then field_key
  rows: readonly HistoryRow[];       // ok reports only, newest report_date first
};
```
There are three statements, all filtered by the bound `${symbol}`. None depends on another's
result, so all three go in one `db.batch` (one round trip, DEC-010 read pattern):

```sql
-- 1. etf
select "e"."symbol", "e"."name", "e"."is_active" from "etfs" "e" where "e"."symbol" = $1

-- 2. fields: the ETF's tracked fields with the labels of its own adapter (left join, so a missing
--    catalogue row or a NULL adapter_key falls back to field_key in TS)
select "t"."field_key", "fc"."label_ro", "fc"."label_en"
from "etfs" "e"
join "tracked_fields" "t" on "t"."etf_id" = "e"."id"
left join "field_catalog" "fc" on "fc"."adapter_key" = "e"."adapter_key" and "fc"."field_key" = "t"."field_key"
where "e"."symbol" = $1
order by "t"."display_order", "t"."field_key"

-- 3. rows: ok reports only; values restricted to the ETF's tracked field keys (in the join
--    condition, so an ok report with no tracked value still yields one row with a NULL field_key)
select to_char("r"."report_date", 'YYYY-MM-DD') as "report_date", "rv"."field_key", "rv"."numeric_value"
from "etfs" "e"
join "reports" "r" on "r"."etf_id" = "e"."id" and "r"."status" = 'ok'
left join "report_values" "rv" on "rv"."report_id" = "r"."id"
  and "rv"."field_key" in (select "t"."field_key" from "tracked_fields" "t" where "t"."etf_id" = "e"."id")
where "e"."symbol" = $1
order by "r"."report_date" desc, "r"."id" desc, "rv"."field_key"
```
The `ok` filter and the tracked-key filter are both in the SQL, where the story's Notes ask the
reviewer to look. The TS assembly then does only this:
- no etf row → return `null`;
- `fields` maps each row, with `label_ro ?? field_key` and `label_en ?? field_key`;
- `rows` groups the ordered result by `report_date`, keeping first-seen order, which is newest
  first. Each row's `values` is pre-filled with `null` for every field, then filled with
  `String(numeric_value)` (or `null` when that is null). A `field_key` that is not in `fields`
  is ignored. The SQL already excludes it, so this is only a second guard.

`to_char(…, 'YYYY-MM-DD')` returns `text` on both drivers. This removes the PGlite `Date` parsing
trap that `home.ts`'s `toIsoDateString` works around (US-016 HANDOVER note), and it avoids
exporting or duplicating that private helper. It does not depend on the `DateStyle` setting,
unlike `::text`.

`isActive` is in the model as the story's Task 2 asks. The page does not show it (no AC asks for a
marker). Any number conversion (`Number(...)`) is only on `is_active`/booleans. Value strings are
never parsed.

### 4.2 Components
- `EtfDetail`, with precedence **error → heading → noTrackedFields → noHistory → `<HistoryTable>`**.
  The heading is `<h1>{symbol} <span>{name}</span></h1>`. The name is plain text, untranslated,
  and escaped by React. In the error state there is no heading, only `<p role="alert">{loadError}</p>`,
  as in `HomeTable`.
- `HistoryTable`: `<th>{t("dateColumn")}</th>`, then `{locale === "ro" ? labelRo : labelEn}` per
  field. Each body row is `<td>{formatReportDate(reportDate, locale)}</td>` followed by
  `<td>{value === null ? "" : formatNumber(value, locale)}</td>` per field, keyed by `reportDate`.

### 4.3 Page and `notFound()`
```ts
type Loaded = { status: "ok"; history: EtfHistory } | { status: "notFound" } | { status: "error" };
async function load(symbol: string): Promise<Loaded> {
  try {
    const history = await createEtfHistoryLoader(getDb())(symbol);
    return history ? { status: "ok", history } : { status: "notFound" };
  } catch {
    return { status: "error" }; // AC6: never render the exception
  }
}
export default async function EtfDetailPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const loaded = await load(symbol);
  if (loaded.status === "notFound") notFound();   // outside the try: never swallowed
  return <div …><main …><EtfDetail {...(loaded.status === "ok" ? loaded : { status: "error" })} /></main></div>;
}
```
`getDb()` is called inside the `try`, so a missing `DATABASE_URL` becomes the error state, not a
crash. Dynamic rendering (review N3): the route is a dynamic segment with no
`generateStaticParams`, and the root layout reads `cookies()` through next-intl. So it is never
prerendered, the same basis as `/` (US-016 review: `ƒ /`). The implementer confirms `ƒ /etf/[symbol]`
in the build output with `DATABASE_URL` unset. If the build ever shows it as static, add
`await connection()` (from `next/server`) as the page's first line. Do not use
`export const dynamic`, to stay compatible if `cacheComponents` is turned on later.

### 4.4 Review N2: both states at once
When an ETF has no tracked fields **and** no `ok` report, `noTrackedFields` is shown alone. Tracked
fields are the precondition: without them, a history table has no columns, and under US-012
PRODUCT 1's literal reading, ingestion stores nothing for the ETF. So the missing configuration
is the cause to show. A dedicated `EtfDetail.test.tsx` case proves this precedence.

## 5. Risks
- **R1: `notFound()` swallowed by the error handler.** `notFound()` works by throwing. Inside
  the `try` it would turn a 404 into the error state. §4.3 keeps it outside, and two page tests pin
  this: loader returns `null` → sentinel thrown; loader throws → `notFound` not called.
- **R2: Date type differs by driver.** Solved in SQL with `to_char` (§4.1). A PGlite test asserts
  `typeof reportDate === "string"` and the exact `YYYY-MM-DD` value. It runs in any process time
  zone, so no TZ matrix is needed, because no `Date` is involved.
- **R3: US-016 test churn.** `HomeTable.test.tsx` line 53,
  `expect(html.match(/<a /g)).toHaveLength(1)`, becomes false once history links exist (3 `<a>`).
  Replace it with two assertions at least as strong: exactly one PDF link
  (`/<a [^>]*target="_blank"/g` → 1, still only on `BTBETRETF`) and exactly two history links
  (`/href="\/etf\//g` → 2). `"<td>NOADAPTER<span>"` (line 52) stays true, because the link is added
  after the marker. The reviewer checks that no other US-016/US-017 assertion changed.
- **R4: Label rule differs from the home table (review N1).** The detail page uses the ETF's own
  `adapter_key`, as the story says. The home table uses the alphabetically first adapter. The labels
  are identical today (one adapter). The AC3(c) test uses two adapters to prove the story's rule.
  Revisit with US-029.
- **R5: Symbol encoding.** The home link uses `encodeURIComponent(symbol)`. BVB symbols are upper-case
  alphanumeric, so the href equals `/etf/<SYMBOL>` in practice, and the test asserts that literally.
  The page uses `params.symbol` as given, only as a bound parameter, with no decoding and no
  normalisation. That keeps "exact symbol" literal: lower case gives a 404.
- **R6: Unbounded rows.** One row per stored day per ETF, rendered in full. The story's Notes accept
  this. No pagination.
- Smallest design: one read model with three read-only statements in one batch, two presentational
  components, one page and one link. There is nothing for an adapter or plugin to extend. US-019
  consumes `EtfHistory` unchanged. It builds chart series from `fields` and `rows`, reversing
  `rows` for chronological order.

## 6. Decisions needed
None new. The non-blocking PRODUCT items are already recorded in sprint-04.md (#8 the separate
"Istoric" link, #9 omit missing days, #10 inactive ETF still reachable). This story implements
option A for each, as it says. For the PO's eye at the demo (copy, not a decision): the Romanian
wording of `Home.historyLink` and the three `EtfDetail` messages, and the placement of the link
next to the symbol.
