# US-060 — independent test verdict

## Round 1

Tester: independent context (did not write the code). Environment: PowerShell, `etf-monitor2`, `pnpm` via `corepack pnpm`;
`DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `AI_KEY_MASTER_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY` removed from the process
environment before each gate (no value printed). No source or test file edited by me.

### Gates (my own runs)
| Command | `$LASTEXITCODE` | Key output |
|---|---|---|
| `corepack pnpm typecheck` | 0 | `tsc --noEmit`, no errors |
| `corepack pnpm lint` | 0 | `✖ 22 problems (0 errors, 22 warnings)` (unused `_name`-style test args, same baseline style) |
| `corepack pnpm test` (output to a scratch file, since deleted) | 0 | `Test Files  261 passed (261)` / `Tests  2839 passed (2839)` / `Duration 162.07s`; no failing file |
| `corepack pnpm build` | 0 | `migrate-on-deploy: skipped (not a production build)`, `✓ Compiled successfully`, `✓ Generating static pages (6/6)`, route `ƒ /admin/etfs` present; single expected `[load-error] home name=MissingDatabaseUrlError` (no DB offline) |

### Files named in the task — seen passing in my full-suite run
- `components/admin/EtfAdmin.test.tsx` — 5 tests ✓ (EA-S1, EA-S2, EA-S3, EA-A1, EA-E1)
- `app/admin/etfs/page.test.tsx` — 11 tests ✓ (incl. PG-SEL, PG-ADD, EA-1, PG-6, PG-7b)
- `lib/extraction/discovery.test.ts` — 45 tests ✓ (incl. the `parseInstrumentName (US-060 AC3)` block)
- `lib/extraction/discovery.icbetnetf.test.ts` — 5 tests ✓
- `lib/config/detect-adapter.test.ts` ✓ (DA-1/4/6/7, DA-N1 printed in the run)
- `lib/config/etfs.test.ts` — 23 tests ✓; `lib/config/etfs.pglite.test.ts` — 21 tests ✓; `lib/config/etfs.report-link.pglite.test.ts` — 11 tests ✓
- `app/admin/etfs/actions.test.ts` — 9 tests ✓; `app/admin/etfs/result-messages.test.ts` — 14 tests ✓
- `lib/ai/capabilities/configuration/execute.test.ts` — 13 ✓; `execute.pglite.test.ts` — 6 ✓
- `parseInstrumentName` on the four committed BVB fixtures (BTBETRETF, TVBETETF, PTENGETF, ICBETNETF): asserted in `discovery.test.ts` lines 91-94, one `it` per symbol, expected names e.g. `INTERCAPITAL BET-TRN UCITS ETF` — all in the passing 45.

### Acceptance criteria
- **AC1 — MET (server-rendered/markup level) + MANUAL-QA (real browser).**
  `EtfAdmin.test.tsx` EA-S1 (form `method="get"`, a `<select>` listing every symbol, selected option marked, label/submit text in en+ro), EA-S2 (panel shows only the selected ETF: status/active toggle, adapter set, re-detect, remove vs activate, `/admin/etfs/<SYMBOL>/fields` link), EA-S3 (absent/blank/unknown/case-variant `symbol` fallback); `page.test.tsx` PG-SEL (native GET form, bad or repeated `?symbol` falls back), PG-2/PG-3, EA-1. Actual no-JavaScript submission in a real browser: MANUAL-QA.
- **AC2 — MET.** `EtfAdmin.test.tsx` EA-A1 (exactly one `<input>` in the add section, `name="symbol"`, no `name="name"`, hint, both locales); `page.test.tsx` PG-ADD; `actions.test.ts` line 31 test (`addEtf` called with exactly `{symbol}` even when the form carries `name`/`bvb_url`/etc.) and the missing-symbol rejection test. Same configuration path as chat: `execute.test.ts` EX-1 asserts chat's `addEtf` call is `{ symbol }` with the shared deps.
- **AC3 — MET.** `discovery.test.ts` parser block: four real fixtures yield the names; `undefined` for 9 malformed/ambiguous titles (no title, empty, other symbol, no name, too deep, not BVB, markup, >200 chars); entity decoding/whitespace/case; `discoverLatestReport` carries the name on `found`/`not_found` and never on `error`. `etfs.pglite.test.ts` CE-A1 (real chain, stored name = BVB fixture name `FONDUL DESCHIS DE INVESTITII BT INDEX ROMANIA ETF BET TR`), CE-A2 (no name → name = normalised symbol, row inserted), CE-N1 (`undefined`/`""`/`"   "` → symbol; smuggled `name` ignored), CE-N2 (trimmed). `etfs.name NOT NULL` unchanged (no schema/migration in the change list; PGlite inserts succeed with fallback).
- **AC4 — MET.** `execute.test.ts` EX-1 (`addEtf` called with `{symbol}` only); `chat.pglite.test.ts` CEP-5 (model-supplied `name: "Fond Test"` ignored, stored name = `XYZ`) and CEP-5b (stored name = BVB-detected name with model `name: null`), end to end over PGlite.
- **AC5 — MET.** `etfs.pglite.test.ts` CE-M9 (nameless/blank/whitespace detection with `fetch_error` keeps the stored name; a fresh valid name `" Fresh BVB Name "` stored trimmed), `detect-adapter.test.ts` DA-N1 (name rides on every outcome after a successful page fetch, absent when the page fails), `etfs.report-link.pglite.test.ts` RL-5, CE-M5/CE-M6; `actions.test.ts` generic-error test (no raw message, no revalidation) and `page.test.tsx` PG-5 safe load error; all offline via committed fixtures, fakes and PGlite. Live BVB add/re-detect: MANUAL-QA.
- **AC6 — MET for automated parts; MANUAL-QA for the rest.** Both locales: EA-S1/EA-A1/EA-E1 render en and ro, PG-6 checks no cross-locale leakage. Typecheck, lint, full suite and offline build all exit 0 (table above). Golden markup: the HANDOVER states no existing golden snapshot covered EtfAdmin and none was regenerated; the full suite (incl. `admin-markup.golden.test.tsx`) passes unchanged. Both themes, keyboard use and responsive layout of the selector/panel: MANUAL-QA (browser-only).

### Findings
None blocking. Observation: no stylistic/theme/responsive automated test exists for the new selector/panel markup (covered only as MANUAL-QA above), and no new golden snapshot was added for the redesigned `EtfAdmin`; the plan's optional golden-markup item is therefore not evidenced by a snapshot, only by the component tests.

Verdict: PASS

Denied or attempted commands: none.
