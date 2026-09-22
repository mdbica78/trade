# ADR-001 — Technology stack

**Status: PROPOSED — awaiting user validation. Sprint 1 stories from US-002 onward are blocked until this is confirmed.**

Date: 2026-09-22

## Context

The application must be web-based, hosted entirely on free tiers, with a database, a once-daily scheduled job, PDF parsing, charts, a bilingual UI (RO/EN), and a pluggable free-LLM integration. Target environment for development is WSL/Ubuntu + VS Code + GitHub Copilot. Hosting direction was already decided: Vercel (Hobby) + Vercel Cron + Neon Postgres.

## Decision

| Concern | Choice | Reason |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Native Vercel target; API routes and cron handlers in the same project as the UI; the single most Copilot-friendly stack. |
| Database access | **Drizzle ORM** + `@neondatabase/serverless` | Lightweight, SQL-first, works well with serverless/edge; migrations are plain SQL, easy to review. |
| Styling | **Tailwind CSS** | Fast, no separate design system needed for an internal tool. |
| Charts | **Recharts** | React-native API, good enough for time series; no licence cost. |
| i18n | **next-intl** | App Router support, message catalogues as JSON, simple locale switch. |
| PDF text extraction | **decided by US-001 spike** | Candidates: `unpdf`, `pdf-parse`, `pdfjs-dist`. Must be validated against a real BRD report before committing. |
| Unit tests | **Vitest** | Fast, TypeScript-native, minimal config. |
| Package manager | **pnpm** | Efficient; fine on Vercel. |

## Consequences

- One deployable unit: UI, API, and the cron handler live in the same Next.js project.
- The cron endpoint is a protected API route (`/api/cron/daily`) invoked by Vercel Cron once per day.
- The PDF library choice is deliberately deferred to the US-001 spike rather than guessed — if no library extracts text reliably from the BRD report, the whole extraction approach changes (OCR), which would be a direction decision requiring the user.

## Alternatives considered

- **SvelteKit / Remix** — both fine, but Copilot's training density and the Vercel-native path favour Next.js.
- **Prisma instead of Drizzle** — heavier runtime, slower cold starts on serverless; Drizzle is a better fit for a free-tier serverless target.
- **Supabase instead of Neon** — rejected in the requirements (section 4): projects inactive for more than a week need manual restoration, which breaks an unattended daily job.
