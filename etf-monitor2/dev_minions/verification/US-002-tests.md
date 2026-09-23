# US-002 — Test Verdict

**Story:** Project scaffold  
**Round:** 1  
**Date:** 2026-09-23  
**Tested by:** story-tester (Haiku)

## Verdict: PASS

All acceptance criteria verified. All build commands (install, typecheck, lint, test, build) exit with code 0. No real secrets committed.

---

## Acceptance criteria mapping

### AC1 — `pnpm install && pnpm dev` starts the app and renders without errors
**Status:** PASS

- `pnpm install --frozen-lockfile`: Exit 0. Lockfile up to date, no changes needed.
- `pnpm dev --port 3299`: Server started successfully on http://localhost:3299
- Default page: `curl http://localhost:3299/` returned HTTP 200
- HTML rendered: Full Next.js default page HTML with no errors

### AC2 — `pnpm test` runs Vitest and reports at least one passing test
**Status:** PASS

- Script exists: `pnpm test` maps to `vitest run` in package.json
- Vitest v3.2.7 ran successfully
- Test file: `lib/format.test.ts` contains 1 test
- Test output: `✓ lib/format.test.ts (1 test) 4ms`
- Passing: Test Files 1 passed (1), Tests 1 passed (1)
- Test verifies: `formatNumber(415591664.2)` returns `"415591664.20"` (two decimal places)

### AC3 — `pnpm lint` completes with no errors
**Status:** PASS

- Script exists: `pnpm lint` maps to `eslint` in package.json
- Execution: Completed with no output and exit 0
- Config: ESLint configured with Next.js config (eslint.config.mjs present)
- Result: No linting errors reported

### AC4 — `pnpm build` completes successfully
**Status:** PASS

- Script exists: `pnpm build` maps to `next build --webpack` in package.json
- Compilation: "✓ Compiled successfully in 12.0s"
- TypeScript: "Finished TypeScript in 5.2s" — no type errors
- Pages: Generated 4 routes (/, /_not-found, and Next.js internals)
- Result: Exit 0, production build ready

### AC5 — All required folders exist with .gitkeep in empty ones
**Status:** PASS

- `app/`: ✓ Exists (not empty; contains favicon.ico, globals.css, layout.tsx, page.tsx)
- `lib/`: ✓ Exists (contains db/, extraction/ subdirs and format.ts, format.test.ts)
- `lib/db/`: ✓ Exists with `.gitkeep`
- `lib/extraction/`: ✓ Exists with `.gitkeep`
- `components/`: ✓ Exists with `.gitkeep`
- `messages/`: ✓ Exists with `.gitkeep`
- `test/`: ✓ Exists
- `test/fixtures/`: ✓ Exists with 3 PDF files from US-001:
  - BTBETRETF-2026-09-21.pdf (238147 bytes)
  - PTENGETF-2026-09-21.pdf (235265 bytes)
  - TVBETETF-2026-09-21.pdf (233681 bytes)

### AC6 — `.env.example` documented; no real secrets committed
**Status:** PASS

- `.env.example` exists: ✓
- `DATABASE_URL` documented: ✓
  - Comment: "Neon Postgres connection string used by Drizzle ORM (filled in by US-003)."
- `CRON_SECRET` documented: ✓
  - Comment: "Shared secret the /api/cron/daily route checks on the Authorization header, so only Vercel Cron (not the public internet) can trigger a daily run."
- Real secrets search:
  - No `.env`, `.env.local`, or `.env.*.local` files found in repo
  - No Postgres connection strings found in source code
  - No API keys or tokens in files
  - `.gitignore` properly excludes `.env`, `.env.local`, `.env.*.local` (line 5–7)
  - `.env.example` exception enforced with `!.env.example` (line 8)

### AC7 — README.md describes install/run/test and points to dev_minions/
**Status:** PASS

- Project description: ✓
  - "A web app that monitors BVB-listed ETFs daily: for each monitored ETF it downloads the latest depositary report (PDF), extracts the parameters configured by an admin, and stores them per day..."
- Install section: ✓
  - `pnpm install`
- Run section: ✓
  - `pnpm dev` opens at `http://localhost:3000`
- Test section: ✓
  - `pnpm test` (Vitest unit tests)
  - `pnpm typecheck` (TypeScript, no emit)
  - `pnpm lint` (ESLint)
  - `pnpm build` (Production build)
- Process documentation links: ✓
  - Points to `dev_minions/HANDOVER.md` with relative link
  - Points to `dev_minions/status.md` with relative link
  - References `AGENTS.md` (project-wide agent instructions)
  - Mentions "Full requirements: dev_minions/requirements/"

---

## Summary of all builds

| Command | Script | Exit | Status |
|---------|--------|------|--------|
| `pnpm install --frozen-lockfile` | (built-in) | 0 | ✓ PASS |
| `pnpm typecheck` | `tsc --noEmit` | 0 | ✓ PASS |
| `pnpm lint` | `eslint` | 0 | ✓ PASS |
| `pnpm test` | `vitest run` | 0 | ✓ PASS |
| `pnpm build` | `next build --webpack` | 0 | ✓ PASS |

No scripts missing. All exit 0.

---

## Notes

- Configuration matches ADR-001 (Next.js 16, App Router, TS strict, Tailwind, Vitest, pnpm 12.5.1).
- `--webpack` flag in dev and build scripts is per DEC-008 (Turbopack cache crash on WSL1 DrvFs mount).
- Trivial `formatNumber()` helper in `lib/format.ts` provides a real, passing test for the scaffold (per story plan, not a final design).
- PDF fixtures already present from US-001 spike (test/fixtures/).
- All other empty directories properly marked with `.gitkeep` to preserve folder structure in git.
