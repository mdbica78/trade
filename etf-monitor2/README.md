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
- `CRON_SECRET` — shared secret the daily cron route checks on the `Authorization`
  header, so only Vercel Cron (not the public internet) can trigger a run. Reserved
  for Sprint 3 (ingestion); not used yet.

## Deployment

1. Create a Neon Postgres database and copy its connection string.
2. Create a Vercel project from this GitHub repository (Hobby plan).
3. In the Vercel project's environment variables, set `DATABASE_URL` (the Neon
   connection string) and `CRON_SECRET` (any random value; unused until Sprint 3).
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

## Process documentation

This project is delivered story by story against a backlog and requirements set
maintained under [`dev_minions/`](dev_minions/) — start with
[`dev_minions/HANDOVER.md`](dev_minions/HANDOVER.md) for what's currently in flight,
and [`dev_minions/status.md`](dev_minions/status.md) for the overall picture. Every
coding agent working on this repo (human or AI) follows
[`AGENTS.md`](AGENTS.md).
