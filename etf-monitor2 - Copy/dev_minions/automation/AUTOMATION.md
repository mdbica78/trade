# Automation — how to run the two loops

Development runs in Claude Code (DEC-009), QA in Codex (DEC-013). They share nothing but files under
`dev_minions/`. **The QA loop runs only while the dev loop runs** (DEC-014): start them together.

## Start (both loops)

In WSL, in the project folder:

    cd /mnt/c/_mystaff/myG/trade/etf-monitor2
    bash scripts/claude/install-kit.sh        # only after a kit update in pending-kit/ (see below)
    tmux new -s etf 'bash scripts/claude/autopilot.sh'

Then open your Codex session in the same folder and paste the contents of
`dev_minions/automation/qa-goal.txt`.

Detach from tmux with `Ctrl-b d` (the autopilot keeps running); come back with `tmux attach -t etf`.
First launch ever: run `claude` once interactively in this folder and accept the workspace trust prompt.

## 1. Dev loop — Claude Code autopilot

Plans, implements, gets an independent review + test run per story, details the next sprint when the
current one is done, and stops each story at `Awaiting QA`. Each cycle is a fresh Claude Code session;
`autopilot.sh` starts the next one until `HANDOVER.md` says:
- `Automation state: STOPPED-FOR-USER` — nothing left it can do without you (demo file written), or
- `Automation state: ALL-DONE` — the whole roadmap is Awaiting QA or Done.

It also stops after two cycles without progress or after `MAX_CYCLES` working cycles (default 12,
e.g. `MAX_CYCLES=20 bash scripts/claude/autopilot.sh`; one cycle only: `MAX_CYCLES=1`). Usage limits are
waited out until the exact reset time; network drops back off 5 → 30 min and retry (DEC-011). Waiting
never counts as a cycle.

Other ways to run it: interactive `claude` then `/goal ` + the text of `goal.txt`, or `/deliver-story`
for one story. Those do not go through `autopilot.sh`, so the QA loop will not run alongside them (DEC-014).

The runner writes `dev_minions/automation/dev-loop.state` (RUNNING / WAITING-LIMIT / WAITING-NETWORK /
STOPPED, with a heartbeat every 5 min). `bash scripts/claude/dev-loop-status.sh` shows it.

## 2. QA loop — Codex

Brief: `dev_minions/roles/qa.md`. In short:
- Checks `bash scripts/claude/dev-loop-status.sh` before every cycle and every story. **Dev loop not
  running (usage limit, network wait, stopped, killed, PC asleep) → it finishes the story in hand, logs
  one line and ends its session.** It never waits, so it spends nothing while Claude is paused. After a
  limit wait the autopilot resumes by itself; the QA loop does not — paste `qa-goal.txt` again.
- Takes `Awaiting QA` stories, runs the machine checks (commands, the app served locally through
  `scripts/claude/qa-serve.sh` with no or an unreachable database, live bvb.ro reads) and writes
  `verification/US-XXX-qa-run.md` with the command, exit code and output of every check.
- Never fixes anything: a `FAIL` reopens the story (`Ready — reopened by QA`) for the dev loop.
- Never runs git. When a story passes it logs one line that it is ready for you to commit and push.
- Writes only a story's `qa-run.md`, that story's board row, and its own `## QA/Deploy log (Codex)`
  section at the bottom of `HANDOVER.md`.

## When the dev loop stops — your part
Open the newest `dev_minions/verification/DEMO-*.md` (and `status.md` → "Waiting on you"):
1. **Decisions only you can make** — answer in the DEC file or the demo file.
2. **Live steps, in order** — Neon, Vercel, env vars, migrations + seed, API keys.
3. **Stories to check** — tick `- [x] US-XXX` to accept or write `- [!] US-XXX` + a note to send it back.
   `US-XXX-qa-run.md` shows what Codex already covered.
4. **Escalations** it could not solve.
5. **Decided on your behalf by tech-lead** — read if you want.
6. **Files changed since the last demo** — commit and push them. Git is entirely yours; no agent runs it.

Then start both loops again: the dev loop reads your answers first.

## Kit updates
`.claude/` and `.github/` cannot be written remotely, so the Technical Lead chat stages kit changes in
`dev_minions/automation/pending-kit/` (same paths, no leading dot). `bash scripts/claude/install-kit.sh`
copies them in, keeps the replaced files under `dev_minions/_obsolete/kit-backups/<time>/`, retires
files listed as retired, and removes working copies that already have an identical archived copy in
`dev_minions/_obsolete/`. `autopilot.sh` refuses to start until the kit is installed.

## Watch (optional)
- `dev_minions/HANDOVER.md` — `Automation state:`, active story, and at the bottom the Codex log
- `dev_minions/status.md` — Story board and what waits on you
- `dev_minions/verification/` — plan, review, tests, QA checklist, QA run per story; sprint review/audit
- `dev_minions/automation/logs/` — full stream log per dev-loop cycle (gitignored; can contain anything
  the session printed, so never share them)

## Claude budget ran out → GitHub Copilot
1. If Claude Code still responds: `/handover`. If not, the Stop hook already wrote `dev_minions/.checkpoint.md`.
2. Open the repo in VS Code, Copilot Chat in Agent mode, run `/resume-from-handover`.
3. For the independent review, open a NEW Copilot chat and run `/review-story`.
4. Copilot stops for any decision and sets `Automation state: PAUSED — Copilot`. The QA loop does not run
   during Copilot work (DEC-014); stories it delivers are QA'd once the autopilot runs again.
