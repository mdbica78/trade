# Backlog

## Files

- `epics.md` — all seven epics, the top-level breakdown of the requirements.
- `roadmap.md` — every sprint with its goal and story list.
- `sprints/sprint-NN.md` — one file per sprint: goal, story table with dependencies and suggested model, sprint Definition of Done, and the manual QA the user must perform.
- `stories/US-XXX.md` — one file per story. **This is the unit handed to Copilot** — a story file is written to be pasted whole, with no additional context needed.

## Conventions

- Story IDs are sequential and never reused, across all sprints.
- A fix ticket keeps the original ID with a suffix: `US-007-fix1`. It never becomes a new story number, so the history of what went wrong stays attached to the story.
- New scope discovered mid-story becomes a **new** story, appended to `roadmap.md`. Stories do not grow.
- Stories are written in English. Everything else in `dev_minions/` may be in either language.

## Story states

Tracked in `status.md`, not in the story files themselves:

`Ready` → `In progress (Copilot)` → `In verification` → `Awaiting manual QA` → `Done`
(or → `Blocked`, with the reason and what would unblock it)

## Detailing policy

Only the sprint about to start has fully detailed stories. Later sprints list story titles in `roadmap.md` and are detailed just in time — writing them earlier would bake in assumptions that earlier sprints are likely to invalidate.
