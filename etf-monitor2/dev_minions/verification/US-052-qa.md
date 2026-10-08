# US-052 — QA checklist

## Decision and evidence exception

On 2026-10-05, the user accepted the disclosed missing pre-edit line-count baseline
and authorized US-052 to proceed to QA (DEC-024). The independent Round 1 review
and test verdicts remain unchanged and record AC6 as NOT MET. This PO-approved
exception is not a claim that the missing baseline exists: HANDOVER records the
post-edit counts, but no before/after reduction is claimed.

## Checks for Codex QA

1. Run the frozen install and project gates with database, cron, deployment,
   master-key and provider variables unset:
   `pnpm install --frozen-lockfile`; `pnpm typecheck`; `pnpm lint`;
   `pnpm test`; `pnpm build`. Expect all gates to pass, lint to report no errors,
   and the offline build to generate all 12 dynamic routes without applying a
   production migration.
2. Run the focused US-052 regression coverage, including admin actions/pages,
   result messages, load-error boundaries, configuration and monitoring,
   golden admin markup, CSS/token/contrast/color-literal checks, and the
   tracked-fields PGlite suite. Expect all tests to pass; do not use snapshot
   update mode.
3. Serve locally without a database and spot-check `/`, `/etf/<symbol>`,
   `/admin`, `/admin/etfs`, `/admin/ai`, `/admin/cron`,
   `/admin/operations`, `/admin/etfs/<symbol>/fields`, and `/chat` in Romanian
   and English. Expect safe translated no-database states where applicable;
   the `/admin` navigation appears once, header/theme/admin form markup remains
   unchanged, and no raw exception or secret is exposed.
4. Where a tracked-field row is available, verify a malformed move direction
   receives the existing localized invalid-direction message (the explicitly
   permitted D7 change); ordinary valid actions retain their existing results.
5. Confirm the review/test Round 1 reports are retained as written, with AC6
   NOT MET, and this user-authorized exception is recorded in DEC-024. Do not
   report the absent baseline as recovered or calculate a total reduction that
   includes US-052.
6. No live Neon, BVB, Vercel, stored-key, or provider step is required.

## Files changed

Plan and status: `dev_minions/verification/US-052-plan.md`,
`dev_minions/verification/US-052-review.md`,
`dev_minions/verification/US-052-tests.md`,
`dev_minions/verification/US-052-qa.md`, `dev_minions/HANDOVER.md`,
`dev_minions/status.md`, `dev_minions/decisions/DEC-024-us-052-line-count-baseline.md`,
`dev_minions/decisions/README.md`.

Source: `app/admin/run-action.ts`, `app/admin/etfs/actions.ts`,
`app/admin/cron/actions.ts`, `app/admin/ai/actions.ts`,
`app/admin/etfs/[symbol]/fields/actions.ts`, `app/admin/etfs/page.tsx`,
`app/admin/ai/page.tsx`, `app/admin/cron/page.tsx`,
`app/admin/operations/page.tsx`, `app/admin/etfs/[symbol]/fields/page.tsx`,
`app/admin/page.tsx`, `app/admin/etfs/result-messages.ts`,
`app/home-display-actions.ts`, `app/globals.css`, `components/Icon.tsx`,
`components/HeaderNav.tsx`, `components/ThemeToggle.tsx`,
`components/admin/action-state.ts`, `components/admin/ActionForm.tsx`,
`components/admin/EtfAdmin.tsx`, `components/admin/AiSettingsAdmin.tsx`,
`components/admin/CronAdmin.tsx`, `components/admin/ProviderKeySaveForm.tsx`,
`components/admin/TrackedFieldsAdmin.tsx`, `lib/log/load-error.ts`,
`lib/extraction/adapters/types.ts`, `lib/config/etfs.ts`,
`lib/config/tracked-fields.ts`, `lib/config/default-deps.ts`,
`lib/config/cron.ts`, `lib/config/detect-adapter.ts`,
`lib/admin/operations.ts`, `lib/monitoring/history.ts`,
`lib/monitoring/home.ts`.

Tests and snapshots: `components/admin/admin-markup.golden.test.tsx`,
`components/admin/__snapshots__/admin-markup.golden.test.tsx.snap`,
`app/admin/page.test.tsx`, `app/admin/etfs/actions.test.ts`,
`app/admin/cron/actions.test.ts`, `app/admin/cron/page.test.tsx`,
`app/admin/etfs/[symbol]/fields/actions.test.ts`,
`app/home-display-actions.pglite.test.ts`, `app/globals.home-table.test.ts`,
`app/load-error.boundary.test.ts`, `lib/config/etfs.test.ts`,
`lib/config/etfs.pglite.test.ts`, `lib/config/tracked-fields.pglite.test.ts`.
