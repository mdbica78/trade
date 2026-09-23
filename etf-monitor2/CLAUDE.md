@AGENTS.md
@dev_minions/HANDOVER.md

# Claude Code specifics

## Model and effort policy (DEC-005, DEC-009) — lowest cost that keeps quality
| Work | Who | Model | Effort |
|---|---|---|---|
| Orchestration + implementation | main session | sonnet | medium (settings.json) |
| Plan a complex story; fix strategy before round 3; detail a title-only sprint | `story-planner` subagent | opus | high |
| Independent review | `story-reviewer` subagent | sonnet | high |
| Test run + acceptance-criteria-to-test mapping | `story-tester` subagent | haiku | — |
| Technical decisions, escalation triage, sprint review, sprint audit | `tech-lead` subagent | opus | high |
| Codebase search | `Explore` (project override) | haiku | — |

- Complex story = touches DB schema, the adapter framework, the AI provider/capability system, cron/infra, auth, or has more than ~6 acceptance criteria. Otherwise plan it yourself in 15 lines or fewer.
- Never ask the user to switch /model or /effort. Route the work to the right subagent instead. Put `ultrathink` in a single prompt only for a genuinely hard bug.
- Launch `story-reviewer` and `story-tester` in parallel, each with a short self-contained delegation prompt: story id, round number. They start from a fresh context; that is what makes them independent. They read files themselves (story, plan, HANDOVER.md "Files changed").
- `tech-lead` delegation prompts are one line with its mode: `decision DEC-XXX`, `escalation ESC-XXX`, `sprint-review N`, `sprint-audit N`. Its brief is `dev_minions/roles/technical-lead.md`.

## Workflow (autopilot, DEC-009)
- Use the `deliver-story` skill. Under `/goal` it runs continuously across sprints and stops only when nothing is eligible without the user. Use the `handover` skill whenever you stop, for any reason, and keep the `Automation state:` line in HANDOVER.md accurate.
- Unattended: `tmux new -s etf 'bash scripts/claude/autopilot.sh'` (see `dev_minions/automation/AUTOMATION.md`).
- One blocked story never stops the run: block it, record why, pick the next eligible story.
- Never run git commands, not even read-only; the user handles git. Update HANDOVER.md often: a usage limit can end the session between two tool calls. The Stop hook refreshes `dev_minions/.checkpoint.md` automatically; HANDOVER.md is your responsibility.
- A permission request that is denied or cannot be answered (unattended run): do not retry. Record it under "Waiting on the user" in HANDOVER.md and continue with work that does not need it.
