# US-017 — QA checklist

Round 1: review PASS (`US-017-review.md`), tests PASS (`US-017-tests.md`). No fix loop needed.

## Automated (already run, no live resource)
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` (with and without `DATABASE_URL`) — all green.
  706/706 tests, including 30 new `lib/monitoring/delta.test.ts`, 10 new `lib/format/delta.test.ts`,
  11 new `lib/monitoring/home-delta.pglite.test.ts`, and extended `HomeTable.test.tsx`/`home.pglite.test.ts`.
- No live BVB/Neon/Vercel call in any test — the read model runs on PGlite (`test/fixtures` not needed,
  no PDF/network involved in this story).

## Manual (live, user or Codex QA loop)
1. **sprint-04.md step 3** (needs `ok` reports on two consecutive calendar days in Neon):
   - Pick one monitored ETF and one tracked field on the home table.
   - Open the PDF linked for the shown date and the PDF for the day before.
   - Check by hand: the absolute delta shown equals the exact difference of the two PDFs' values
     (same digits as stored, no rounding beyond what's stored); the percentage is `(current -
     previous) / |previous| * 100`, rounded to 2 decimals, half away from zero.
   - Check the sign (`+`/`-`, none for zero) and the DEC-007 format in both `ro` (comma) and `en` (dot).
   - If the shown report is a Sunday catch-up filing (US-012 PRODUCT 2's literal reading), the delta
     is expected to be blank — that is correct, not a defect.
2. **PO to confirm drafted/product copy** (non-blocking, agent-authored):
   - The Romanian wording of the two new `title` labels: `Home.deltaAbsolute` = "Variație absolută
     față de ziua anterioară", `Home.deltaPercent` = "Variație procentuală față de ziua anterioară".
   - The two non-blocking PRODUCT decisions this story implements as their recommended option
     (sprint-04.md #6 "previous day" = calendar day before, option A; #7 delta display = signed,
     2-decimal percent, no colour, option A) — confirm at the demo, not blocking.

## Files changed
- New: `lib/monitoring/delta.ts`, `lib/monitoring/delta.test.ts`
- New: `lib/format/delta.ts`, `lib/format/delta.test.ts`
- New: `lib/monitoring/home-delta.pglite.test.ts`
- Edit: `lib/monitoring/home.ts`, `lib/monitoring/home.pglite.test.ts`
- Edit: `components/HomeTable.tsx`, `components/HomeTable.test.tsx`
- Edit: `app/page.test.tsx`
- Edit: `messages/ro.json`, `messages/en.json`
