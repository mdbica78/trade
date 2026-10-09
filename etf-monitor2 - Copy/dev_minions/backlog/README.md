# Backlog

- `epics.md` — the seven epics (top-level breakdown of the requirements).
- `roadmap.md` — every sprint with its goal and story titles, plus carry-forward notes for the sprints not yet detailed.
- `sprints/sprint-0N.md` — one per detailed sprint: goal, order, story table, decisions needed, sprint DoD, manual QA.
- `stories/US-XXX.md` — one per story: context, task, acceptance criteria (each citing its FR), out of scope, notes.
  Written in English, complete enough to hand to any coding agent on its own.

## Conventions
- Story ids are sequential across sprints and never reused. New scope found mid-story becomes a new story in `roadmap.md`.
- Only the next sprint is detailed, just in time (`process.md` §3). Agent-detailed stories carry
  "Detailed by agent … PO to confirm at demo".
- Story state lives only on the `status.md` Story board, never in the story file (states: `process.md` §3).
