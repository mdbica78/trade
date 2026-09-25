# US-018 — QA checklist

Round 1: review PASS (`US-018-review.md`), tests PASS (`US-018-tests.md`). No fix loop needed.

## Automated (already run, no live resource)
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` (with `DATABASE_URL` unset) — all green.
  744/744 tests, including 17 new `lib/monitoring/history.pglite.test.ts`, 5 new
  `components/HistoryTable.test.tsx`, 8 new `components/EtfDetail.test.tsx`, 7 new
  `app/etf/[symbol]/page.test.tsx`, and 2 new AC2 tests in `components/HomeTable.test.tsx`.
- `pnpm build` output confirms `ƒ /etf/[symbol]` — dynamic, never statically prerendered, so a
  missing `DATABASE_URL` at build time cannot bake a stale page.
- No live BVB/Neon/Vercel call in any test — the read model runs on PGlite.

## Manual (live, user or Codex QA loop)
1. **sprint-04.md step 6** (the history table part; the charts are US-019):
   - On the deployed home page, each row shows the "Istoric" link next to the symbol. Clicking
     the symbol still opens the newest PDF in a new tab (unchanged from US-016/US-017).
   - Click "Istoric" for BTBETRETF → `/etf/BTBETRETF`. Heading shows the symbol and the stored
     name. One row per stored `ok` report date, newest first, with the ETF's tracked-field
     columns. Dates `dd.MM.yyyy`, values with a decimal comma, no grouping (ro). Compare the
     newest row against the home-table row: same date, same values.
   - Switch to EN: ISO dates, decimal dot, translated headers.
   - Open `/etf/NOPE` → a 404 page.
   - Optional cross-check: `select report_date from reports r join etfs e on e.id = r.etf_id
     where e.symbol = 'BTBETRETF' and r.status = 'ok' order by report_date desc;` matches the
     table's dates exactly.
2. **Codex QA loop, local (`scripts/claude/qa-serve.sh`, no `DATABASE_URL`)**: `/etf/BTBETRETF`
   and `/etf/NOPE` both show the translated error message, not a crash or a 404 — without a
   database the app cannot tell an unknown symbol from a known one, so no 404 is expected
   locally. This is expected behaviour, not a defect.
3. **PO to confirm drafted/product copy** (non-blocking, agent-authored):
   - Romanian wording: `Home.historyLink` = "Istoric"; `EtfDetail.dateColumn` = "Dată";
     `EtfDetail.noHistory` = "Nu există încă istoric pentru acest ETF.";
     `EtfDetail.noTrackedFields` = "Acest ETF nu are câmpuri urmărite."
   - The three non-blocking PRODUCT decisions this story implements as their recommended option
     (sprint-04.md #8 separate "Istoric" link, #9 omit missing days, #10 inactive ETF page still
     reachable) — confirm at the demo, not blocking.

## Files changed
- New: `lib/monitoring/history.ts`, `lib/monitoring/history.pglite.test.ts`
- New: `app/etf/[symbol]/page.tsx`, `app/etf/[symbol]/page.test.tsx`
- New: `components/HistoryTable.tsx`, `components/HistoryTable.test.tsx`
- New: `components/EtfDetail.tsx`, `components/EtfDetail.test.tsx`
- Edit: `components/HomeTable.tsx`, `components/HomeTable.test.tsx`
- Edit: `messages/ro.json`, `messages/en.json`
