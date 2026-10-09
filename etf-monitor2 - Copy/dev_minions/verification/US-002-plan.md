# US-002 plan — Project scaffold

Not complex (no DB/adapter/AI/cron/auth code, just a Next.js scaffold; story itself says "cheap model, low thinking") — planned directly.

## Criteria → work
- AC1/AC4 → `pnpm create next-app` (App Router, TS, Tailwind, ESLint, src-dir=no, import-alias default) at `etf-monitor2/` root, then `pnpm dev`/`pnpm build` smoke test.
- AC2 → add Vitest + config (`vitest.config.ts`), one pure helper `lib/format.ts` (formats a number for display, per DEC-007: no thousands separator, locale decimal mark) + `lib/format.test.ts`.
- AC3 → keep Next.js's generated ESLint config; `pnpm lint` script from create-next-app.
- AC5 → create `app/`, `lib/db/`, `lib/extraction/`, `components/`, `messages/`, `test/fixtures/` — move existing `test/fixtures/*.pdf` (from US-001, currently at repo root `test/fixtures/`) into place if create-next-app doesn't already put them there; add `.gitkeep` to empty dirs.
- AC6 → `.env.example` with `DATABASE_URL` and `CRON_SECRET`, one-line comments each.
- AC7 → replace root `README.md` (currently a 1-line placeholder) with project description + install/run/test + link to `dev_minions/`.
- `.gitignore` already exists at repo root (added in US-001) — extend/verify it covers `node_modules`, `.next`, `.env*` except `.env.example`, build output.

## Files to touch
Whole Next.js scaffold tree (new) + `.env.example`, `README.md`, `.gitignore` (extend), `vitest.config.ts`, `lib/format.ts`, `lib/format.test.ts`, `.gitkeep` in empty dirs.

## Note
`spikes/pdf-extraction/` (US-001 spike) stays untouched at repo root — out of scope, not part of the app.
