# etf-monitor2

A web app that monitors BVB-listed ETFs daily: for each monitored ETF it downloads the
latest depositary report (PDF), extracts the parameters configured by an admin, and
stores them per day. It shows a main table (today's value + change vs. the previous
day), a per-ETF history/chart page, and an admin area for ETFs, parameters, the AI
provider, cron timing, and run history.

Stack: Next.js (App Router) + TypeScript, Drizzle ORM + Neon Postgres, Tailwind,
Recharts, next-intl (ro + en), Vitest, pnpm. Hosted on Vercel (Hobby) with a daily
Vercel Cron job. See `dev_minions/architecture/ADR-001-tech-stack.md` for the full
rationale.

## Install

```
pnpm install
```

## Run

```
pnpm dev
```

Opens the app at `http://localhost:3000`.

## Test

```
pnpm test        # Vitest unit tests
pnpm typecheck    # TypeScript, no emit
pnpm lint         # ESLint
pnpm build        # Production build
```

## Internationalisation

The app is bilingual (Romanian and English, FR8.1). **No user-facing string is
hard-coded** — every one goes through a next-intl translation key:

- Add the key to **both** `messages/ro.json` and `messages/en.json`, with the same
  key structure in each. `i18n/messages.test.ts` fails the build if the two
  catalogues drift apart.
- Server components call `useTranslations()`/`useLocale()` from `next-intl` (or, in
  `app/layout.tsx` only, `getTranslations()`/`getLocale()`/`getMessages()` from
  `next-intl/server`). Client components use `useTranslations()` the same way.
- The ESLint rule `react/jsx-no-literals` (see `eslint.config.mjs`) fails `pnpm lint`
  on any hard-coded JSX text in `app/**` or `components/**`. String props users can
  see (`title`, `aria-label`, `alt`, `placeholder`, page metadata) are not caught by
  the rule and must be reviewed by hand.
- `global.d.ts` types the message keys against `messages/ro.json`, so `pnpm typecheck`
  fails on an unknown or misspelled key.
- The active locale comes from the `NEXT_LOCALE` cookie only (`i18n/request.ts`); no
  cookie means Romanian. The `LanguageSwitcher` component sets that cookie via a
  server action (`i18n/actions.ts`).
- Labels that come from the database (ETF names, field labels) carry their own
  `label_ro`/`label_en` columns instead — see `dev_minions/architecture/data-model.md`.
- Number formatting follows DEC-007 and is implemented in the stories that render
  numbers, not here.

## Environment variables

Copy `.env.example` to `.env.local` and fill in real values (never commit `.env*`
files other than `.env.example`).

- `DATABASE_URL` — Neon Postgres connection string. Required to run migrations, the
  seed script, and any query at runtime; not required for `pnpm build` or `pnpm test`.
- `CRON_SECRET` — shared secret the daily cron route (`/api/cron/daily`) checks on
  the `Authorization` header, so only Vercel Cron (not the public internet) can
  trigger a run. Required in production: the route answers `500` when it is unset,
  and `401` unless the request carries exactly `Authorization: Bearer <CRON_SECRET>`.
  Vercel Cron sends that header automatically once the variable is set.

## Deployment

1. Create a Neon Postgres database and copy its connection string.
2. Create a Vercel project from this GitHub repository (Hobby plan).
3. In the Vercel project's environment variables, set `DATABASE_URL` (the Neon
   connection string) and `CRON_SECRET` (any random value).
4. Run the migrations against Neon: `DATABASE_URL=<neon-url> pnpm db:migrate`.
5. Seed the ETF registry and field catalogue: `DATABASE_URL=<neon-url> pnpm db:seed`.
6. Deploy (push to the connected branch, or `vercel deploy` from the Vercel CLI).
7. Open the deployed `/health` page and confirm it reports a successful database
   connection with the expected ETF and field-catalogue counts.

## Health check

`/health` queries the database and reports connectivity, the number of ETFs in the
registry, the number of field-catalogue entries, and the current locale. If the
database is unreachable it still renders (HTTP 200) with a clear failure message
instead of throwing — this is what Vercel's or your own uptime check should poll.

## Daily ingestion (cron)

`GET /api/cron/daily` downloads the latest depositary report for every active ETF
and persists it (FR3). The schedule is `0 10 * * *` (10:00–10:59 UTC), set in
`vercel.json` — Vercel Hobby cron may fire anywhere within the scheduled hour.
That hour was chosen because BVB has filed reports at 09:09–09:34 Bucharest time
on the days observed, and a report filed after the run is not retried (FR4.1), so
the margin matters more than running earlier.

- Trigger manually against the deployment:
  `curl -H "Authorization: Bearer $CRON_SECRET" https://<app>.vercel.app/api/cron/daily`
- Trigger manually against a local dev server: run `pnpm dev`, then
  `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily`
  with `DATABASE_URL`/`CRON_SECRET` set in your own `.env.local`.
- Vercel runs scheduled cron jobs only on **Production** deployments, not previews.
- The response is `{ jobRunId, status, etfs: [{ symbol, outcome }, ...] }`. It
  never contains `CRON_SECRET` or `DATABASE_URL`. Each run is also recorded in
  `job_runs` (`started_at`, `finished_at`, `status`, `etfs_processed`,
  `errors_count`, `log`), so a failed or unfinished run stays visible even
  without checking the response.
- Until US-023 ships an admin setting for the hour, change it by editing the
  schedule in `vercel.json` and redeploying.
- The route's `maxDuration` is 60 seconds; each bvb.ro request (page or PDF) times
  out after 7 seconds, so the worst case for the current ETF count stays well
  inside the limit.

## Process documentation

This project is delivered story by story against a backlog and requirements set
maintained under [`dev_minions/`](dev_minions/) — start with
[`dev_minions/HANDOVER.md`](dev_minions/HANDOVER.md) for what's currently in flight,
and [`dev_minions/status.md`](dev_minions/status.md) for the overall picture. Every
coding agent working on this repo (human or AI) follows
[`AGENTS.md`](AGENTS.md).
