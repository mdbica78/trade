# US-002 manual QA checklist — Project scaffold

Both automated gates PASSED round 1 (see `US-002-review.md`, `US-002-tests.md`). Two non-blocking Warnings from the reviewer (`.gitignore`/`.env.*` coverage gap) were fixed afterward — see "Note" below.

## Checks

1. **Install and run**: `pnpm install`, then `pnpm dev`. Open `http://localhost:3000` — you should see the default Next.js starter page (unstyled beyond Tailwind defaults; no custom UI yet, that's out of scope for this story).
2. **Run the full local pipeline**: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — all four should complete with no errors.
3. **Skim `README.md`** at the project root and confirm the install/run/test instructions match what you just did, and that it points you to `dev_minions/` for process docs.
4. **Skim `.env.example`** — confirm it lists `DATABASE_URL` and `CRON_SECRET` with a comment each, and that no real value is filled in anywhere.
5. **No live BVB/Neon/Vercel check applies** — nothing is deployed or connected to a database yet (US-003, US-006).

## Two things worth your attention before committing

1. **This machine needs `--webpack`, not Next's default Turbopack**, for `pnpm dev`/`pnpm build` to work at all — Turbopack's persistent cache crashes on this WSL1/DrvFs (`/mnt/c/...`) mount. Already fixed in `package.json`'s scripts; documented in `dev_minions/decisions/DEC-008-turbopack-wsl1-drvfs.md`. If you ever move development to WSL2 or a native Linux path, this workaround could be revisited.
2. **A permission-settings change**: `.claude/settings.json`'s deny rule for `.env*` files was too broad — it blocked writing/reading `.env.example` itself, which the story requires. I narrowed it (with your explicit approval, asked live) to name the real secret-bearing variants (`.env`, `.env.local`, `.env.*.local`, `.env.production`, `.env.development`, `.env.test`) instead of the whole `.env.*` family, and extended `.gitignore` to match (`.env.*` ignored except `!.env.example`). No secret-bearing file exists yet, so nothing was ever exposed by the narrower window — just flagging the settings change for your awareness.

## Files changed
- `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `app/favicon.ico` (new, from create-next-app)
- `public/*.svg` (new, from create-next-app)
- `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `tsconfig.json` (new)
- `package.json` (new; `dev`/`build` scripts use `--webpack`, see DEC-008), `pnpm-lock.yaml`, `pnpm-workspace.yaml` (new)
- `vitest.config.ts` (new)
- `lib/format.ts`, `lib/format.test.ts` (new — trivial example helper, not the DEC-007 production formatter)
- `lib/db/.gitkeep`, `lib/extraction/.gitkeep`, `components/.gitkeep`, `messages/.gitkeep` (new)
- `.env.example` (new)
- `.gitignore` (extended: `out/`, `build/`, `.env.*` except `.env.example`, `*.tsbuildinfo`, `next-env.d.ts`)
- `README.md` (rewritten — was a 1-line placeholder)
- `.claude/settings.json` (deny rule narrowed from `Read(./.env.*)` to the real secret-bearing variants — `.env`, `.env.local`, `.env.*.local`, `.env.production`, `.env.development`, `.env.test` — so `.env.example` is writable; done with the user's explicit approval)
- `dev_minions/verification/US-002-plan.md` (new)
- `dev_minions/decisions/DEC-008-turbopack-wsl1-drvfs.md` (new)
