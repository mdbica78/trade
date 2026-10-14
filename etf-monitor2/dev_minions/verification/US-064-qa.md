# US-064 QA checklist — Daily job time applied by Vercel itself

## Automated checks

1. In a clean local checkout, run `pnpm install --frozen-lockfile`.
2. With `DATABASE_URL`/`CRON_SECRET`/`VERCEL_ENV`/`AI_KEY_MASTER_KEY`/`VERCEL_DEPLOY_HOOK_URL` all
   unset, run: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
   Expected: all four gates exit 0; the build reports `migrate-on-deploy: skipped` and generates
   all 12 dynamic routes, including `/admin/cron` and `/api/cron/daily`.
3. Confirm the offline build never executes `vercel.ts`: capture the build output and run
   `grep -c "\[vercel.ts\]"` against it. Expected: `0` — `vercel.ts` is only type-checked by
   `next build`'s TypeScript pass (per its own `tsconfig` `include`), never imported or run by the
   app or the build script.
4. Run the US-064 test selectors: `lib/config/cron-build.test.ts`, `lib/config/cron-apply.test.ts`,
   `lib/config/cron-apply.pglite.test.ts`, `lib/cron/vercel-config.test.ts`,
   `lib/config/cron.test.ts`, `lib/config/cron.pglite.test.ts`, `app/admin/cron/actions.test.ts`,
   `app/admin/cron/result-messages.test.ts`, `app/admin/cron/page.test.tsx`,
   `components/admin/ActionMessage.test.tsx`, `lib/ai/env-example.test.ts`,
   `test/e2e/daily-pipeline.pglite.test.ts` (DP-5), `lib/config/boundaries.test.ts` (BC-13/BC-14),
   `app/load-error.boundary.test.ts` (LB-E5). Expected: all pass — valid/invalid hour resolution
   with retry-then-default/throw behaviour, no `DATABASE_URL`/`VERCEL_DEPLOY_HOOK_URL` ever logged
   or thrown, save-then-redeploy-only-if-the-hour-changed ordering, a hook failure never rolling
   back the save, and the old pre-redeploy-window schedule staying `skipped: not_scheduled_hour`
   (DP-5) after a new hour is saved.
5. Confirm `vercel.json`, `.github/workflows/daily-ping.yml`, and
   `test/e2e/daily-ping-workflow.test.ts` are all absent from the working tree, and that no
   production code or message catalogue still references `effectiveSchedule`/`findDailySchedule`/
   `parseDailySchedule`/`pingHeading`/`pingText`/`pingRule`/`safetyNet`/`safetyNetHour`.
6. Confirm `.env.example` documents `VERCEL_DEPLOY_HOOK_URL=` with an explanatory comment, and that
   `README.md`'s "Daily ingestion (cron)" section describes the Vercel-native schedule, the
   one-time Deploy Hook setup step, and the Hobby-window honesty note (no GitHub Actions ping
   wording remains).

## Live checks — user only (never claim these passed from an automated run)

7. **AC0 / spike S1 (MANUAL-QA, cannot be verified offline):** after the push below, open the
   Vercel deployment's build log and confirm a line reading
   `[vercel.ts] daily cron hour <h> UTC (source: db|default)`. Then open Vercel → Settings →
   Cron Jobs and confirm it lists `/api/cron/daily` with schedule `0 <h> * * *` matching the hour
   stored in `settings.cron_hour_utc` (or `10` if unset). If this does not match, the story is
   BLOCKED and `tech-lead` picks DEC-031's Plan B or C — do not re-attempt or patch around it.
8. Save a new hour from `/admin/cron` on the deployed app and confirm the result message matches
   one of `cronSavedApplying` / `cronSavedNotConfigured` / `cronSavedApplyFailed` depending on
   whether `VERCEL_DEPLOY_HOOK_URL` is set in Vercel's Production environment. After a successful
   apply, repeat step 7 to confirm the new hour took effect on the next build.
9. Confirm the `/admin/cron` page shows the Hobby-window sentence and the "takes effect after the
   next deploy, about two minutes" note in both Romanian and English, and that no ping/safety-net
   text remains.

## User-only setup and cleanup (not a dev-loop blocker, DEC-015)

1. Vercel → Settings → Git → Deploy Hooks: create one on the production branch; add its URL as
   the Production environment variable `VERCEL_DEPLOY_HOOK_URL`.
2. Push, then do live checks 7–9 above.
3. Delete the repo-root workflow copy `../.github/workflows/etf-monitor2-daily-ping.yml` (outside
   the project folder; no agent touches it) and, optionally, the GitHub repository secrets
   `ETF_MONITOR_BASE_URL`/`CRON_SECRET` used only by the old ping workflow (the Vercel env var
   `CRON_SECRET` itself must stay — it is still used by the route's bearer check and by key
   encryption).

## Files changed

New (source): `lib/config/cron-build.ts`, `vercel.ts`, `lib/config/cron-apply.ts`.
New (tests): `lib/config/cron-build.test.ts`, `lib/config/cron-apply.test.ts`,
`lib/config/cron-apply.pglite.test.ts`.
Changed (source): `lib/config/cron.ts`, `app/admin/cron/actions.ts`,
`app/admin/cron/result-messages.ts`, `app/admin/cron/page.tsx`, `components/admin/CronAdmin.tsx`,
`messages/en.json`, `messages/ro.json`, `README.md`, `.env.example`,
`dev_minions/architecture/data-model.md`.
Changed (tests): `lib/config/cron.test.ts`, `lib/config/cron.pglite.test.ts`,
`lib/config/boundaries.test.ts`, `lib/cron/vercel-config.test.ts`,
`app/admin/cron/actions.test.ts`, `app/admin/cron/result-messages.test.ts`,
`app/admin/cron/page.test.tsx`, `components/admin/ActionMessage.test.tsx`,
`lib/ai/env-example.test.ts`, `test/e2e/daily-pipeline.pglite.test.ts`,
`app/load-error.boundary.test.ts`.
Deleted: `vercel.json`, `.github/workflows/daily-ping.yml`, `test/e2e/daily-ping-workflow.test.ts`.

No schema/migration change, no new dependency. No live resource, secret, Git or deploy command
was used while producing this checklist or its evidence.
