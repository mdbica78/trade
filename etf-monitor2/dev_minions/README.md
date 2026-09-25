# dev_minions — project control folder

Everything about *how* the ETF BVB Monitoring project is planned, delivered and tracked.
Application code lives next to this folder; nothing in here is code.

## Start here

| You are | Read, in order |
|---|---|
| The user, checking in | `status.md` |
| A planning chat (PO, Technical Lead, Troubleshoot) | `status.md` → `process.md` → your brief in `roles/` |
| A coding agent (Claude Code, Copilot) | repo-root `AGENTS.md` / `CLAUDE.md` → `HANDOVER.md` → `status.md` |
| The Codex QA loop | `roles/qa.md` (started with `automation/qa-goal.txt`) |

## What each file is for (one purpose each)

```
dev_minions/
├── status.md          where we are, what waits on the user, story board        (PO)
├── process.md         how we work: roles, story life cycle, rules, DoD, environment   (PO)
├── HANDOVER.md        live state of the dev loop + Codex QA/deploy log          (the two loops)
├── .checkpoint.md     auto-written recovery snapshot — do not edit
├── .files-touched.log auto-written log of every file agents wrote — do not edit
├── requirements/      functional requirements — the scope source of truth
├── architecture/      ADR-001 (tech stack), data-model.md
├── decisions/         DEC-001… one file per decision; README.md is the index
├── backlog/           epics.md, roadmap.md, sprints/sprint-0N.md, stories/US-XXX.md
├── roles/             po.md, technical-lead.md, troubleshoot.md, qa.md
├── verification/      evidence: per story (plan, review, tests, qa, qa-run), per sprint (review, audit), DEMO files
├── escalations/       ESC-XXX files when a story fails its gates 3 times (template in README.md)
├── automation/        AUTOMATION.md (how to run the loops), goal.txt, qa-goal.txt, logs/, pending-kit/
└── _obsolete/         old versions and retired files, kept for history only — never read them for current state
```

## Rules for keeping this folder simple

- One fact lives in one place. Link to it instead of copying it.
- `status.md` holds the current state only. History goes to `HANDOVER.md`'s log (one line per event)
  and to `verification/`.
- When a document is replaced, move the old version into `_obsolete/` instead of keeping both side by side.
