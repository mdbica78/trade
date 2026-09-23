# ADR-001 — Technology stack

**Status: Decided** — validated by Technical Lead, 23.09.2026: Vercel Hobby cron matches once-daily report cadence; Neon's sleep/wake fits a once-a-day job; next-intl satisfies FR8.1; PDF-adapter layer (section 3) is framework-agnostic so the stack choice doesn't constrain it — US-001's fixture spike confirmed unpdf handles all three current templates cleanly. Sprint 1 stories from US-002 onward are unblocked.

Date: 2026-09-22

## Context

The application must be web-based, hosted entirely on free tiers, with a database, a once-daily scheduled job, PDF parsing, charts, a bilingual UI (RO/EN), and a pluggable free-LLM integration. Target environment for development is WSL/Ubuntu + VS Code + GitHub Copilot (now also Claude Code, see DEC-005). Hosting direction was already decided: Vercel (Hobby) + Vercel Cron + Neon Postgres.

## Decision

| Concern | Choice | Reason |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Native Vercel target; API routes and cron handlers in the same project as the UI; the single most Copilot-friendly stack. |
| Database access | **Drizzle ORM** + `@neondatabase/serverless` | Lightweight, SQL-first, works well with serverless/edge; migrations are plain SQL, easy to review. |
| Styling | **Tailwind CSS** | Fast, no separate design system needed for an internal tool. |
| Charts | **Recharts** | React-native API, good enough for time series; no licence cost. |
| i18n | **next-intl** | App Router support, message catalogues as JSON, simple locale switch. |
| PDF text extraction | **`unpdf`** | Decided by the US-001 spike (`spikes/pdf-extraction/FINDINGS.md`) — extracts every target field cleanly from real BRD depositary reports, no OCR needed, purpose-built for serverless/edge (no worker-file config, unlike `pdfjs-dist`). `pdf-parse` documented as a viable fallback if ever needed. Avoid loading `unpdf` and `pdfjs-dist` in the same process (library collision, see FINDINGS.md). |
| Unit tests | **Vitest** | Fast, TypeScript-native, minimal config. |
| Package manager | **pnpm** | Efficient; fine on Vercel. |

## Consequences

- One deployable unit: UI, API, and the cron handler live in the same Next.js project.
- The cron endpoint is a protected API route (`/api/cron/daily`) invoked by Vercel Cron once per day.
- The PDF library choice was deferred to the US-001 spike as planned, rather than guessed — resolved 2026-09-23: `unpdf`, OCR not needed. See the spike's findings for two extraction traps the future adapter must handle (VUAN value appears well before its own label; the report-date footer is one day behind an unrelated filing-stamp date near the top of the document).

## Alternatives considered

- **SvelteKit / Remix** — both fine, but Copilot's training density and the Vercel-native path favour Next.js.
- **Prisma instead of Drizzle** — heavier runtime, slower cold starts on serverless; Drizzle is a better fit for a free-tier serverless target.
- **Supabase instead of Neon** — rejected in the requirements (section 4): projects inactive for more than a week need manual restoration, which breaks an unattended daily job.
