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
