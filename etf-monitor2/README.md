# etf-monitor2

A web app that monitors BVB-listed ETFs daily: for each monitored ETF it downloads the
latest depositary report (PDF), extracts the parameters configured by an admin, and
stores them per day. It shows a main table (latest value + change vs. the previous
available report), a per-ETF history/chart page, and an admin area for ETFs, parameters, the AI
provider, cron timing, and run history.

On the ETF detail page, each chart has its own line, line-with-dots, columns, or
area selector. The choice is remembered in that browser per ETF and field; it
is not saved on the server. An isolated reading remains visible, and a chart
with only one reading shows a larger point and its exact stored value.

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
- `AI_KEY_MASTER_KEY` — optional override for encrypting provider keys saved from
  `/admin/ai`. If set, it must be 32 random bytes encoded as base64. Otherwise the
  app derives an encryption key from `CRON_SECRET` using HKDF-SHA256; storage is
  disabled only when neither source is usable. A stored key is encrypted with the
  source recorded alongside it, so removing that source or rotating `CRON_SECRET`
  makes keys encrypted from it unavailable until re-entered.
- `GEMINI_API_KEY` (https://aistudio.google.com/apikey), `GROQ_API_KEY`
  (https://console.groq.com/keys), `OPENAI_API_KEY` (https://platform.openai.com/api-keys),
  `OPENROUTER_API_KEY` (https://openrouter.ai/settings/keys), `MISTRAL_API_KEY`
  (https://console.mistral.ai/api-keys), `DEEPSEEK_API_KEY`
  (https://platform.deepseek.com/api_keys), `CEREBRAS_API_KEY` (https://cloud.cerebras.ai),
  `TOGETHER_API_KEY` (https://api.together.ai/settings/api-keys) — API keys for the eight
  supported AI providers (FR6, DEC-026 §1). They remain supported as environment-key
  fallbacks. You can instead save or replace a provider key at `/admin/ai`; it is
  encrypted in `ai_provider_keys` and never shown again. `/admin/ai` displays only
  whether a key is set and its source. Without either a stored key or an environment
  key, `/chat` shows the reason and a link to `/admin/ai` instead of the composer.

## Deployment

1. Create a Neon Postgres database and copy its connection string.
2. Create a Vercel project from this GitHub repository (Hobby plan).
3. In the Vercel project's environment variables, set `DATABASE_URL` (the Neon
   connection string) and `CRON_SECRET` (any random value). `VERCEL_ENV` is
   provided automatically by Vercel; nothing to do there.
4. Seed the ETF registry and field catalogue: `DATABASE_URL=<neon-url> pnpm db:seed`.
   This is a first-install bootstrap and is safe to re-run at any time: it only
   inserts ETFs, tracked fields (only for ETFs it just inserted) and the settings
   row that are absent, refreshes field-catalogue labels, and never overwrites a
   change made from `/admin`.
5. Push to the production branch (or `vercel deploy` from the Vercel CLI). The build
   applies any pending migration itself before `next build` runs
   (`scripts/migrate-on-deploy.ts`, DEC-023) — there is no separate migrate step and
   no manual Neon SQL check.
6. Open the deployed `/health` page and confirm it reports a successful database
   connection with the expected ETF and field-catalogue counts.

`pnpm db:migrate` still exists for local/manual use, but nothing in the deploy flow needs it.

**Before you push:** run `bash scripts/claude/predeploy-check.sh`. It mirrors what Vercel's build
does (typecheck, then build) plus lint and the full test suite, offline, stopping at the first
failure — a cheap way to catch a break before it reaches production.

## Health check

`/health` queries the database and reports connectivity, the number of ETFs in the
registry, the number of field-catalogue entries, and the current locale. If the
database is unreachable it still renders (HTTP 200) with a clear failure message
instead of throwing — this is what Vercel's or your own uptime check should poll.
A database query that hangs (e.g. a Neon cold start gone wrong) renders the same
kind of failure state after a fixed timeout, instead of running until the platform
kills the request.

If the deployed schema is behind the code, `/health` names each table the code expects but the
database does not have; this should not happen in practice since the next production deploy
applies pending migrations by itself (`scripts/migrate-on-deploy.ts`, DEC-023). Every other page
degrades the same way it does for any database error: a translated, connection-detail-free message
on screen, and one safe diagnostic line in Vercel's function logs — `[load-error] <scope>
name=<error name> code=<sqlstate> relation=<table>` (fields present only when known) — never the
raw exception, a stack trace or a connection string.

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

`GET /api/cron/daily` downloads every report in the newest depositary filing (up to 4) for every
active ETF and persists every extracted field (FR3, FR3.1). It is triggered by an **hourly ping**
and runs the job **at most once per UTC day**: after checking the bearer token, it starts a run
only when the current UTC hour is at or after the hour saved in `/admin/cron` (default 10:00 UTC,
`settings.cron_hour_utc`) and no run has started yet that UTC day. Any earlier ping, and any ping
after a run has started — even a failed or interrupted one, there is no same-day retry — gets
`200 {"skipped":"not_scheduled_hour"}` or `200 {"skipped":"already_ran"}` and writes nothing. A
missed hourly ping simply catches up at the next one. The default hour is 10 because BVB has filed
reports at 09:09–09:34 Bucharest time on the days observed, and a report filed after the run is not
retried (FR4.1), so the margin matters more than running earlier.

### Setting up the hourly ping (one-time, by you)

1. The workflow `.github/workflows/etf-monitor2-daily-ping.yml` (repository root; the project's
   own copy is `etf-monitor2/.github/workflows/daily-ping.yml`) calls the endpoint every hour with
   the `CRON_SECRET` bearer token. It prints only the HTTP status.
2. On GitHub: *Settings → Secrets and variables → Actions → New repository secret*, add
   `ETF_MONITOR_BASE_URL` (for example `https://etf-monitor2.vercel.app`) and `CRON_SECRET` (the same
   value as the Vercel environment variable). Never put either value in a file.
3. Optionally start it once from the *Actions* tab (*Run workflow*); a `200` is success whether or
   not the job ran that hour.
4. The daily entry in `vercel.json` (`0 10 * * *`) stays as a safety net and calls the same gated
   route; the unique per-UTC-day claim in `job_runs.scheduled_date_utc` guarantees the two callers
   never run the job twice.

Other notes:

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
- To change the hour: choose it in `/admin/cron` (0–23 UTC; the page shows the Europe/Bucharest
  equivalent). It takes effect at the next ping — no commit or deploy is needed, and the setting
  cannot be cleared.
- The route's `maxDuration` is 60 seconds; each bvb.ro request (page or PDF) times
  out after 7 seconds, so the worst case for the current ETF count stays well
  inside the limit.

## Administration

`/chat` (open, no login — requirements §6) is the natural-language configuration
interface (FR1, FR2, FR5, FR17): talk to it like a colleague, in Romanian or
English, in your own words ("add ETF XYZ", "adaugă maximul unităților în
circulație pe ultima săptămână", "which custom values do I have on TVBETETF?")
and it changes the same configuration data as the form-based admin pages (FR9),
answering back with a short natural reply plus the app's own result list below
it (the result list is always the truth — if the two disagree, trust the list).
The page remembers the last 21 messages so "and for 30 days too" or "remove
that" work; "New conversation" clears that memory. When it is missing a detail
it asks one question instead of guessing. The active AI provider and model are
chosen in `/admin/ai`; the message length limit is 2000 characters.

`/admin` (open, no login — requirements §6) has a structured form-based area over
the same configuration data as the natural-language chat (FR9). `/admin/etfs`
manages the monitored ETF list: pick an ETF from the selector (a plain `?symbol=`
link/form, no JavaScript needed) to see its details, soft-remove/reactivate it, and
set or re-detect its extraction adapter; add an ETF by its BVB symbol only — the
fund name is read from the BVB instrument page (the symbol is the fallback), and
re-detecting refreshes it. Each ETF links to `/admin/etfs/<symbol>/fields` to choose
which extracted fields are tracked and their column order. `/admin/ai` picks the
AI provider and model from eight presets (FR6, FR11, DEC-026 §1) and shows which
of the provider API keys are set — keys can be entered write-only and are never
shown. A **Test connection** button sends one short request with the saved
provider and model and shows "Connection OK" or a closed error code, never the
provider's raw reply or a key. `/admin/ai` can also add up to 5 of your own
OpenAI-compatible providers (name + https address, DEC-026 §2); their keys are
stored only in the app, bound to the address, and deleted when the address
changes. `/admin/cron` (FR12) lets you set the hour (UTC, with the Bucharest equivalent) at which
the hourly ping starts the daily job, and shows the latest run and the setup hint; a changed hour
applies from the next ping, with no redeploy.

## Process documentation

This project is delivered story by story against a backlog and requirements set
maintained under [`dev_minions/`](dev_minions/) — start with
[`dev_minions/HANDOVER.md`](dev_minions/HANDOVER.md) for what's currently in flight,
and [`dev_minions/status.md`](dev_minions/status.md) for the overall picture. Every
coding agent working on this repo (human or AI) follows
[`AGENTS.md`](AGENTS.md).
