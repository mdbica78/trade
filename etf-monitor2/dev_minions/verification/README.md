# Verification — the evidence

Written by the loops; nothing here is edited afterwards (new rounds are appended). This is evidence, not
current state — current state is `status.md`.

Per story:
- `US-XXX-plan.md` — criteria → tests, files, risks, decisions needed (`story-planner` or the dev loop).
- `US-XXX-review.md` — independent review verdict, one section per round (`story-reviewer`; format in `roles/technical-lead.md`).
- `US-XXX-tests.md` — independent test verdict, one section per round (`story-tester`).
- `US-XXX-qa.md` — checklist of manual and live checks, ending with the files changed (dev loop).
- `US-XXX-qa-run.md` — automated QA run by the Codex loop (DEC-013): verdict, evidence per check, "For the user" items.

Per sprint (`tech-lead`):
- `SPRINT-0N-review.md` — review of an agent-detailed sprint before it starts.
- `SPRINT-0N-audit.md` — audit of the sprint's verdicts against the code when it closes.

Per stop of the dev loop:
- `DEMO-YYYYMMDD-HHMM.md` — decisions for the user, live steps, stories to accept `[x]` or send back `[!]`, escalations, files changed.
