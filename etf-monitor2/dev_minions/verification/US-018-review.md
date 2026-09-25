# US-018 — ETF detail page: historical values table — Independent review

## Round 1 — 2026-09-25

VERDICT: PASS

Reviewed against `dev_minions/backlog/stories/US-018.md` (AC1-AC10) and
`dev_minions/verification/US-018-plan.md`. Read every file listed under "Files changed" in
`dev_minions/HANDOVER.md` in full: `lib/monitoring/history.ts`, `lib/monitoring/history.pglite.test.ts`,
`app/etf/[symbol]/page.tsx`, `app/etf/[symbol]/page.test.tsx`, `components/HistoryTable.tsx`,
`components/HistoryTable.test.tsx`, `components/EtfDetail.tsx`, `components/EtfDetail.test.tsx`,
`components/HomeTable.tsx` (diff), `components/HomeTable.test.tsx` (diff), `messages/ro.json`,
`messages/en.json`. Cross-checked supporting context not in the change list but load-bearing:
`lib/monitoring/home.ts`, `lib/ingestion/store.ts`, `lib/db/schema.ts`, `lib/db/index.ts`,
`test/helpers/pglite.ts`, `lib/format/number.ts`, `lib/format/date.ts`, `i18n/messages.test.ts`,
`app/page.tsx`. Grepped the repo for the story's new symbols (`EtfDetail`, `HistoryTable`,
`createEtfHistoryLoader`, `historyLink`) — every hit is exactly one of the files in the "Files
changed" list; no scope creep outside it.

Ran `pnpm typecheck` (clean) and `pnpm lint` (0 errors; 3 pre-existing warnings unrelated to this
story: `lib/cron/default-deps.test.ts`, `lib/extraction/adapters/types.test.ts`,
`lib/ingestion/load-etfs.test.ts` unused-var warnings, already logged in HANDOVER's "Waiting on the
user" history). I did not re-run `pnpm test`/`pnpm build` myself (out of this review's permitted
tool scope); AC9/AC10's test-count and build-output claims rely on the implementer's/tester's
report — flagged below, not blocking.

### Acceptance criteria

- **AC1 — Route.** MET. `app/etf/[symbol]/page.tsx:8-16` awaits `params`, calls
  `createEtfHistoryLoader(getDb())(symbol)`; `null` → `notFound()` called strictly outside the
  `try` (`page.tsx:24-26`). Exact-match lookup in SQL: `lib/monitoring/history.ts:18-24`
  (`where "e"."symbol" = ${symbol}`, no `lower()`/`trim()`). Proven by
  `history.pglite.test.ts:90-95` (lower-case and trailing-space both give `null`) and
  `page.test.tsx:46-67` (heading shows symbol+name; unknown symbol calls `notFound()` exactly
  once, `NOPE`). Bound-parameter proof at `history.pglite.test.ts:105-109`
  (`params` contains `"SYM"`, `sqlText` does not) — satisfies the story's Notes instruction
  literally, in SQL not just behaviour.

- **AC2 — Navigation from the home table.** MET. `components/HomeTable.tsx:46-57`: the PDF `<a>`
  (unchanged, still wraps only the symbol, `target="_blank"`) and a new `next/link` `<Link
  href="/etf/...">` sit in the same `<td>` as two distinct elements. Proven by
  `HomeTable.test.tsx:59-69` (`href="/etf/BTBETRETF"`, `href="/etf/NOADAPTER"` both present, PDF
  `<a>` markup byte-checked unchanged) and the tightened count assertions at lines 55-56 (exactly
  one PDF link, exactly two history links). The `NOADAPTER` row (no PDF) still gets the history
  link, confirmed at line 63.

- **AC3 — History table.** MET.
  - Newest-first: `history.pglite.test.ts:116-124` (AC3(a), out-of-order insertion still
    yields newest-first).
  - Column order `display_order` then `field_key`: `history.pglite.test.ts:126-133` (AC3(b)).
  - Own-adapter label, `field_key` fallback: `history.pglite.test.ts:135-153` (AC3(c), two
    adapters sharing a `field_key` resolve to the ETF's own adapter's label; no catalogue row or
    `NULL adapter_key` falls back correctly).
  - Untracked field never appears: enforced in SQL, not just TS — the `report_values` join is
    itself restricted to tracked keys (`history.ts:54-55`,
    `"rv"."field_key" in (select ... from "tracked_fields" ...)`), matching the story's Notes
    instruction that the reviewer check the SQL. Proven end-to-end at
    `history.pglite.test.ts:155-169` (a stored-but-untracked `net_asset` value is absent from
    `JSON.stringify(result)` entirely).
  - Missing value → empty cell: `history.pglite.test.ts:171-182` (AC3(e)) and
    `HistoryTable.test.tsx:37-40` (`<td>2026-09-21</td><td></td>` verbatim).
  - `formatNumber`/DEC-007: `HistoryTable.test.tsx:33-34,47-56` (decimal comma/dot, no grouping
    character in either locale, on a 10-digit value).

- **AC4 — Missing days never filled.** MET. `history.pglite.test.ts:194-207`: `ok` reports on
  09-21 and 09-23 only give exactly `["2026-09-23", "2026-09-21"]`, and the 09-23 row's
  `units_in_circulation` (present on 09-21, not on 09-23) is `null`, not carried forward — this
  is the "no carried-forward number" case the story's AC4 explicitly calls out.

- **AC5 — Only `ok` reports.** MET. `history.pglite.test.ts:209-228`: a `parse_error` report
  carrying a stored value of `999`, plus raw `missing` and `no_adapter` rows (inserted directly,
  since `saveReport`'s type only allows `ok`/`parse_error` — a deliberate, documented test-only
  path, not a product gap), are all excluded; `"999"` is absent from the serialized result. An
  ETF whose only report is `parse_error` yields `rows: []`.

- **AC6 — States.** MET.
  - No `ok` report → `EtfDetail.tsx:30-31` renders `t("noHistory")`, no table; heading still
    shown (`EtfDetail.test.tsx:46-52`).
  - No tracked fields → `EtfDetail.tsx:28-29` renders `t("noTrackedFields")`, no table
    (`EtfDetail.test.tsx:54-59`); the plan's §4.4 precedence (both empty → `noTrackedFields`
    alone) is proven at `EtfDetail.test.tsx:61-66`.
  - DB read throws → `page.tsx:8-15`'s `try/catch` maps any error to `{status:"error"}`;
    `EtfDetail.tsx:17-19` renders only `t("loadError")`. Proven with a realistic connection-string
    exception (`page.test.tsx:69-79`, checks the message, `postgres://` and the literal word
    `secret` are all absent) and a dedicated `DATABASE_URL`-shaped-marker test that sets and
    restores the env var (`page.test.tsx:81-94`) — this is exactly the "no environment value"
    half of AC6, not just "no exception text". `notFound()` is asserted not called in the error
    path (`page.test.tsx:78`), so a DB error can never accidentally look like a 404.

- **AC7 — Deactivated ETF.** MET. `lib/monitoring/history.ts:18-24`'s ETF lookup has no
  `is_active` filter (unlike `home.ts:49`'s `where "e"."is_active" = true`), so an inactive ETF's
  page still loads its full history — proven at `history.pglite.test.ts:230-239` (`is_active =
  false`, one row present) and `EtfDetail.test.tsx:68-72` (table still renders). Home-table
  exclusion of inactive ETFs is unchanged (`home.ts` is not in the Files-changed list, and
  reading it confirms the `is_active = true` filter is untouched) — correctly cited to
  US-016's own test rather than re-proven here.

- **AC8 — Bilingual.** MET. New keys (`Home.historyLink`, `EtfDetail.dateColumn/noHistory/
  noTrackedFields/loadError`) present with equal, non-empty values in both `messages/ro.json` and
  `messages/en.json`; `i18n/messages.test.ts`'s key-parity test (`collectKeyPaths` equality, plus
  the non-empty-leaf check) covers the new namespace automatically since it iterates the whole
  tree. `ro`/`en` render tests: date format and decimal mark verified at
  `HistoryTable.test.tsx:29-35`; the stored ETF name shown byte-identical, untranslated, in both
  locales at `EtfDetail.test.tsx:39-44`. Cross-locale-leak guards present in both
  `EtfDetail.test.tsx:74-80` and `page.test.tsx:105-120`.

- **AC9 — Offline and build-safe.** MET as far as independently checkable here. Every read-model
  test runs through `createTestDatabase()`/PGlite, executing the exact shipped `db.execute(sql...)`
  statements via the injected `BatchRunner` (`history.pglite.test.ts` imports
  `createEtfHistoryLoader` and `buildHistoryEtfStatement` directly from `lib/monitoring/history.ts`,
  no re-implementation). The page test mocks `@/lib/db` and `@/lib/monitoring/history` entirely — no
  Neon import reachable in that test file. The one test that touches `process.env.DATABASE_URL`
  sets and restores it inside a `try/finally` and never actually opens a connection. I did not
  independently re-run `pnpm build` with `DATABASE_URL` unset (outside my permitted tool scope for
  this review); HANDOVER.md records the implementer confirmed `ƒ /etf/[symbol]` (dynamic) in the
  build output, consistent with the plan's design (no `generateStaticParams`, layout reads
  `cookies()` via next-intl). Noting this as unverified-by-me rather than assuming it passes.

- **AC10 — Gates.** `pnpm typecheck` and `pnpm lint` independently re-run here: both clean (lint's
  3 warnings are pre-existing and unrelated to this story's files). `pnpm test`/`pnpm build`
  not re-run by me (see AC9); HANDOVER.md claims 744/744 tests and a clean `DATABASE_URL`-unset
  build.

### Findings

None Critical. None Warning-level that would change a verdict.

Notes (non-blocking):
1. `app/etf/[symbol]/page.test.tsx:96-103`'s test name says "getDb() itself throwing (e.g.
   MissingDatabaseUrlError)", but the mock setup (`vi.mock("@/lib/monitoring/history", () => ({
   createEtfHistoryLoader: () => mockLoad }))`) means it actually exercises `mockLoad` (the
   returned loader function) throwing synchronously, not `getDb()`. Both failure points are
   inside the same `try` in `page.tsx:8-15`, so the guarantee the test wants to prove (a
   synchronous throw anywhere in the load path is caught) still holds — this is a documentation/
   naming mismatch in the test, not a coverage gap.
2. `EtfDetail.test.tsx`'s "no tracked fields" case (line 54-59) doesn't assert the heading is
   still present, unlike the "no ok report" case (line 46-52) which does. The code path
   guarantees the heading unconditionally for `status: "ok"` regardless of which branch fires
   (`EtfDetail.tsx:23-36`), so this is a minor test asymmetry, not a defect.
3. AC9/AC10's `pnpm test`/`pnpm build` results are reported by HANDOVER.md, not independently
   re-run in this review (typecheck/lint only, per this review's tool scope) — flagged for the
   story-tester's independent verdict to cover, not something I'm asserting as verified myself.

### Scope deviations

None. The "Files changed" list in HANDOVER.md is exactly what changed (grep-verified across the
whole repo for the story's new symbols); `lib/monitoring/home.ts`, `app/page.tsx`, the schema and
migrations are untouched as the plan promised. The `HomeTable.test.tsx` assertion the plan's R3
flagged as needing tightening was tightened into two assertions at least as strong as the
original (exact PDF-link count, exact history-link count), not weakened.
