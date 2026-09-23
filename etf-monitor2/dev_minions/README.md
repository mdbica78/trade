# dev_minions

This folder is the **process control center** for the ETF BVB Monitoring project. It holds everything about *how* we work — requirements, architecture decisions, the backlog, and status — separate from the application code that lives alongside it in this same repo.

**If you are a coding agent (Claude Code, GitHub Copilot) picking up delivery work:** start with `AGENTS.md` / `CLAUDE.md` at the repo root, then `HANDOVER.md` in this folder — those, not the list below, are the live operating instructions for the automated delivery loop (see `decisions/DEC-005-claude-code-automation.md`, `automation/AUTOMATION.md`).

**If you are a new chat/session picking this project up for planning, review, or a decision, start here, in this order:**

1. Read [`process.md`](./process.md) — the working agreement: roles, workflow, testing policy, cost rules.
2. Read [`status.md`](./status.md) — what's currently in progress, what's next, and any decision still waiting on the user's (or Technical Lead's) validation.
3. Read [`requirements/etf-monitoring-requirements.md`](./requirements/etf-monitoring-requirements.md) — the full functional requirements (source of truth for scope).
4. Check `backlog/` for the current epic/sprint/story breakdown (created once the backlog step starts — see status.md).
5. If you are the Technical Lead or Troubleshoot chat, also read your role brief in `roles/`, check `escalations/` for anything routed to you, and `verification/` if running a sprint audit.

`status.md` is the single source of truth for "where are we right now." Update it whenever something meaningful changes, so any chat opened later — or the user checking in — can reconstruct context without re-reading the whole history.

## Folder layout

```
dev_minions/
├── README.md              — this file
├── process.md             — working agreement (roles, delivery loop, DoR/DoD, cost rules)
├── status.md               — current state, next step, open decisions, story board (PO-owned)
├── HANDOVER.md             — live per-story state for coding agents (Claude Code / Copilot handoff)
├── .checkpoint.md          — auto-written by a Stop hook: recently modified files, for recovery
├── requirements/           — functional requirements (source of truth for scope)
├── roles/
│   ├── coordinator.md       — PO chat: backlog, status accuracy, closes stories, escalates
│   ├── technical-lead.md    — standing chat: technical/architecture sign-off, sprint audit, escalations
│   ├── troubleshoot.md      — standing chat: environment/bug diagnosis, escalations
│   ├── code-reviewer.md     — superseded by technical-lead.md (then story-reviewer); kept for history
│   └── test-runner.md       — superseded by troubleshoot.md (then story-tester); kept for history
├── architecture/
│   ├── ADR-001-tech-stack.md
│   └── data-model.md
├── automation/
│   ├── AUTOMATION.md        — how to run/watch the Claude Code delivery loop, and the Copilot fallback
│   └── goal.txt             — the standing prompt for unattended `/goal` sprint runs
├── escalations/             — ESC-XXX-US-XXX.md: a story that failed its gates repeatedly, or an environment problem an agent couldn't solve
├── backlog/
│   ├── README.md            — conventions, story states, detailing policy
│   ├── epics.md             — all epics
│   ├── roadmap.md           — all sprints, with story lists
│   ├── sprints/             — one file per sprint
│   └── stories/             — one file per story (Copilot-ready ticket, English)
├── verification/            — per-story: plan, review, tests, QA checklist (from story-reviewer/story-tester, or Technical Lead/Troubleshoot under the fallback)
└── decisions/                — log of validated design/direction decisions
```

Repo root also has `AGENTS.md` (shared agent rules) and `CLAUDE.md` (imports it) for Claude Code, `.claude/` (subagents, skills, settings) and `.github/prompts/` for the Copilot fallback, and `scripts/claude/` (checkpoint + unattended sprint runner) — see `automation/AUTOMATION.md`.
