# DEC-015 — Verification honesty, secrets, product-question handling and kit hygiene

- Status: **Decided** — Technical Lead chat, 2026-09-25, from the Sprint 2–4 audits and the technical
  review done after the PO's 2026-09-25 process cleanup
- Amends: DEC-005 (secrets rule, verifier rules), DEC-009 (how agent-found product questions are handled),
  DEC-013 (QA evidence)
- Kit files: `AGENTS.md`, `CLAUDE.md`, `automation/goal.txt`, `roles/technical-lead.md`, `roles/qa.md`,
  `pending-kit/` (all four agents, both skills, `settings.json`, Copilot instructions and prompts),
  `scripts/claude/install-kit.sh`

## Context

The sprint audits kept finding the same process gaps:
- **Secrets.** A session ran `cat ~/.npmrc` and printed a GitHub token into its transcript and two local
  logs (Sprint 4 C1); another tried to `echo $DATABASE_URL` (Sprint 4 W2). The rules and deny list only
  covered `.env*`.
- **Undisclosed denied commands.** Denied `git` attempts in Sprints 2 and 4 appear in no verdict file or
  handover (Sprint 2 W, Sprint 4 W1); a verdict could truthfully say "no git commands were run".
- **Evidence the verifier did not produce.** The tester cited a test that did not exist (Sprint 3 C1/W2)
  and copied counts and a "clean install" claim from HANDOVER prose (Sprint 4 W4). Codex QA rows said
  "completed successfully" without command or output (Sprint 3 W1, Sprint 4 N1).

The review of the kit after the PO's cleanup also found contradictions:
- The installed `tech-lead` agent still said Codex may run `git push` (removed from DEC-013).
- `CLAUDE.md` still delegated QA to the retired `qa-runner`, whose stub is still installed.
- The reviewer brief said a live-only criterion is `MET (manual QA)`; the checklist in
  `roles/technical-lead.md` said `UNVERIFIED — MANUAL-QA`, never MET; the tester says `MANUAL-QA`.
- The tester ran plain `pnpm install`, which can rewrite `pnpm-lock.yaml` — a verifier changing a file.
- The `deliver-story` skill blocked every story with a product question, while `process.md` §4 and
  Sprints 3–4 in practice shipped an isolated default and listed the question for the user (P1–P11).
- About 25 `*.bak-*` files next to the kit files, plus duplicates of files the PO already archived.

## Decision

1. **Secrets.** Never read or print `.env*` (except `.env.example`) or a credential file (`~/.npmrc`,
   `~/.netrc`, `~/.git-credentials`, `~/.config/gh/`, `~/.aws/`, `~/.ssh/`), and never print a
   variable's value. Check a variable with `[ -n "$VAR" ] && echo set || echo unset`; read pnpm
   settings with `pnpm config get <key>`. `.claude/settings.json` denies `Read` of those files and
   Bash commands that name them, and `printenv`.
2. **Disclose attempts.** Every verdict file (review, tests, sprint audit, QA run) ends its round with
   `Denied or attempted commands:` — any git or secret-touching command tried, even if denied, or
   "none". The main session writes its own into the `HANDOVER.md` log. A denied command is never
   retried in another form.
3. **Own evidence only.** A verifier cites only what it ran or read itself in this round. Counts,
   test names and proofs come from its own output; otherwise it writes "not re-run". Every test name
   it cites is grep-confirmed in the test files first. "Clean install" is claimed only if it ran
   `rm -rf node_modules && pnpm install --frozen-lockfile` itself. Verifiers install with
   `pnpm install --frozen-lockfile` so they never change the lockfile.
4. **One verdict vocabulary.** A criterion is `MET`, `NOT MET`, or `MANUAL-QA` (it genuinely needs a
   live resource and a concrete manual check is written down). PASS = every criterion `MET` or
   `MANUAL-QA` and no Critical finding. Each round is `## Round N — <date>` with `Verdict: PASS|FAIL`
   as its first line. The checklist lives once, in `roles/technical-lead.md`.
5. **QA evidence** (Codex, `roles/qa.md`): every machine check shows the exact command, its exit code
   and the output tail; results from an earlier run are "not re-run".
6. **Product questions found by agents** (aligns the kit with `process.md` §4):
   - TECHNICAL questions raised while detailing a sprint are settled by `tech-lead` in the sprint review
     and recorded in the sprint file's "Decisions needed" table. A DEC file is written only when the
     choice binds beyond the sprint (architecture, schema, a cross-cutting pattern) or when a question
     comes up outside a sprint review.
   - PRODUCT questions: if the story can ship an **isolated default** — the literal reading of the FR,
     with the change confined to code the story names — it ships it, the table marks it
     `NEEDS USER — default shipped`, and the dev loop adds one line under HANDOVER "Waiting on the user"
     (the PO carries it into `status.md`). Otherwise a `NEEDS USER` DEC file and the story is Blocked.
7. **Kit hygiene.** `install-kit.sh` keeps replaced files under
   `dev_minions/_obsolete/kit-backups/<time>/` instead of `*.bak-*` next to them, moves existing
   `*.bak-*` files there, retires `qa-runner.md` (installed and staged copies) and
   `scripts/claude/run-sprint.sh` (use `MAX_CYCLES=1 bash scripts/claude/autopilot.sh`), removes a
   working file when `dev_minions/_obsolete/` holds an identical copy at the same path, and installs the
   Copilot prompts too. Nothing is deleted that has no archived copy.

## Consequences

- A token or connection string can no longer be read by the permission-checked tools; Bash patterns
  are best-effort, so the written rule still matters. The token from Sprint 4 C1 must still be
  rotated by the user.
- Audits can compare verdicts against logs directly: an attempt missing from "Denied or attempted
  commands" is itself a finding.
- The Haiku tester stays (cost); its brief is stricter instead. If W4-style copying recurs, move it to Sonnet.
- Product defaults keep the loop moving, at the cost of possible rework when the user answers
  differently; the story must name the code that holds the default so the change stays small.
- All of this needs one run of `bash scripts/claude/install-kit.sh`.
