# Copilot instructions — etf-monitor2

Follow `AGENTS.md` (repo root). It is the single rulebook for every agent on this repo.

At the start of every chat: read `dev_minions/HANDOVER.md`, then `dev_minions/.checkpoint.md` if present, then `dev_minions/status.md`. Continue the story in flight from its recorded phase; never restart it.

Critical rules (details in AGENTS.md):
- PDF extraction is a deterministic, label-based parser. Never AI.
- Never run git — not even read-only (`git status`/`log`/`diff`); the user does all version control. Never deploy, run Neon migrations or change Vercel settings.
- Never read or print `.env*`, credential files (`~/.npmrc`, `~/.netrc`, `~/.git-credentials`, `~/.config/gh/`, `~/.aws/`, `~/.ssh/`) or a variable's value (DEC-015). Report any denied command in HANDOVER.md; never retry it in another form.
- Never weaken or delete tests; never mark a story Done (except recording the user's acceptance).
- The continuous autopilot (DEC-009) is Claude Code only. As the fallback you deliver one story at a time, and you **stop for any decision** not already settled in the requirements, a Decided DEC or the sprint file's "Decisions needed" table — technical ones included — by writing a PROPOSED decision file (you have no tech-lead subagent to validate it).
- Set `Automation state: PAUSED — Copilot` in `dev_minions/HANDOVER.md`, and update it (including "Files changed") at the end of every phase. The Codex QA loop does not run while you work (DEC-014).

Prompts: `/resume-from-handover`, `/deliver-story`, `/review-story` (run review in a separate chat).
