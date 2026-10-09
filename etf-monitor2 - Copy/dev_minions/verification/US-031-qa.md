# US-031 QA checklist — End-to-end verification on the real deployment

Complex story (whole-pipeline test through the cron handler, deployment smoke script, cron/infra,
7 ACs); plan by `story-planner` at `US-031-plan.md`, tech-lead review already binding on
`backlog/stories/US-031.md` (points 1-5).

Every acceptance criterion agent-drafted in `backlog/stories/US-031.md` — **PO to confirm.**

## Automated (already run this round — evidence in `US-031-review.md` / `US-031-tests.md`)

1. `pnpm install --frozen-lockfile` — exit 0.
2. `pnpm typecheck` — 0 errors.
3. `pnpm lint` — 0 errors, only pre-existing warnings.
4. `pnpm test` — full suite green (count in `US-031-tests.md`), including
   `test/e2e/daily-pipeline.pglite.test.ts` (DP-0..DP-3, offline, every network call goes through
   a fetch guard that rejects any URL outside the fixture map) and `lib/smoke/deploy.test.ts`
   (SM-1..SM-14, a mocked `fetch` only).
5. `pnpm build` and `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY -u CRON_SECRET pnpm build`
   — both succeed offline.
6. No new runtime dependency; `package.json` changed only in `scripts` (`smoke:deploy`).

## Manual / live (for the user, or Codex QA where it can reach the real deployment)

1. **Smoke.** In WSL: `export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt`, then
   `pnpm smoke:deploy https://etf-monitor2.vercel.app`, then `echo $?`. Expected: 20 `PASS` lines
   and `SUMMARY 20/20 passed`, exit code `0`, and no page text printed. `/chat` may show
   `note=Chat.replies.unavailable…` only if no AI provider or key is configured yet.
2. **RO/EN.** Switch the language with the header switcher on: home, `/etf/BTBETRETF`, `/chat`,
   `/health`, `/admin`, `/admin/etfs`, `/admin/etfs/BTBETRETF/fields`, `/admin/ai`, `/admin/cron`,
   `/admin/operations`. Expected: no raw translation key (e.g. `Home.loadError`) visible anywhere.
   Numbers show no thousands separator, decimal comma in RO / dot in EN (DEC-007).
3. **`/health`.** Shows "Connected"/"Conectat" with the ETF count and the field-catalogue count
   (16 catalogue rows after the Sprint 7 seed).
4. **One chat command per provider.** In `/admin/ai`, choose Gemini and its model; in `/chat`,
   send "also track VUAN for TVBETETF" — the reply is correct and in the current language, and
   `/admin/etfs` → TVBETETF → Fields lists it; undo with "stop tracking VUAN for TVBETETF" (or the
   fields page). Repeat with Groq.
5. **Scheduled cron run.** After the next **scheduled** run (not the Vercel dashboard's manual
   "Run"), `/admin/operations` shows a new run whose start time is inside the `vercel.json` hour
   (shown on `/admin/cron`), with one translated line per active ETF.
6. **No secret in the logs.** Vercel → project → Logs, filtered on `/api/cron/daily` for that run
   and on one `/chat` POST. No API key, `CRON_SECRET` or `DATABASE_URL` value (or part of one,
   e.g. the Neon host or password) appears anywhere.
7. **Duration.** Vercel → project → Logs (or Observability) → that cron invocation's duration.
   Expected: well under 60 s. Record the number in `US-031-qa-run.md`.

If Vercel Deployment Protection is enabled on the production deployment, step 1 correctly fails
with `401` or a redirect on every page — that is the protection working, not a smoke-check bug.

## Files changed

- new: `test/e2e/daily-pipeline.pglite.test.ts`, `test/e2e/fixture-web.ts`
- new: `lib/smoke/deploy.ts`, `lib/smoke/deploy.test.ts`, `scripts/smoke-deploy.ts`
- new: `lib/ingestion/default-deps.seam.test.ts`, `lib/cron/default-deps.seam.test.ts`
- new: `app/health/page.failure.test.tsx`
- new: `dev_minions/verification/US-031-qa.md` (this file)
- changed: `lib/ingestion/default-deps.ts` (`DatabaseAccess` type; `createDailyRunDeps` and
  `createDefaultJobRunStore` take an optional `database`, unchanged no-argument production path)
- changed: `lib/cron/default-deps.ts` (`createDailyCronDeps(options)`; `defaultDailyCronDeps` built
  from it with no arguments)
- changed: `lib/health.ts` (`HEALTH_QUERY_TIMEOUT_MS = 8_000`, `HealthStatus` timeout member,
  `getHealthStatus` races a timer, swallows a late rejection, clears the timer), `lib/health.test.ts`
  (HC-1..HC-4 appended)
- changed: `app/health/page.tsx` (renders `Health.dbTimeout` for the timeout state only;
  `loadHealthStatus` and the existing error rendering unchanged, sprint decision 12 default)
- changed: `messages/en.json`, `messages/ro.json` (`Health.dbTimeout`)
- changed: `components/FieldChart.test.tsx` (FC-TT1..FC-TT4 appended — calls the actual `content`
  Recharts' `Tooltip` receives, not `ChartTooltipContent` directly)
- changed: `package.json` (`scripts["smoke:deploy"]` only), `README.md` ("Deployment smoke check"
  section, `/health` timeout note)
- unchanged (still green, unedited): `app/api/cron/daily/route.ts` + test, `lib/cron/daily-handler.ts`
  + test, `lib/cron/daily-job.ts`, `lib/cron/default-deps.test.ts`, `lib/ingestion/default-deps.test.ts`,
  `lib/ingestion/default-deps.cron.test.ts`, `app/health/page.test.tsx`, `components/FieldChart.tsx`,
  `drizzle/`, `dev_minions/architecture/data-model.md`
