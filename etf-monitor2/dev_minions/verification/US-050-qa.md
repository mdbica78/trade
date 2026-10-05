# US-050 — QA checklist

Round 1: independent review PASS (`US-050-review.md`), independent tests PASS (`US-050-tests.md`).
No Critical/Warning findings. Two non-blocking review Notes (redundant percent-sign guard in
`delta.ts`; a confirmation grep for reintroduced deleted symbols — both informational, no action).

This is a pure refactor (no new UI, no new route, no schema/migration change) — manual checks are
the existing regression-style spot checks, not new behaviour.

## Checks for Codex QA
1. `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test && pnpm build` —
   expect all green, 220 files / 2232 tests, offline build 12 dynamic routes, with
   `DATABASE_URL`/`CRON_SECRET`/`VERCEL_ENV`/`AI_KEY_MASTER_KEY`/`GEMINI_API_KEY`/`GROQ_API_KEY`
   unset.
2. Serve locally (no DB) and spot-check `/` in RO and EN: home table renders, delta arrows/colours
   unchanged, Customize panel opens and its three groups are unchanged from before this story
   (B5's allowed change: a tracked field with no catalogue row no longer appears in the panel —
   not visible without a crafted fixture, so nothing to see live).
3. `/etf/<symbol>` in RO and EN: history table and chart unchanged.
4. `/admin/*` pages unchanged (TrackedFieldsAdmin, OperationsDashboard labels still correct — B8's
   shared `localizedLabel` is behaviourally identical to the old inline ternary).
5. No live Neon/Vercel/AI step needed — this story touches no schema, no env var, no provider call.

## PO to confirm
- AC1–AC6 are all agent-drafted-and-confirmed against the Technical Lead's own review
  (`CODE-REVIEW-20261004.md` §B), not fresh PO-facing criteria — nothing new to confirm beyond the
  general "does the app still look/behave the same" check in step 2-4 above.

## Files changed
See `dev_minions/HANDOVER.md`'s "Active story" US-050 section, "Files changed (US-050)" list, for
the full new/changed/test-change file list (components/DeltaArrow.tsx, lib/format/label.ts,
lib/monitoring/panel-order.ts, lib/monitoring/home.ts, lib/monitoring/delta.ts,
lib/monitoring/exact-decimal.ts, lib/format/delta.ts, lib/format/delta-direction.ts,
components/HomeTable.tsx, components/CustomValues.tsx, components/HomeCustomizePanel.tsx,
components/HomePageBody.tsx, components/home-display-state.ts, components/HistoryTable.tsx,
components/EtfDetail.tsx, components/admin/TrackedFieldsAdmin.tsx,
components/admin/OperationsDashboard.tsx, plus every new/changed test file listed there).
