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

## Process documentation

This project is delivered story by story against a backlog and requirements set
maintained under [`dev_minions/`](dev_minions/) — start with
[`dev_minions/HANDOVER.md`](dev_minions/HANDOVER.md) for what's currently in flight,
and [`dev_minions/status.md`](dev_minions/status.md) for the overall picture. Every
coding agent working on this repo (human or AI) follows
[`AGENTS.md`](AGENTS.md).
