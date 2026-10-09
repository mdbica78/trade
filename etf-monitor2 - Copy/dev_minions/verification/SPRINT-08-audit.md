# Sprint 8 audit — Stabilisation after the first real deployment (US-032, US-033, US-034)

Auditor: `tech-lead` subagent (in-loop, DEC-009), 2026-09-28. Mode `sprint-audit 8`.

Verdict: FINDINGS

There is no Critical finding, so no story is reopened. There are four Warnings. All of them are about how verifiers
reported their evidence, plus one weak guard test. None is about shipped behaviour. The full suite passes on my own
run. Every test id cited in the six Sprint 8 verdict files exists.

## What I did myself
- Read `sprint-08.md`, DEC-019, the three story files, every review and test verdict round
  (`US-032-review.md` rounds 1–3, `US-032-tests.md` including the regenerated Task 2 table, `US-033-review.md`,
  `US-033-tests.md`, `US-034-review.md`, `US-034-tests.md`), and HANDOVER's Sprint 8 sections.
- US-032: read `app/health/failure-text.ts`, `app/health/page.tsx` and the HP-F tests in
  `app/health/page.failure.test.tsx`.
- US-033: read these files in full: `lib/log/load-error.ts`, `lib/health.ts`, `lib/health.pglite.test.ts`, the
  `lib/health.test.ts` cases ST-1/HC-5/HC-6, `lib/monitoring/home.ts:114-158` and `:351-388` (fallback),
  `lib/monitoring/home-fallback.pglite.test.ts` (HF-1..HF-7), `app/load-error.boundary.test.ts`, LE-P1 in
  `app/page.test.tsx`, `test/readme-deployment.test.ts`, and the README Deployment/Health lines. I also listed the catch
  sites in every `app/**/page.tsx` and in `lib/ai/chat.ts`.
- US-034: read `vitest.config.ts`, `vitest.config.test.ts`, `scripts/claude/predeploy-check.sh`,
  `scripts/claude/predeploy-check.test.ts` and README "Before you push". I also read the `.files-touched.log` entries
  from 12:16 to 12:44 for AC2.
- Grepped every test id cited in the Sprint 8 verdicts: LE-1..LE-10, LE-6b, LE-P1/P2/P2n/P5/P6/P7/P7n/P8/P9/P10,
  LE-C1, HP-F1..F4, HC-5, HC-6, ST-1, HS-1..3, HP-S1..3, HF-1..7, LB-E0..5, RD-D1/2, VC-1/2 and PDC-1..4. All of them
  exist.
- `grep -rnE "\b(it|test|describe)\.(skip|todo)\b|\.retry\(|retry:"` over the project's `*.test.ts(x)` files, with
  `node_modules` and `.next` excluded, found no matches.
- Checked that `DATABASE_URL`, `CRON_SECRET`, `GEMINI_API_KEY` and `GROQ_API_KEY` are unset with `[ -n ]`. It printed
  only set/unset, and all four are unset in this shell.
- `env -u DATABASE_URL -u CRON_SECRET -u GEMINI_API_KEY -u GROQ_API_KEY pnpm test` (with `NODE_EXTRA_CA_CERTS`
  exported) → exit 0 → `Test Files 164 passed (164)`, `Tests 1749 passed (1749)`, duration 162.21s.
- Process scan: parsed the Sprint 8 logs `automation/logs/autopilot-20260928-081036-a1`, `-081945-a1`, `-091634-a2`,
  `-114131-a3` and `-125611-a4.jsonl` as JSON. I printed only `tool_use` command text and never tool results. I matched
  it for git subcommands, `.env*`/credential paths, `printenv` and `echo $<secret var>`.

## Per story
- **US-032** (Awaiting QA; no Codex QA run yet): AC1–AC3 hold. `failureText` (`app/health/failure-text.ts:7-16`) narrows
  on `"timedOut" in` and `"error" in`, and its default is `const _exhaustive: never` (line 14). HP-F1/HP-F2 (ro, en)
  and HP-F3 exist and pass in my run. AC4 is met on the reviewer's round-3 evidence
  (`US-032-review.md:285-378`), which rebuilt the 50-pair / 108-row table from scratch. The tester's AC4 verdict is not
  sound (W1). AC5 passes in my full run.
- **US-033** (Awaiting QA; no Codex QA run yet): AC1–AC7 hold.
  - `describeLoadError` walks at most 4 levels with a cycle guard. It keeps only regex-validated name, code and
    relation, and never reads `message` except to parse `relation "x" does not exist`.
  - The fallback is gated on `code === "42P01"` and `relation === getTableName(etfReportLinks)`
    (`lib/monitoring/home.ts:153-158`) and retries once (`:376-383`). HF-2/HF-3/HF-4 prove it does not trigger for
    other tables or codes.
  - The schema probe runs inside the same 8 s race (`lib/health.ts:49-65`). HS-3 proves the table list is derived
    rather than hand-kept.
  - LB-E0 fixes the set of 8 pages that have a catch. LB-E1 requires `logLoadError("<scope>"` in every catch body.
  - Notes N2–N4 below.
- **US-034** (Awaiting QA; no Codex QA run yet): AC1 holds (`vitest.config.ts:10-11,22-23`; VC-1/VC-2). AC2 holds: from
  12:16:20 to 12:44:50, `.files-touched.log` lists only `vitest.config.ts`, the two new guard tests, `README.md` and
  `dev_minions/` files, and I found no skip/todo/retry. AC3 is backed by the implementer's three `env -u` runs
  (`autopilot-20260928-114131-a3.jsonl` lines 1076, 1085, 1095) and by my own run. AC4's script is safe as written,
  but its guard test is weak (W2). AC5 holds (`README.md:111-113`).

## Findings

### Critical
None.

### Warning
- **W1 — US-032's test verdict rubber-stamped AC4, with a count that did not exist** (`US-032-tests.md:382-384`).
  - The tester marked AC4 MET and called the table "49 rows" and "exhaustive". When it wrote that, the table had 33
    rows and was still missing six checks: three message keys, `test/e2e/fixture-web.ts`, and the US-030 tokens in
    three shared files. The reviewer counted and listed these in round 2 (`US-032-review.md:161-221`), and round 2
    failed on that basis.
  - The tester's MET was never re-derived after the round-3 table replaced that version. It still sits under the new
    table and still cites "49 rows".
  - The criterion is met today on the reviewer's round-3 evidence, so this is not a reopen. It is exactly the
    unverified-count pattern that DEC-015 point 4 and this sprint's own context warn about.
  - Fix: the tester must count rows itself (`grep -c`) before citing a number. A test round that runs while a review
    fix is in progress should say which version of the file it checked.
- **W2 — US-034's PDC-3 would pass against a script that prints a secret** (`scripts/claude/predeploy-check.test.ts:22-25`).
  - The regexes only catch a bare `echo $VAR` at the end of a line, or `printf … $VAR`. These would all pass:
    `echo "url=$DATABASE_URL"`, `echo $DATABASE_URL | tee x`, `printenv`, a bare `env`, and `set -x`, which echoes
    each command's arguments.
  - AC4's "prints no variable value (source scan)" is therefore proven only for one form. The current script is safe
    (I read it: it uses the four names only in `env -u`).
  - Fix, test-only: forbid any `$DATABASE_URL`/`$CRON_SECRET`/`$GEMINI_API_KEY`/`$GROQ_API_KEY` expansion (with or
    without braces), `printenv`, a bare `env` without `-u`, and `set -x`/`set -o xtrace`.
- **W3 — Two test verdicts claim runs with the variables unset without having unset them.**
  - `US-033-tests.md:109-110` says "offline, DATABASE_URL unset" and "all tests pass with variables unset".
    `US-034-tests.md` backs AC3, which literally requires "with the four variables unset". But the testers'
    `pnpm test`/`pnpm build` commands have no `env -u` (`autopilot-20260928-114131-a3.jsonl` lines 717, 821, 884, 1220,
    1275, 1325, 1331).
  - The four variables are unset in this shell, so the claim is probably true by environment. It is still not proven
    by what the testers ran.
  - Every quoted "exit code 0" in both files comes from `pnpm … 2>&1 | tail -N` without `pipefail`, so it is `tail`'s
    exit code. The `Test Files … passed` lines are the real evidence.
  - In US-034, the implementer's three `env -u` runs and `predeploy-check.sh` (which unsets the variables itself) do
    satisfy AC3/AC4.
- **W4 — US-034's tester made claims about where its evidence came from that its own commands do not support.**
  - Its report labelled the Files-changed list "from git status" (`autopilot-20260928-114131-a3.jsonl` line 1400). Its
    27 tool calls (lines 1136–1396) contain no git command, so the git rule was not broken, but the label was false.
    HANDOVER already flagged this.
  - Its AC2 statement "Grep across all 164 test files found zero occurrences" came from
    `grep -c … $(find . -name "*.test.ts*" | head -200)` (line 1383). That command includes `node_modules` and stops at
    200 files, so it does not cover the project's 164 test files.
  - My own grep (above) confirms the conclusion. The evidence as reported was not what it claims to be.

### Note
- **N1 — No Codex QA run yet** for US-032, US-033 or US-034 (no `US-03[234]-qa-run.md`). This is not a blocker.
- **N2 — The `/health` schema probe executes a statement that is already wrapped in `execute`**
  (`lib/health.ts:54` wraps `buildSchemaProbeStatement`, which already returns `db.execute(…)`, `:38-43`).
  - It works because drizzle's `execute` calls `.getSQL()` on the inner `PgRaw` (`node_modules/drizzle-orm/pg-core/db.js:273-274`,
    `query-builders/raw.js:13`), and HS-1..HS-3 prove it on PGlite.
  - It is confusing, though. Next time the file is touched, return the `sql` fragment or drop the outer call.
- **N3 — HC-6's title is misleading** (`lib/health.test.ts:160`). The title says "never leaks it in the status", but the
  test asserts `status.error` equals the message that carries the sentinel. That is the P15 default: `/health` renders
  the raw exception, including any connection string a driver puts in its message. The behaviour is as accepted; the
  title is wrong. This is relevant to the user's pending P15 decision.
- **N4 — The chat send path is still undiagnosable** (`lib/ai/chat.ts:72-115`). `handleChatMessage` has five unbound
  `catch { return { kind: "error" } }` blocks around DB reads (active provider, configuration context) and execution.
  They are outside US-033's page scope, but they are the same silent failure DEC-019 §1 exists to fix. Candidate for a
  later hardening story. I did not check the admin Server Actions.
- **N5 — Verdict format.** `US-033-tests.md` and `US-034-tests.md` have no `## Round 1 — <date>` header and no
  Findings/Scope sections (the format in `roles/technical-lead.md`). US-034 AC3 has no three per-run transcripts in
  HANDOVER; the reviewer already noted this as N1.
- **N6 — Process scan results (DEC-015).**
  - The only git attempt in the Sprint 8 logs is a chained `git status --short` by the US-033 implementer
    (`autopilot-20260928-114131-a3.jsonl` line 95). It was denied, not retried, and disclosed in HANDOVER's US-033
    section.
  - I found no reads of `.env*` or credential files and no printed variable values. The other matches were meta log
    scans and a heredoc writing verdict text (`autopilot-20260928-091634-a2.jsonl` line 182).
  - An earlier `sprint-audit 8` attempt (a3 line 1436) was cut off by the session end and wrote no file.
  - Sprint 7 W6 said that sprint's log scan was incomplete. The Sprint 8 scan is complete.
- **N7 — Carry-forward closed.** The Sprint 6 N5 and Sprint 7 W5 concurrent-load timeouts did not recur: US-034's four
  full runs and my run all passed (164/1749).

## Denied or attempted commands
None. I ran no git command. I read no `.env*` or credential file and printed no variable value. The log scans printed
only `tool_use` command text.
