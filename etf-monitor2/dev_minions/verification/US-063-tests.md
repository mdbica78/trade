# US-063 — independent test verdict

## Round 1

Run from `etf-monitor2`, PowerShell, with `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `AI_KEY_MASTER_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY` removed from the process environment (values never printed). No source/test edits.

### Commands (all produced by me this round)
| Command | Exit | Key output |
|---|---|---|
| `corepack pnpm typecheck` | 0 | `tsc --noEmit`, no errors |
| `corepack pnpm lint` | 0 | `✖ 21 problems (0 errors, 21 warnings)` (unused-var warnings in other files) |
| `corepack pnpm test` | 0 | `Test Files 260 passed (260)`, `Tests 2814 passed (2814)`, duration 161.40s |
| `corepack pnpm build` | 0 | `migrate-on-deploy: skipped (not a production build)`; `✓ Compiled successfully`; static pages 6/6; `[load-error] home name=MissingDatabaseUrlError` (expected offline) |
| `corepack pnpm exec vitest run components/admin/OperationsDashboard.test.tsx app/globals.contrast.test.ts` | 0 | `components/admin/OperationsDashboard.test.tsx (12 tests)`; `Test Files 2 passed`, `Tests 18 passed` |

### Acceptance criteria
- **AC1 (bounded ~24rem, vertical scroll, sticky header) — MET.** `OperationsDashboard.tsx` line ~141 wraps the runs table in `max-h-96 overflow-auto [&_th]:sticky [&_th]:top-0 [&_th]:bg-[var(--head)]` (max-h-96 = 24rem). Proven by OD-SC1 (`max-h-96`, `data-runs-scroll`) and OD-SC2 (classes `overflow-auto`, `max-h-96`, `[&_th]:sticky`, `[&_th]:top-0`, `[&_th]:bg-[var(--head)]`), both passing. Actual rendered scroll/stickiness in a browser: MANUAL-QA.
- **AC2 (horizontal overflow contained on narrow viewports) — MET (markup) / MANUAL-QA (rendered).** OD-SC2 asserts `overflow-auto` (both axes) on the region; a render-level narrow-viewport check is browser-only → MANUAL-QA.
- **AC3 (keyboard-focusable, localized accessible label, visible focus/contrast in both themes) — MET (markup/CSS) / MANUAL-QA (visual).** OD-SC1: `tabindex="0"` and `aria-label` equal to `en.Admin.operations.runsScrollLabel` ("Job runs, scrollable") and `ro...` ("Rulările jobului, derulabil"); OD-SC2: `role="region"` in both locales and asserts `app/globals.css` has a global `:focus-visible` outline `2px solid var(--focus)`. Contrast tokens covered by existing `app/globals.contrast.test.ts` (passed in the focused run). Real keyboard focus, scrolling and light/dark visuals: MANUAL-QA.
- **AC4 (tests prove overflow, sticky header, focus, label; gates pass) — MET.** OD-SC1 and OD-SC2 exist and pass; typecheck, lint (0 errors), full suite (260 files / 2814 tests) and offline build (skipped migration line printed) all exit 0.

### MANUAL-QA (browser only)
Narrow-viewport (≈375px) horizontal scroll contained in the region without widening the page; keyboard Tab-to-region and arrow/PageDown scroll; sticky header visible against rows and focus ring visible in both light and dark themes.

Denied or attempted commands: none.

Verdict: PASS
