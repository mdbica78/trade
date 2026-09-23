# dev_minions

This folder is the **process control center** for the ETF BVB Monitoring project. It holds everything about *how* we work — requirements, architecture decisions, the backlog, and status — separate from the application code that lives alongside it in this same repo.

**If you are a new chat/session picking this project up, start here, in this order:**

1. Read [`process.md`](./process.md) — the working agreement: roles, workflow, testing policy, cost rules.
2. Read [`status.md`](./status.md) — what's currently in progress, what's next, and any decision still waiting on the user's (or Technical Lead's) validation.
3. Read [`requirements/etf-monitoring-requirements.md`](./requirements/etf-monitoring-requirements.md) — the full functional requirements (source of truth for scope).
4. Check `backlog/` for the current epic/sprint/story breakdown (created once the backlog step starts — see status.md).
5. If you are the Technical Lead or Troubleshoot chat, also read your role brief in `roles/` and check `verification/` for any story awaiting your verdict.

`status.md` is the single source of truth for "where are we right now." Update it whenever something meaningful changes, so any chat opened later — or the user checking in — can reconstruct context without re-reading the whole history.

## Folder layout

```
dev_minions/
├── README.md              — this file
├── process.md             — working agreement (roles, delivery loop, DoR/DoD, cost rules)
├── status.md               — current state, next step, open decisions, story board
├── requirements/           — functional requirements (source of truth for scope)
├── roles/
│   ├── coordinator.md       — PO chat: picks work, hands off verification, escalates
│   ├── technical-lead.md    — standing chat: code review + technical/architecture sign-off
│   ├── troubleshoot.md      — standing chat: test execution + environment/bug diagnosis
│   ├── code-reviewer.md     — superseded by technical-lead.md; kept for history
│   └── test-runner.md       — superseded by troubleshoot.md; kept for history
├── architecture/
│   ├── ADR-001-tech-stack.md
│   └── data-model.md
├── backlog/
│   ├── README.md            — conventions, story states, detailing policy
│   ├── epics.md             — all epics
│   ├── roadmap.md           — all sprints, with story lists
│   ├── sprints/             — one file per sprint
│   └── stories/             — one file per story (Copilot-ready ticket, English)
├── verification/            — per-story verdicts from Technical Lead and Troubleshoot
└── decisions/                — log of validated design/direction decisions
```
