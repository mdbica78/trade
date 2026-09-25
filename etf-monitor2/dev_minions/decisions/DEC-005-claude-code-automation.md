# DEC-005 — Claude Code as implementer and orchestrator; Copilot as fallback

- Status: **Decided** — requested by the user, validated by the Technical Lead, 23.09.2026
- Amends: DEC-004 (the per-story relay between chats)
- Amended by: DEC-009 (continuous loop; sprint audits by the in-loop `tech-lead`, not the chat — point 3),
  DEC-013/DEC-014 (QA runs in a separate Codex loop), DEC-015 (secrets beyond `.env*`, verifier evidence rules — points 2 and 7)
- Related: ADR-001 (stack, accepted)

## Context
DEC-004 kept Copilot as the implementer and made the user relay every story between Copilot, the Technical Lead chat and the Troubleshoot chat. The user now has Claude Code and wants delivery as automated as possible, at low cost, with a safe fallback to VS Code + GitHub Copilot when the Claude Code usage budget runs out (budget size unknown).

## Decision
1. **Claude Code** (local, on the user's machine) implements stories and orchestrates the delivery loop from AGENTS.md via the `deliver-story` skill. It can run unattended with `/goal`.
2. **Independent verification** for routine stories is done by Claude Code subagents with fresh context: `story-reviewer` (replaces the per-story Technical Lead review) and `story-tester` (replaces the per-story Troubleshoot test run). Verdicts still go to `verification/`, round by round.
3. The **Technical Lead and Troubleshoot chats** leave the per-story loop. They handle: escalations (`escalations/`), decisions marked PROPOSED, and one audit per sprint (Technical Lead samples the verdict files and diffs).
4. **Story states**: automation ends at `Awaiting QA`. Only the user moves a story to `Done`, after the manual QA checklist.
5. **status.md**: agents may update only the status of the story they deliver. Planning sections stay with the PO.
6. **Model policy** (cost first): main session sonnet at medium effort; opus only through `story-planner` for complex stories or a failing fix loop; reviewer sonnet at high effort; tester and code search on haiku. Subagents cannot spawn further subagents.
7. **Safety and version control**: the user does all git operations. Agents never run git, deploy, migrate Neon, touch Vercel settings, or read `.env*`. Each story's QA checklist ends with its list of changed files so the user can commit them.
8. **Fallback**: `AGENTS.md` holds the rules for all agents; `CLAUDE.md` imports it. `HANDOVER.md` (including the files changed) + the automatic `.checkpoint.md` (recently modified files) let GitHub Copilot continue the exact story and phase (prompt `/resume-from-handover`). Claude Code resumes from the same file when budget returns.

## Consequences
- The user no longer relays per story; the user does QA, decisions, escalations and all git.
- Reviewer and implementer are the same model family; independence comes from fresh context and written criteria. Mitigation: sprint audit by the Technical Lead chat.
- Stories detailed just-in-time: agents may draft acceptance criteria only from the requirements, flagged for PO confirmation in the QA checklist.
