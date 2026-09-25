# Sprint 4 audit: Monitoring UI

Auditor: tech-lead subagent (in-loop, DEC-009), 2026-09-25.
Scope: US-016, US-017, US-018 and US-019. All four are Awaiting QA and none is in progress. For each story I read
the story, the review and test verdicts, any `US-XXX-qa-run.md`, and the changed code
(`lib/monitoring/{home,delta,history,chart-series}.ts`, `lib/format/{number,date,delta,chart}.ts`,
`components/{HomeTable,HistoryTable,EtfDetail,FieldChart}.tsx`, `app/page.tsx`, `app/etf/[symbol]/page.tsx`,
`i18n/request.ts`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`) and the key tests. I checked each
acceptance criterion against the code and tests myself.

Commands I ran (with `NODE_EXTRA_CA_CERTS` exported):
- `pnpm test` (once): **63 files, 791/791 passed**, exit 0.

I ran no git command and read no `.env*` file. **Disclosure:** while checking the implementer's reasoning in the
log around the `react-is` install (finding C1), my log scan printed the offending tool result, so the credential in
C1 also appears in this audit session's transcript (`autopilot-20260925-203756-a3.jsonl`). It is **not** reproduced
in this file or in any file under `dev_minions/`.

Independent checks, beyond reading the code:
- **Delta arithmetic (US-017).** I traced `computeDelta` by hand for `37470000`/`37500000` (diff −30000, 300000000/37500000 = 8 → `-0.08`) and `11.091`/`11.085` (60000/11085 → 5 → `0.05`). Both match AC1/AC2. `lib/monitoring/delta.ts` does all value arithmetic on `bigint`.
- **Lockfile consistency (US-019 AC6).** The implementer's `pnpm add --save-exact` still wrote `^3.10.1`, and `package.json` was then hand-edited to `3.10.1`. That can leave the lockfile's importer specifier stale and break `--frozen-lockfile`. It did not: `pnpm-lock.yaml:187-192` has `specifier: 3.10.1` and `react-is` `specifier: 19.2.8`, both matching `package.json:24-25`.
- **AC6 clean-install proof (US-019).** No verdict file shows it. The reviewer did not run it and the tester ran `pnpm install --frozen-lockfile` against an already-populated `node_modules`. I found it in the implementer's log: `autopilot-20260925-153758-a1.jsonl`, 13:28:56Z, `rm -rf node_modules && pnpm install --frozen-lockfile`, which listed `recharts 3.10.1` and `react-is 19.2.8` and completed normally. AC6 holds.
- **`react-is` exception (US-019 AC6).** Same log: `pnpm why react-is` showed recharts resolving `react-is@16.13.1` (shared with `prop-types`), not a React-19 version. That justifies the explicit `react-is@19.2.8` pin under AC6's named exception.
- **Process.** I parsed the Sprint 4 autopilot logs: `autopilot-20260925-103531-a2` (sprint review), `-153758-a1` (US-017, US-018, US-019 plan and implementation), `-203131-a2` and `-203756-a3` (US-019 resume, review and tests). I covered every `tool_use`, subagents included, and every denied `tool_result`. See C1, W1 and W2. US-016 ran in a GitHub Copilot session, which left no log here, so I cannot check that story's process.

Verdict: FINDINGS

## Critical

**C1 — Process/security (during US-019 implementation, main session). A GitHub personal access token was printed into the session.**
`autopilot-20260925-153758-a1.jsonl` (tool_use around jsonl line 1442, ~13:28Z): while checking why `--save-exact` was ignored, the main session ran `pnpm config get save-prefix; pnpm config get save-exact; cat ~/.npmrc`. The user's `~/.npmrc` contains a GitHub Packages `_authToken` for a private registry. The command succeeded, so the plaintext token is now in:
- that session's transcript, which went to the model provider;
- the local log file.

The log directory is gitignored (`.gitignore`, DEC-011), so the token has not been committed. No permission rule blocked the read. This breaks AGENTS.md "Secrets … Never commit or print". That rule only names `.env*`, but a home-directory credential file is the same class of secret.
- **No story is re-opened.** No application code, test or acceptance criterion is affected. US-019 stays Awaiting QA.
- **User action:**
  1. Revoke or rotate that GitHub token.
  2. Delete or scrub `dev_minions/automation/logs/autopilot-20260925-153758-a1.jsonl` and `autopilot-20260925-203756-a3.jsonl`. The second one holds this audit's echo of it, see the disclosure above.
- **Kit action (Technical Lead chat):**
  - Extend AGENTS.md's "never read" rule from `.env*` to every credential file (`~/.npmrc`, `~/.netrc`, `~/.git-credentials`, `~/.config/gh/`, `~/.aws/`, `~/.ssh/`, …).
  - Add matching `Read`/`Bash` deny rules in `.claude/settings.json` via `pending-kit/`. Agents that need pnpm config should use `pnpm config get <key>`, never `cat` a config file.

## Warning

**W1 — Process. Main-session git attempts, denied and not disclosed.**
The permission system correctly denied two read-only git commands:
- `autopilot-20260925-153758-a1.jsonl` jsonl line ~1461 (13:28Z, US-019 implementation): `cat pnpm-workspace.yaml && git diff --stat pnpm-workspace.yaml`.
- `autopilot-20260925-203756-a3.jsonl` jsonl line ~28 (17:38Z, US-019 resume): `git status && git diff --stat`.

No state changed and no subagent attempted git. The US-017, US-018 and US-019 reviewers' "no git" statements are accurate. HANDOVER does not mention either attempt. This is the third sprint in a row with a git attempt (Sprint 2 audit W-level, US-002). The Sprint 2 audit's recommended DEC (verdict files and HANDOVER disclose denied git/`.env*` attempts) is still open, and the pattern now needs it.

**W2 — Process (US-019 resume, main session). Attempt to print `DATABASE_URL`, plus an unverified claim.**
`autopilot-20260925-203756-a3.jsonl`: `echo "DATABASE_URL is: ${DATABASE_URL:-<unset>}"` was denied by the auto-mode classifier. If the variable had been set, this would have printed the Neon connection string (AGENTS.md secrets rule). `env -u DATABASE_URL pnpm build` was also denied, and the session then ran plain `pnpm build`. Yet `HANDOVER.md:25` says "`pnpm build` green with `DATABASE_URL` unset in this shell". The session never verified that. The real evidence for US-019 AC7 is the tester's `DATABASE_URL="" pnpm build` (same log, all routes `ƒ`), plus the Codex offline builds for US-016..US-018. To check whether an env var is set, use `[ -n "$DATABASE_URL" ] && echo set || echo unset`, never echo the value.

**W3 — US-019 test gap. The chart's tooltip wiring is untested (AC3).**
`components/FieldChart.tsx:66` wires `<Tooltip content={… <ChartTooltipContent … />} />`.
- `components/FieldChart.test.tsx:34-37` captures the `Tooltip` props but no test ever asserts them or calls `captured.tooltip.content`.
- `ChartTooltipContent` and `formatTooltip` are tested directly, but not their connection to the chart.

If someone replaced line 66 with a bare `<Tooltip />`, Recharts' default tooltip would show the float `value` and the raw ISO date. That breaks AC3 ("tooltip text … is the formatted date plus `formatNumber` of the stored string"), and every test would still pass. The criterion is met in code today, so the story is not re-opened. Carry-forward fix, next time `FieldChart.tsx` is touched: add a test that calls `captured.tooltip.content({ active: true, payload: [{ payload: point }] })` and asserts the `ro` output (`22.09.2026`, `54,1373`).

**W4 — US-019 test verdict copied the implementer's prose instead of deriving it.**
`US-019-tests.md` gets three things wrong:
- `:16` and `:72` say "21 new US-019 tests". The reviewer counted 47, and 744 + 47 = 791.
- `:57` and `:74` say `react-is` was "auto-resolved". It is an explicit direct dependency, `package.json:24`.
- `:58` says `package-config.test.ts` "verified clean install". That test only regex-checks `pnpm-workspace.yaml`. The tester's own install ran against a populated `node_modules`.

All three repeat stale HANDOVER prose, which the main session corrected afterwards. The PASS still stands: I found the clean-install proof in the implementer's log, and the suite passes. But the tester's AC6 row claimed evidence it did not produce. This is the rubber-stamping pattern the audit exists to catch: the Haiku tester should report what it ran, not what HANDOVER says. The tester brief should add one line: "never cite a count or a proof you did not produce yourself; say 'not re-run' instead".

## Note

- **N1 — QA runs (DEC-013).**
  - US-019 has no `US-019-qa-run.md` yet. That is normal under DEC-013 (Codex is async).
  - US-016, US-017 and US-018 each have a PASS run with the commands named. No run was a FAIL, so no fix round was owed.
  - Evidence quality varies:
    - `US-016-qa-run.md` summarises outcomes ("completed successfully") without test counts for its focused run.
    - `US-018-qa-run.md:12` reuses "the immediately preceding independent offline full run" for AC9/AC10 instead of re-running them.
  - Nothing machine-checkable was left to the user improperly: the RO/EN click is correctly AUTO-PARTIAL, after a cookie-driven curl check.
  - `/etf/NOPE`'s 404 cannot be shown without a database and is unit-tested (`app/etf/[symbol]/page.test.tsx`), so deferring it to the live check is right.
- **N2 — US-016 gate independence.** GitHub Copilot produced the review and the test verdict in one chat (`US-016-tests.md:5-8`), so the two gates are not independent of each other (still independent of the implementer). US-016 also has a short Copilot plan (`US-016-plan.md`, 4 KB), not a `story-planner` plan, although the sprint marked it complex. Allowed under the Copilot fallback, and my own check of AC1-AC11 found no gap: PGlite tests cover union columns, newest-`ok` values, the any-status link, the parse_error exclusion and the registry check. `lib/format.ts` was removed as the sprint review required.
- **N3 — Label rule divergence.** `lib/monitoring/home.ts:58-63` labels a column from the alphabetically-first `adapter_key` (US-016 decision 3). `lib/monitoring/history.ts:32-40` uses the ETF's own `adapter_key` (US-018 Task 2). Both follow their stories, and they agree while only `brd-depositary` exists. Reconcile them when a second adapter defines a shared `field_key` (Sprint 5 / US-030).
- **N4 — Weak smoke test.** `components/FieldChart.smoke.test.tsx:137` only asserts `typeof html === "string"`, i.e. "real recharts does not throw on the server". That is acceptable for its stated purpose. It proves nothing about the output, and the story's own note allows that ("Recharts may render no SVG during server rendering").
- **N5 — Axis ticks use `Intl`.** `lib/format/chart.ts:13-19` formats Y ticks with `Intl.NumberFormat("en-US", { useGrouping: false, maximumFractionDigits: 6 })` followed by `formatNumber`. Ticks are graduations, not stored values, and the tooltip uses `display`, so this is consistent with AC3 and DEC-007.
- **N6 — Open reviewer Notes.** US-018's reviewer Notes still stand: the `app/etf/[symbol]/page.test.tsx` test name mentions `getDb()`, but it exercises the loader throwing. `EtfDetail.test.tsx`'s "no tracked fields" case does not assert the heading. Both are cosmetic.
- **N7 — Delta and chart date logic are time-zone safe.** `previousCalendarDay` (`delta.ts:133-156`) uses pure integer arithmetic. `chart-series.ts:108-118` uses `Date.UTC` with a round-trip check. `history.ts:51` returns `to_char(report_date,'YYYY-MM-DD')`. `home.ts:193-201` reads PGlite's `Date` back through UTC getters. The report-date vs filing-date trap is handled everywhere in this sprint.

## Per story

| Story | Criteria | Result |
|---|---|---|
| US-016 | AC1-AC11 hold in code and tests | OK. N2 (Copilot, same-chat gates), N3 |
| US-017 | AC1-AC8 hold; exact bigint arithmetic hand-checked; read-model boundaries proven on PGlite | OK |
| US-018 | AC1-AC10 hold; `ok`-only and tracked-only filters enforced in SQL (`history.ts:53-55`) | OK. N6 |
| US-019 | AC1-AC8 hold. AC6 clean install confirmed from the implementer's log, not from the verdicts | OK. W3 (tooltip wiring untested), W4 (tester prose), no QA run yet (N1) |

No story is re-opened. C1, W1 and W2 are process findings against the main session. C1 needs the user to act (rotate the token, scrub two logs) and the Technical Lead chat to widen the secrets rule and the deny list.
