# US-059 — independent test verdict

## Round 1

Tester: independent context (did not write the code). Run from `etf-monitor2` in PowerShell with `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `AI_KEY_MASTER_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY` removed from the process environment (no value printed). No source or test file edited; no git, `db:migrate` or `db:generate`.

### Gates (my own runs)
| Command | Exit | Key output |
|---|---|---|
| `corepack pnpm typecheck` | `$LASTEXITCODE` = 0 | `tsc --noEmit`, no diagnostics |
| `corepack pnpm lint` | 0 | `✖ 21 problems (0 errors, 21 warnings)` |
| `corepack pnpm test` | 0 | `Test Files  265 passed (265)`, `Tests  2905 passed (2905)`; no skipped/todo count line |
| `corepack pnpm build` (offline) | 0 | `migrate-on-deploy: skipped (not a production build)`, `✓ Compiled successfully`, 12 route lines, one expected `[load-error] home name=MissingDatabaseUrlError` |
| focused: `vitest run prompt.test.ts ChatView.test.tsx context.pglite.test.ts --reporter=verbose` | 0 | `Tests  39 passed (39)` |

Full-suite per-file lines I observed: `lib/ai/chat.list-queries.pglite.test.ts (13 tests)`, `lib/config/latest-report-dates.pglite.test.ts (5 tests)`, `lib/ai/capabilities/configuration/prompt.test.ts (24 tests)`, `components/chat/ChatView.test.tsx (9 tests)`, `lib/ai/boundaries.test.ts (88 tests)`, `lib/config/boundaries.test.ts (24 tests)`, `lib/ai/capabilities/boundaries.test.ts (22 tests)` — all ✓.

Skip scan: a pattern search for `.skip` / `.only` / `.todo` / `xit` / `xdescribe` over the five touched test files found nothing.

CP-12 and CP-18: the verbose focused run lists `CP-12: the static prompt stays within the size guard for an empty context ✓` and `CP-18: realistic and worst-case contexts stay within their size guards ✓` (ran, passed, not skipped). CP-7b, CP-7c and CC-6 also ran and passed.

Fixture check (`node` read of `test/fixtures/ai/chat-list-queries.json`): 10 rows, exactly one per category × language — `active_etfs`, `inactive_etfs`, `tracked_fields`, `widgets`, `latest_report_date`, each with `ro` and `en`. LQ-0 asserts this coverage and unique ids.

### Acceptance criteria
- **AC1 — MET (offline wiring) / MANUAL-QA (model quality).** LQ-2 L01–L10 (all five categories, ro + en) show the fake-provider answer returned as `{kind:"answered"}` with one provider call, no action run, DB snapshot unchanged and `fetch` never called. LQ-3 shows the prompt tells the model to answer list questions from data, no actions, and not to answer report values. No new action/command/write exists (no new test or source path for one found in the touched list). Live-model answers for each category in ro/en = MANUAL-QA.
- **AC2 — MET.** LR-1..LR-5 (`latest-report-dates.pglite.test.ts`): newest `status=ok` date per ETF, inactive included, non-ok ignored even when newer, absent when none, `YYYY-MM-DD` text, one read-only statement. CC-6: `loadConfigurationContext` carries `lastReportDate` (null when none). CP-7b: `latest_report` on active, compact `inactive_state` on inactive, names/catalogue excluded; CP-7c: not emitted without dates. LQ-1: context carries exactly active/inactive, tracked, widgets and latest ok date; newer non-ok dates, `https://bvb.ro` and the fake key never appear. CP-12 / CP-18 (size caps) and the boundary suites (`lib/config`, `lib/ai`, capabilities) pass; existing escaping/size protections stay effective.
- **AC3 — MET.** `Chat.instructions.listExamples` exists in `messages/en.json` and `messages/ro.json` (line 369 each, five concise examples); `ChatView.test.tsx` asserts `listExamples` is rendered in every availability state for both locales (9 tests pass).
- **AC4 — MET.** Fixture covers all five categories in ro and en (verified above); LQ-0..LQ-3 use a fake provider and PGlite, assert grounded context/reply, no action execution, DB unchanged, `fetch` spy not called.
- **AC5 — MET.** typecheck, lint (0 errors), full suite 265 files / 2905 tests, offline build all exit 0. I did not diff the pre-existing tests (git is off-limits); the full suite passing with no skips is my evidence they remain intact.

### Not verified here (MANUAL-QA)
Real-provider answer quality for each list category in Romanian and English against current settings and the operations dashboard, after deploy.

Verdict: PASS
Denied or attempted commands: none.
