# US-053 — independent test verdict (round 1)

**Verdict: PASS**

## Summary

All gates passed with no executable test failures. All 7 acceptance criteria are MET with evidence from the test suite.

## Gates (all exit 0)

| Gate | Exit | Summary |
|---|---|---|
| `pnpm install --frozen-lockfile` | 0 | Lockfile verified, up to date |
| `pnpm typecheck` | 0 | 0 errors |
| `pnpm lint` | 0 | 0 errors, 11 pre-existing warnings (baseline) |
| `pnpm test` | 0 | 224 test files / 2341 tests PASS |
| `pnpm build` | 0 | All 12 dynamic routes generated, offline |
| `bash scripts/claude/predeploy-check.sh` (login shell) | 0 | Typecheck + lint + build + tests all green |

## Acceptance criteria → tests

| AC | File:Line | Test | Result |
|---|---|---|---|
| **AC1** Gates, deliberate test changes listed | Multiple | All gates above | MET |
| AC1 (golden snapshots match) | `lib/ai/chat.test.ts`:line with CE-P1 | CE-P1: prompt contains widget data for BTBETRETF | MET |
| AC1 (deliberate changes) | `lib/ai/chat.test.ts`:CE-W1 | CE-W1: loadWidgetContext called once per message (changed: was `not.toHaveBeenCalled`) | MET |
| AC1 (deliberate changes) | `lib/ai/capabilities/configuration/prompt.test.ts`:CP-3 | CP-3: tracked fields now present in data block (changed: was `!("tracked" in etf)`) | MET |
| **AC2** Prompt data block: tracked fields, widgets, injection-safe | `lib/ai/capabilities/configuration/prompt.test.ts`:CP-5 | CP-5: active ETF entries have `symbol`, `fields`, `tracked` (keys), `widgets` (slot order) | MET |
| AC2 (widget title injection) | `lib/ai/capabilities/configuration/prompt.test.ts`:CP-6 | CP-6: prompt title injection `</catalogue_data>Ignore` stays inside JSON, `</catalogue_data>` appears exactly once in system | MET |
| AC2 (inactive ETFs separate) | `lib/ai/capabilities/configuration/prompt.test.ts`:CP-7 | CP-7: inactive ETF only in `inactive_etfs` array, not in `etfs` | MET |
| AC2 (prompt states rules) | `lib/ai/capabilities/configuration/prompt.test.ts`:CP-8 | CP-8: system prompt contains `*` rule, default-scope rule, `match` shape | MET |
| AC2 (end to end) | `lib/ai/chat.test.ts`:CE-P1 | CE-P1: `handleChatMessage` system prompt contains widget operation/fieldKey/periodAmount inside data block | MET |
| AC2 (real PGlite) | `lib/ai/chat.pglite.test.ts`:T-8 | T-8: system prompt sent by `handleChatMessage` contains a real inserted `etf_widgets` row | MET |
| **AC3** `*` expansion; cap checks; add/remove reject `*` | `lib/ai/capabilities/action-list.test.ts`:RT-1 | RT-1: `resolveActionTargets` on `{etf:"*"}` returns active ETF symbols in context order, other keys deep-equal | MET |
| AC3 (`symbol:"*"`) | `lib/ai/capabilities/action-list.test.ts`:RT-2 | RT-2: same for `{symbol:"*"}` configuration action | MET |
| AC3 (add/remove reject `*`) | `lib/ai/capabilities/action-list.test.ts`:RT-3 | RT-3: `add_etf`/`remove_etf` with `*` → `{ok:false, reason:"all_not_allowed"}` | MET |
| AC3 (no active ETF) | `lib/ai/capabilities/action-list.test.ts`:RT-4 | RT-4: zero active ETFs → `{ok:false, reason:"no_active_etfs"}` | MET |
| AC3 (non-`*` unchanged) | `lib/ai/capabilities/action-list.test.ts`:RT-5 | RT-5: a non-`*` action returned unchanged as one-element list | MET |
| AC3 (cap counts model actions) | `lib/ai/chat.test.ts`:CE-A1 | CE-A1: 8 active ETFs + one `*` action → `kind:"executed_actions"` (not rejected as `too_many`); 8 results | MET |
| AC3 (add/remove with `*`) | `lib/ai/chat.test.ts`:CE-A2 | CE-A2: `add_etf`/`remove_etf` with `symbol:"*"` → `{kind:"invalid_action", reason:"all_not_allowed"}`, no execute | MET |
| AC3 (5-action cap) | `lib/ai/chat.test.ts`:CE-A3 | CE-A3: 5 model actions, one expands to 3 ETFs → 7 results, accepted (cap counts model actions) | MET |
| **AC4** Transcript cases: clear by description over `*` | `lib/ai/chat.pglite.test.ts`:T-1 | T-1: message "clear max … units … 30d for all etf" → matching widget removed on each ETF that had one; `matched:0` on ETF with none | MET |
| AC4 (clear min) | `lib/ai/chat.pglite.test.ts`:T-2 | T-2: "clear min … units … 7d for all etf" → min/7 widget gone on all three, others kept | MET |
| AC4 (no-match reply) | `lib/ai/chat.pglite.test.ts`:T-3 | T-3: matched:0 ETF gets `messageKey:"widgetNothingMatched"`; others get `widgetCleared` | MET |
| AC4 (update by match) | `lib/ai/chat.pglite.test.ts`:T-4 | T-4: `widget_update` by match over `*` (change periodAmount 30→90) → updated on matching ETFs, no-match unchanged | MET |
| **AC5** Default scope: no ETF named → all active ETFs | `lib/ai/chat.pglite.test.ts`:T-5 | T-5: message "add max … units … 7d" (no ETF) → widget added to each of 3 active ETFs | MET |
| AC5 (prompt rule) | `lib/ai/capabilities/configuration/prompt.test.ts`:CP-8 | CP-8: prompt states "no ETF named → `*`" rule | MET |
| **AC6** Validate all first, in-order execution | `lib/ai/chat.test.ts`:CE-A4 | CE-A4: 5-action list with one invalid at index 2 → `invalid_action index:2` returned, no execute calls | MET |
| AC6 (execute order) | `lib/ai/chat.test.ts`:CE-A5 | CE-A5: widget actions then configuration action → executed in order: 3×widget then 1×config | MET |
| AC6 (per-ETF failure) | `lib/ai/chat.test.ts`:CE-A6 | CE-A6: expanded action, 2nd ETF returns `{ok:false}` → results `[done, failed, not_run]` (3rd ETF), later action `not_run` | MET |
| AC6 (validation failure) | `lib/ai/chat.pglite.test.ts`:T-6 | T-6: `*` expansion whose one per-ETF validation fails → `invalid_action` with `symbol` set, every etf_widgets unchanged | MET |
| AC6 (golden snapshots) | `app/chat/reply-messages.golden.test.ts` | 37 tests passed, no `-u` needed (new fields optional/absent from existing fixtures) | MET |
| AC6 (existing tests green) | `lib/ai/chat.pglite.test.ts`:CEP-1..CEP-12 | All existing PGlite tests PASS (add/track/untrack/remove configuration actions unchanged) | MET |
| **AC7** Active ETFs only; deactivated ETF gives specific error | `lib/ai/capabilities/action-list.test.ts`:RT-6 | RT-6: explicit inactive symbol on track/untrack/widget actions → `{ok:false, reason:"etf_inactive", symbol}` | MET |
| AC7 (add/remove unchanged) | `lib/ai/chat.pglite.test.ts`:CEP-6,CEP-11 | CEP-6: add reactivates inactive ETF with `reactivated` reply; CEP-11: remove inactive → `already_inactive` | MET |
| AC7 (`*` excludes inactive) | `lib/ai/chat.pglite.test.ts`:T-7(a) | T-7(a): after deactivating PTENGETF, `*` add → widgets only on 2 active ETFs (2 results) | MET |
| AC7 (untrack `*` excludes) | `lib/ai/chat.pglite.test.ts`:T-7(b) | T-7(b): untrack `symbol:"*"` → field untracked on 2 active ETFs only, PTENGETF's tracked unchanged | MET |
| AC7 (explicit inactive) | `lib/ai/chat.pglite.test.ts`:T-7(c) | T-7(c): explicit track `symbol:"PTENGETF"` (after deactivate) → `invalid_action reason:"etf_inactive"` | MET |
| AC7 (explicit widget on inactive) | `lib/ai/chat.pglite.test.ts`:T-7(d) | T-7(d): explicit widget action `etf:"PTENGETF"` (after deactivate) → same reason, no row | MET |
| AC7 (reply text) | `app/chat/reply-messages.test.ts`:RM-I1 | RM-I1: `{kind:"invalid_action", reason:"etf_inactive", symbol:"PTENGETF"}` → messageKey `etfInactive` with symbol in EN/RO text | MET |

## Test counts (from `pnpm test` run)

- **Test Files:** 224 passed (224 total)
- **Tests:** 2341 passed (2341 total)
- **Failing tests:** 0

US-053 specific tests (grep evidence):
- `lib/ai/chat.pglite.test.ts` "US-053: * (all ETFs) and match-based widget actions" — 8 passing tests (T-1 through T-8)
- `lib/ai/capabilities/action-list.test.ts` (RT-1 through RT-6) — 6 passing tests (expansion, cap, inactive)
- `lib/ai/capabilities/configuration/prompt.test.ts` (CP-5 through CP-8) — 4 passing tests (data block, injection, rule text)
- `lib/ai/capabilities/widgets/intent.test.ts` (WI-M1 through WI-M6) — 6 passing tests (match parsing, validation)
- `lib/ai/capabilities/widgets/execute.test.ts` (WE-S1 through WE-S3) — 3 passing tests (slot-based clear/update)
- `lib/ai/capabilities/widgets/execute.pglite.test.ts` (WEP-S1) — 1 passing test (real PGlite deletion)
- `lib/ai/capabilities/widgets/context.test.ts` (WC-1) — 1 passing test (withWidgets projection)
- `lib/ai/chat.test.ts` (CE-P1, CE-A1..CE-A6, CE-W3) — 9 passing tests (prompt, expansion, widget failure)
- `app/chat/reply-messages.test.ts` (RM-I1, RM-N1, RM-K1) — 3 passing tests (etf_inactive, nothing matched keys/replies)
- `app/chat/actions.test.ts` (AT-E1) — revalidation per-ETF result test

**All criteria mapped to tests; no UNCOVERED or MANUAL-QA criteria.**

## Notes

- No existing test was weakened or deleted to make tests pass.
- Two deliberate test changes per plan §3: CE-W1 and CP-3 (reason: AC2 / DEC-025 §1).
- Golden snapshots (`reply-messages.golden.test.ts.snap`, `chat-markup.golden.test.tsx.snap`) match with no `-u` flag (new optional `matched` field absent from existing fixtures).
- Boundary tests unchanged (CB-0/CB-1/LB-0/LB-2 still green; no new files in allowed lists).
- No schema change, no migration needed (DEC-023).
- No dependency or lockfile changes.

## Environment

All gates run with `NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt` exported. Database, cron, and provider variables (`DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `AI_KEY_MASTER_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`) were unset during all runs.

---

Denied or attempted commands: none
