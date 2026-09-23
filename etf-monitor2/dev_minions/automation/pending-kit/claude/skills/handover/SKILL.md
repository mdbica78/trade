---
name: handover
description: Bring dev_minions/HANDOVER.md fully up to date so another agent (Claude Code or GitHub Copilot) can continue. Use before stopping for any reason, when the user mentions budget/limits/switching to Copilot, or after every delivery phase.
---

# Handover

Never run git. The user handles version control.

1. Read `dev_minions/HANDOVER.md` and `dev_minions/.checkpoint.md`.
2. Set the `Automation state:` line (right under "Last updated"):
   `RUNNING` (mid-run, more to do) · `PAUSED` (stopping for the cycle limit, budget or any interruption: safe to resume) · `STOPPED-FOR-USER` (nothing eligible, demo file written) · `ALL-DONE` (every roadmap story is Awaiting QA or Done). Add ` — <reason>` and, when stopped, the demo file path.
3. Rewrite the "Active story" section: story, phase, round, criteria done/remaining, currently failing tests (names), and the **exact next step** a different agent should take first (a concrete command, or file + change).
4. Make "Files changed" complete for the active story: this story's lines in `dev_minions/.files-touched.log` (automatic, DEC-011) plus files changed by commands (package.json/pnpm-lock.yaml after `pnpm add`, generated migrations, deletions). If something is half-done or broken, say which file and what is broken.
5. Update "Waiting on the user" (QA, decisions marked NEEDS USER, live steps, escalations, denied permissions).
6. Add one line to the Log (newest first). Update the "Last updated" line with the time and "Claude Code".
7. Reply with the `Automation state:` line and the "Exact next step" line only.
