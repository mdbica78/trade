# Verification files

Everything a verdict or a user answer depends on is written here, so it survives independently of any chat's or agent's context.

Per story:
- `US-XXX-plan.md` — plan: criteria → tests, files, decisions needed (`story-planner` or the main session).
- `US-XXX-review.md` — independent review verdict, one section per round (`story-reviewer`; format in `roles/technical-lead.md`).
- `US-XXX-tests.md` — independent test verdict, one section per round (`story-tester`).
- `US-XXX-qa.md` — the user's manual checks and live steps, ending with the files changed.

Per sprint (DEC-009, `tech-lead` subagent):
- `SPRINT-0N-review.md` — fidelity review of an agent-detailed sprint, before it starts.
- `SPRINT-0N-audit.md` — audit of the sprint's verdicts against the code, when it closes.

Per stop (DEC-009):
- `DEMO-YYYYMMDD-HHMM.md` — written when the autopilot stops for the user: decisions only the user can make, live steps in order, stories to accept (`[x]`) or send back (`[!]` + note), escalations, decisions the tech-lead made on the user's behalf, and the files changed since the last demo.

Earlier rounds and files are never deleted — they are the history.
