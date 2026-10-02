## QA run 1 — 2026-10-02 16:46

Verdict: PASS

Machine checks: 8/8   Judgment items: 1

This run used the user's explicit manual override of the stopped dev-loop gate because development is active in another agent.

| # | Check (source) | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | Frozen dependency install (QA #1, AC9) | AUTO | PASS | `env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY pnpm install --frozen-lockfile` → 0 → `Lockfile is up to date, resolution step is skipped`; `Done in 1.4s using pnpm v12.5.1`. |
| 2 | Focused component, previous-available-report delta, render-harness and boundary suite (QA #3, AC1–AC9) | AUTO | PASS | `env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY pnpm exec vitest run components/HomeTable.test.tsx lib/monitoring/home-delta.pglite.test.ts scripts/qa/render-home.test.tsx scripts/qa/boundaries.test.ts` → 0 → `Test Files 4 passed (4)`; `Tests 41 passed (41)`; `Duration 84.89s`. |
| 3 | Four deterministic RO/EN, light/dark home renders (QA #2, AC1–AC3, AC6–AC8) | AUTO | PASS | `env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY pnpm exec tsx scripts/qa/render-home.tsx` → 0 → wrote `.qa-render/home/home-ro-light.html`, `home-ro-dark.html`, `home-en-light.html`, and `home-en-dark.html`. |
| 4 | TypeScript and lint gates (QA #1, AC9) | AUTO | PASS | `env -u DATABASE_URL -u CRON_SECRET -u VERCEL_ENV -u GEMINI_API_KEY -u GROQ_API_KEY bash scripts/claude/predeploy-check.sh` → 0 → `$ tsc --noEmit`; lint `9 problems (0 errors, 9 warnings)`; final `PREDEPLOY: PASS — typecheck, lint, build and tests are green.` |
| 5 | Offline production build (QA #1, AC9) | AUTO | PASS | Same pre-deploy command → 0 → `migrate-on-deploy: skipped (not a production build)`; `Compiled successfully in 18.6s`; 12 dynamic routes listed. |
| 6 | Full current offline regression (QA #1, AC1–AC9) | AUTO | PASS | Same pre-deploy command → 0 → `Test Files 197 passed (197)`; `Tests 1967 passed (1967)`; `Duration 309.00s`. |
| 7 | Local RO/EN home with DATABASE_URL unset (manual QA #4, AC8) | AUTO-PARTIAL | PASS | `bash scripts/claude/qa-serve.sh start`; `get /`; `get / "NEXT_LOCALE=en"`; `stop` → 0 → both responses `STATUS 200`; RO contains `ETF-uri monitorizate` and the translated safe load error; EN contains `Monitored ETFs` and the translated safe load error; `QA server stopped.` |
| 8 | Local RO/EN home with an unreachable local database (manual QA #4, AC8) | AUTO-PARTIAL | PASS | `bash scripts/claude/qa-serve.sh start --db-unreachable`; the same two gets; `stop` → 0 → both responses `STATUS 200` with the corresponding translated safe error states; `QA server stopped.` |

### Judgment item

- [JUDGMENT] In an interactive browser, compare the filled home table at desktop light/dark and 390 px with `mockup-home-light.png`, `mockup-home-dark.png`, and `mockup-home-phone.png`; verify the row hover affordance, symbol-to-detail click, separate PDF click, internal horizontal scrolling without page overflow, and unwrapped dates/numbers. All four approved design PNGs, including `mockup-home-dark-customize.png`, were inspected during this QA session, and the deterministic render harness passed, but no browser surface was available for an independent runtime screenshot or interaction check. No `MATCH` is claimed for that portion.

Denied or attempted commands: initial sandboxed `qa-serve.sh` start/get/stop calls were denied by Windows WSL with `Wsl/Service/E_ACCESSDENIED`; the approved WSL retry succeeded and both QA servers were stopped cleanly. No git, secret, deployment, or live-database command was attempted.
