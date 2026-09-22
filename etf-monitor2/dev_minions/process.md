# Working Process — ETF BVB Monitoring

*Established 2026-09-22. This is a working agreement, not a rigid contract — revise it here when we actually change how we work, and note the change in `status.md`.*

## Division of labor

- **This Claude project (chat-based planning)** — owns requirements, process, and architecture. Nothing here writes application code.
- **WSL/Ubuntu + VS Code + GitHub Copilot** — writes the actual code, one user story at a time.
- Claude, working from this project, cannot execute shell/git commands on the user's machine directly (no shell access to that environment from here). Claude prepares and organizes files in the connected folder; the user runs `git`/`gh` commands themselves in their own WSL/VS Code terminal. Claude provides the exact commands when needed.

## Roles

Kept intentionally lean: this is a solo, personal-use project, not a team, so simulating a full Scrum team (separate PO / Scrum Master / Architect / QA chats) would add coordination overhead with no one to coordinate with.

- **Product Owner + Delivery** (this thread) — owns requirements, backlog, breaking epics into sprints and stories, and tracks status. One combined role for now.
- Additional roles (e.g. a dedicated Architect role) are added only when real complexity justifies it — not preemptively. If/when the project grows (e.g. the AI news-feed roadmap item becomes active work), revisit this section.

## Coordination model

No automatic chat-to-chat messaging exists between separate claude.ai conversations — coordination happens through files in this folder, which any chat reads first, plus the user relaying context between sessions when more than one is open.

`status.md` acts as the de facto orchestrator: it always reflects current state (active epic/sprint, what's done, what's next, any open decision). Any new chat, or the user returning after a break, starts by reading it.

**Human-in-the-loop rule:** routine, mechanical steps (writing a story ticket from an already-agreed design, updating status, logging a completed step) proceed without asking. Anything that is a genuine **design or direction decision** (architecture choice, scope change, trade-off with more than one reasonable answer) stops and is validated with the user before proceeding, and gets recorded in `decisions/`.

## Workflow — Agile: Epic → Sprint → User Story

- **Epic** — a large chunk of the requirements doc (e.g. "ETF monitoring core pipeline", "Admin panel", "AI natural-language configuration").
- **Sprint** — a small, shippable batch of stories from one or more epics. Size/duration is informal (no fixed calendar cadence needed for a solo project) — a sprint ends when its stories are done and verified.
- **User Story** — the atomic unit of work, and the actual instruction handed to GitHub Copilot. One story = one focused, independently testable piece of functionality.

### User story format (Copilot-ready ticket)

Every story file under `backlog/stories/` is written **in English** (to keep Copilot token cost down) and follows:

```
## US-XXX — <short title>

**Context:** <1-2 sentences, only what Copilot needs to know>
**Task:** <precise, actionable instruction>
**Acceptance criteria:**
- <testable condition>
- <testable condition>
**Out of scope:** <explicitly excluded, to prevent scope creep in the generated code>
```

## The delivery loop

Each story goes through the same cycle. Role briefs live in `roles/`.

```
Coordinator picks story  →  user pastes ticket into Copilot  →  Copilot writes code
        ↓
Coordinator spawns, independently and in parallel:
   • Code Reviewer  — reads the changed files against the acceptance criteria
   • Test Runner    — runs the unit suite in Claude's cloud sandbox
        ↓
   both PASS ──→ Coordinator issues the manual QA checklist  →  user confirms  →  DONE
   either FAIL ─→ Coordinator writes a fix ticket (US-XXX-fixN)  →  back to Copilot
        ↓
   design/direction question at any point  →  stop, ask the user, log in decisions/
```

Copilot works independently from the story ticket; the reviewing coworkers work independently from Copilot's output. Neither reviewer talks to the user — everything reaches the user through the Coordinator, which is also the only role that updates `status.md`.

### Two hard constraints on the verification side

1. **The reviewing coworkers are session-scoped.** They exist while a working session is open and keep no memory between sessions. Everything durable — verdicts, decisions, status — must be written into this folder, or it is lost.
2. **The sandbox cannot reach bvb.ro.** Claude's cloud sandbox has no network access to the data source, and no shell access to the user's machine. Therefore: all extraction tests run against fixture PDFs committed to `test/fixtures/`, and anything requiring live BVB access, a real Neon database, or the deployed Vercel environment is the user's manual step, not an automated one.

## Definition of Ready (before a story starts)

- Acceptance criteria are concrete and testable.
- Any design/direction ambiguity has already been resolved and validated with the user (see Coordination model above) — a story should not require Copilot (or the user) to make an unreviewed design call.

## Definition of Done (before a story is marked complete)

- Code implements the acceptance criteria.
- **Automated unit tests** exist for the new logic and pass.
- **Code Reviewer verdict: PASS** — every acceptance criterion individually met.
- **Test Runner verdict: PASS** — suite green *and* the story's acceptance criteria actually covered by tests.
- **Manual verification by the user** — the user runs/checks the result and confirms it behaves as expected. This is a required step, not optional, even when everything above is green.
- `status.md` updated.

## Model & cost strategy (VS Code / Copilot side)

- Instructions to Copilot are written in English (see story format above) — reduces token cost vs. Romanian.
- Model + thinking-level choice is made **per story**, not fixed project-wide, based on the story's actual complexity:
  - Low/mechanical (boilerplate, simple CRUD, formatting, config) → cheaper/faster model, low thinking effort.
  - Higher complexity (parsing logic, architecture-adjacent code, ambiguous edge cases) → stronger model, higher thinking effort.
- Several of the models currently available in the user's Copilot model picker are recent enough that Claude doesn't have reliable first-hand knowledge of their cost/quality trade-offs. Rather than guess, this is decided per story when it's written, checked against current info if needed.

## Testing policy

- Automated unit tests are written alongside the code they cover (not deferred to "later").
- In addition, functionality that affects user-visible behavior gets a manual check by the user before a story is marked done.
