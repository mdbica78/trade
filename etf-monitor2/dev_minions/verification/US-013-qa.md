# US-013 — QA checklist (Daily cron endpoint and Vercel Cron configuration)

Round 1: review PASS, tests PASS (486/486 total, 14 new US-013-specific tests). No fix loop.
See `US-013-review.md` / `US-013-tests.md` for full evidence. All ACs drafted by `story-planner`
and reviewed by `tech-lead` at sprint-review 3 — no PO-confirm markers on this story's criteria.

## Automated (already verified by this loop, no action needed)
- AC1 (auth), AC2 (every active ETF processed, ordered), AC3 (isolation), AC4 (no retries),
  AC5 (`vercel.json` single entry `0 10 * * *`), AC6 (response shapes + secret redaction),
  AC7 (route exports, `pnpm build` succeeds with `unpdf` bundled via `serverExternalPackages`),
  AC8 (README content, guarded by `vercel-config.test.ts` VC-8), AC10 (typecheck/lint/test/build).

## MANUAL-QA (AC9) — live Vercel/Neon, for the Codex QA/Deploy loop or the user
1. Vercel → project → Settings → Functions: note whether **Fluid compute** is on. Deploy must
   succeed with `maxDuration = 60` either way. Rejection over `maxDuration` is a FAIL.
2. Vercel → Settings → Cron Jobs: exactly one job, path `/api/cron/daily`, schedule `0 10 * * *`.
3. `curl -s -o /dev/null -w "%{http_code}\n" https://<app>.vercel.app/api/cron/daily` → `401`;
   same with `-H "Authorization: Bearer wrong"` → `401`.
4. `curl -s -H "Authorization: Bearer <CRON_SECRET>" https://<app>.vercel.app/api/cron/daily`
   → `200` with one `etfs` entry per seeded ETF (`ok` first call, `already_ingested` on a
   same-day repeat). Confirm new `reports`/`report_values` rows in Neon; open each `source_url`
   and compare date/values with the PDF. This is also the live proof of US-012's atomic
   `db.batch` write and of `unpdf` running inside the deployed function.
5. Vercel → project → Logs: the manual run's duration is well under 60 s.
6. On a following day, with no manual action: a new invocation appears in Vercel's logs between
   10:00–10:59 UTC, and on a business day new `reports` rows appear (`job_runs` rows arrive with
   US-015, not this story).
- Optional local variant: `pnpm dev` + `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily`
  with `DATABASE_URL`/`CRON_SECRET` in `.env.local`.

## Non-blocking notes carried from review
- `default-deps.cron.test.ts` was split out from `default-deps.test.ts` to isolate a partial
  module mock; safe (both pass together and separately) but undocumented in-file.
- Auth uses `timingSafeEqual` over SHA-256 digests rather than literally "equal-length buffers"
  as the plan's snippet showed — stronger, not weaker.
- Two test bugs found and fixed during this loop's own local-check pass (not code defects):
  a `load-etfs.test.ts` mock missing a typed parameter, and one extra unused SQL bind parameter
  in `load-etfs.pglite.test.ts`. A third finding, `daily-handler.test.ts` H-1e, was a genuinely
  wrong test expectation (trailing-space bearer header) invalidated by the Fetch `Headers`
  spec's whitespace stripping — fixed the assertion (401 → 200), not the handler; independently
  re-verified in review against the real `Request`/`Headers` API, not just this handler.

## Files changed
- `README.md`
- `app/api/cron/daily/route.ts`, `app/api/cron/daily/route.test.ts`
- `lib/cron/daily-handler.ts`, `lib/cron/daily-handler.test.ts`
- `lib/cron/default-deps.ts`
- `lib/cron/vercel-config.test.ts`
- `lib/ingestion/default-deps.ts`, `lib/ingestion/default-deps.test.ts`, `lib/ingestion/default-deps.cron.test.ts`
- `lib/ingestion/load-etfs.ts`, `lib/ingestion/load-etfs.test.ts`, `lib/ingestion/load-etfs.pglite.test.ts`
- `lib/ingestion/run-daily.ts`, `lib/ingestion/run-daily.test.ts`
- `next.config.ts`
- `vercel.json`
