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
  `pnpm dev`/`next` read `.env.local`; the CLI scripts (`db:migrate`, `db:seed`,
  `report:latest`) read no env file — export it or pass it inline, e.g.
  `DATABASE_URL=<url> pnpm db:seed`.
- `CRON_SECRET` — shared secret the daily cron route (`/api/cron/daily`) checks on
  the `Authorization` header, so only Vercel Cron (not the public internet) can
  trigger a run. Required in production: the route answers `500` when it is unset,
  and `401` unless the request carries exactly `Authorization: Bearer <CRON_SECRET>`.
  Vercel Cron sends that header automatically once the variable is set.
- `GEMINI_API_KEY` (https://aistudio.google.com/apikey), `GROQ_API_KEY`
  (https://console.groq.com/keys) — API keys for the two supported AI providers
  (FR6). Set the one(s) you use in the Vercel project's environment variables and
  redeploy; without one, `/chat` shows the reason and a link to `/admin/ai` instead
  of the composer. `/admin/ai` never shows a key's value, only whether it is set.

## Deployment

1. Create a Neon Postgres database and copy its connection string.
2. Create a Vercel project from this GitHub repository (Hobby plan).
3. In the Vercel project's environment variables, set `DATABASE_URL` (the Neon
   connection string) and `CRON_SECRET` (any random value).
4. Run the migrations against Neon: `DATABASE_URL=<neon-url> pnpm db:migrate`.
5. Seed the ETF registry and field catalogue: `DATABASE_URL=<neon-url> pnpm db:seed`.
   This is a first-install bootstrap and is safe to re-run at any time: it only
   inserts ETFs, tracked fields (only for ETFs it just inserted) and the settings
   row that are absent, refreshes field-catalogue labels, and never overwrites a
   change made from `/admin`.
6. Deploy (push to the connected branch, or `vercel deploy` from the Vercel CLI).
7. Open the deployed `/health` page and confirm it reports a successful database
   connection with the expected ETF and field-catalogue counts.

## Health check

`/health` queries the database and reports connectivity, the number of ETFs in the
registry, the number of field-catalogue entries, and the current locale. If the
database is unreachable it still renders (HTTP 200) with a clear failure message
instead of throwing — this is what Vercel's or your own uptime check should poll.
A database query that hangs (e.g. a Neon cold start gone wrong) renders the same
kind of failure state after a fixed timeout, instead of running until the platform
kills the request.

## Deployment smoke check

`pnpm smoke:deploy <baseUrl>` requests every public page (home, one ETF detail
page, `/chat`, `/health`, and each `/admin` section) in both Romanian and English,
through the `NEXT_LOCALE` cookie, and prints one `PASS`/`FAIL` line per page and
locale plus a `SUMMARY` line. It:

- sends only `GET` requests, only to the base URL's own origin, and never follows a
  redirect (`redirect: "manual"` — any 3xx is reported as a failure line, not
  followed);
- never requests an `/api/` path or a Server Action, and never reads an environment
  variable;
- never prints a response body — only the path, locale, HTTP status and a short
  reason (e.g. `wrong-lang`, `timeout`, `error-text:Home.loadError`);
- exits `0` when every page passes, `1` when any page fails, and `2` (with a one-line
  usage message and no request sent) when the base URL argument is missing or does
  not look like `https://<host>` or `http://localhost`/`http://127.0.0.1`.

An unconfigured `/chat` (no AI provider or API key set yet) is reported as a `PASS`
with a `note=` suffix, not a failure — that is a legitimate state, not a bug.

```
export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt   # WSL only, DEC-002/DEC-008
pnpm smoke:deploy https://<your-app>.vercel.app
```

If Vercel Deployment Protection is enabled on the production deployment, every page
correctly fails with `401` or a redirect — that is the protection working, not a
smoke-check bug.

## Daily ingestion (cron)

`GET /api/cron/daily` downloads the latest depositary report for every active ETF
and persists it (FR3). The shipped default is `0 10 * * *` (10:00–10:59 UTC); the
schedule in force is the one in `vercel.json`, shown on `/admin/cron` — Vercel
Hobby cron may fire anywhere within the scheduled hour. That hour was chosen
because BVB has filed reports at 09:09–09:34 Bucharest time on the days observed,
and a report filed after the run is not retried (FR4.1), so the margin matters
more than running earlier.

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
- To change the hour: choose it in `/admin/cron` (stored in `settings.cron_hour_utc`),
  copy the line the page shows into `vercel.json`, commit and push; Vercel applies
  it with the next **Production** deployment. Saving in the admin page alone does
  not move the job.
- The route's `maxDuration` is 60 seconds; each bvb.ro request (page or PDF) times
  out after 7 seconds, so the worst case for the current ETF count stays well
  inside the limit.

## Administration

`/chat` (open, no login — requirements §6) is the natural-language configuration
interface (FR1, FR2, FR5): send one command per message ("add ETF XYZ", "stop
tracking ETF XYZ", "also track VUAN for BTBETRETF") and it changes the same
configuration data as the form-based admin pages (FR9). The active AI provider and
model are chosen in `/admin/ai`; the message length limit is 500 characters.

`/admin` (open, no login — requirements §6) has a structured form-based area over
the same configuration data as the natural-language chat (FR9). `/admin/etfs`
manages the monitored ETF list: add, soft-remove/reactivate, and set or re-detect
the extraction adapter; each row links to `/admin/etfs/<symbol>/fields` to choose
which extracted fields are tracked and their column order. `/admin/ai` picks the
AI provider and model (FR6, FR11) and shows which of the provider API keys
are set as environment variables — keys themselves are never entered or shown in
the form, only set/not-set. `/admin/cron` (FR12) shows the effective daily-job
window from the deployed `vercel.json` and lets you store a desired hour; a
changed hour takes effect only after you copy the shown line into `vercel.json`
and redeploy.

## Process documentation

This project is delivered story by story against a backlog and requirements set
maintained under [`dev_minions/`](dev_minions/) — start with
[`dev_minions/HANDOVER.md`](dev_minions/HANDOVER.md) for what's currently in flight,
and [`dev_minions/status.md`](dev_minions/status.md) for the overall picture. Every
coding agent working on this repo (human or AI) follows
[`AGENTS.md`](AGENTS.md).
