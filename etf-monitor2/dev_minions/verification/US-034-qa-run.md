## QA run 1 — 2026-09-28 21:34

Verdict: PASS

Machine checks: 4/4 AUTO passed. Left for the user: 1 cross-filesystem observation.

| # | Check (source) | Type | Result | Evidence (command → exit code → output tail) |
|---|---|---|---|---|
| 1 | Named 30-second test/hook limits and pre-deploy-script safety (AC1, AC4) | AUTO | PASS | `env -u DATABASE_URL -u CRON_SECRET -u GEMINI_API_KEY -u GROQ_API_KEY pnpm exec vitest run vitest.config.test.ts scripts/claude/predeploy-check.test.ts` → 0 → `Test Files 2 passed (2)`, `Tests 6 passed (6)`. |
| 2 | First complete regression run (AC3) | AUTO | PASS | `env -u DATABASE_URL -u CRON_SECRET -u GEMINI_API_KEY -u GROQ_API_KEY pnpm test` → 0 → `Test Files 166 passed (166)`, `Tests 1771 passed (1771)`, duration `182.12s`. |
| 3 | Pre-deploy gate (AC4, including another full regression) | AUTO | PASS | `env -u DATABASE_URL -u CRON_SECRET -u GEMINI_API_KEY -u GROQ_API_KEY bash scripts/claude/predeploy-check.sh` → 0 → lint `0 errors, 9 warnings`; build includes `ƒ /health`; tests `166 passed`, `1771 passed`; final `PREDEPLOY: PASS — typecheck, lint, build and tests are green. Safe to commit and push.` |
| 4 | Third consecutive complete regression run (AC3) | AUTO | PASS | `env -u DATABASE_URL -u CRON_SECRET -u GEMINI_API_KEY -u GROQ_API_KEY pnpm test` → 0 → `Test Files 166 passed (166)`, `Tests 1771 passed (1771)`, duration `178.94s`. The three QA-session runs have identical counts and no CPS-1/PGlite-hook timeout. |

### For the user (only what a machine could not settle)

- [AUTO-PARTIAL] On your own non-WSL1/drvfs environment, run `pnpm test` once before pushing. If CPS-1 or a PGlite hook still times out there, report it as a new finding rather than increasing limits without evidence.

