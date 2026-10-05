# US-052 plan: simplify admin, configuration, header and stylesheet

> Copilot, 2026-10-05. Binding sources: `backlog/stories/US-052.md`,
> `backlog/sprints/sprint-12.md`, and `verification/CODE-REVIEW-20261004.md`
> ("Rules for every Sprint 12 story" and §D items 1-13). All choices are settled;
> preserve behavior except D4 (one admin navigation) and D7 (invalid direction message).

## Findings and implementation order

1. D1-D3: inspect action/page result and logging tests first. Add `AdminAction` in
   `components/admin/action-state.ts`, `runAdminAction` in `app/admin/run-action.ts`,
   and `loadOrError` in `lib/log/load-error.ts`; migrate each admin action/page without
   changing result codes, text, log scopes, or logged-error behavior.
2. D4: remove the duplicate `AdminNav` from `app/admin/page.tsx`; retain the layout nav.
3. D5-D7: inspect `tracked-fields`, ETF detection, history/home registry and action tests.
   Centralize field-key normalization and `isAdapterRegistered`; make `listFieldsForEtf`
   build once; make `untrackField` one batch; validate move direction in `lib/config` once,
   preserving all other outcomes and using the approved invalid-direction message.
4. D8-D9: inspect default-deps and cron tests; replace the duplicate config-deps factories
   with `createDbDeps`, and centralize hour validation in `isHour` without changing RangeErrors.
5. D10-D11: inspect existing component/HTML assertions, then capture baseline snapshots
   before source edits for header, theme toggle, and tracked-field forms. Extract local
   `FieldActionForm` and an `Icon` wrapper while preserving serialized markup/attribute order.
6. D12-D13: inspect theme/CSS and config/admin tests; remove only the specifically listed
   dead/inherited CSS declarations and duplicate radius, and apply the small normalizer,
   discriminated-result, revalidation, and cron destructuring simplifications.
7. For any finding contradicted by a test seam, do not alter that behavior test or its
   production seam; record `skipped: <item>, reason: <evidence>` in HANDOVER.
8. Record deliberate test changes individually, and `wc -l` before/after for each touched
   source file before closing the story.

## Verification

- Preserve and run the action/result-message tests under `app/admin/**`, page tests under
  `app/admin/**`, `lib/config/{etfs,tracked-fields,cron,default-deps,detect-adapter}.test.*`,
  `lib/config/boundaries.test.ts`, `lib/admin/operations*.test.*`,
  `lib/monitoring/{history,home}*.test.*`, `components/admin/*.test.*`,
  `components/{HeaderNav,ThemeToggle}.test.*`, `app/globals.*.test.*`, and
  `app/colour-literals.test.ts`.
- New baseline snapshots must pass before implementation and match afterward without update.
- Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and
  `bash scripts/claude/predeploy-check.sh`; keep DB, deploy and provider/key variables unset.
- AC4 is proved by unchanged serialized snapshots plus all existing relevant tests; AC5 by the
  existing CSS/token/contrast/colour-literal suite and the one-batch PGlite assertions.
