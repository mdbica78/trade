# Working Process — ETF BVB Monitoring

*Established 2026-09-22. Revised 2026-09-23 (see `decisions/DEC-004-three-chat-structure.md`) — moved from one Coordinator chat + ephemeral spawned coworkers to three standing chats (PO, Technical Lead, Troubleshoot). This is a working agreement, not a rigid contract — revise it here when we actually change how we work, and note the change in `status.md`.*

## Division of labor

- **This Claude project (chat-based planning)** — owns requirements, process, and architecture. Nothing here writes application code.
- **WSL/Ubuntu + VS Code + GitHub Copilot** — writes the actual code, one user story at a time.
- Claude, working from this project, cannot execute shell/git commands on the user's machine directly (no shell access to that environment from here). Claude prepares and organizes files in the connected folder; the user runs `git`/`gh` commands themselves in their own WSL/VS Code terminal. Claude provides the exact commands when needed.

## Repository structure — important

The git repository is **`trade`** (`github.com/mdbica78/trade.git`), at `C:\_mystaff\myG\trade` (`/mnt/c/_mystaff/myG/trade` in WSL) — **not** a dedicated `etf_monitor2` repo. It contains several unrelated subprojects as sibling folders.

- This project's root is the **`etf-monitor2/`** subfolder (`C:\_mystaff\myG\trade\etf-monitor2`). Everything for this project — code, `dev_minions/`, config, `.env.example`, etc. — lives inside `etf-monitor2/`, never at the `trade/` repo root.
- The sibling folder **`etf-monitor/`** (no "2") is an earlier, unrelated, abandoned attempt. It is **not part of this project** — never read from it, reference it, or modify it. Any story or instruction to Copilot must stay scoped to `etf-monitor2/`.
- When opening the project in VS Code for Copilot work, open `etf-monitor2/` directly (not the `trade/` repo root), so Copilot's context doesn't include unrelated sibling projects.
- Every story ticket that says "repository root" or "project root" means `etf-monitor2/`, not the top of the `trade` git repo.

## Roles

Three standing Claude chats, each a separate conversation with no automatic messaging between them (see Coordination model below):

- **PO (Product Owner + Delivery)** — this chat. Owns requirements, backlog, breaking epics into sprints and stories, hands tickets to the user for Copilot, judges verification results, and is the only role that talks to the user about planning/sequencing and the only one that updates `status.md`. Role brief: `roles/coordinator.md` (filename kept for continuity; the role is the PO).
- **Technical Lead** — standing chat. Independent code review of Copilot's output against each story's acceptance criteria, plus technical/architecture authority: reviews and signs off on direction decisions (ADRs, stack choices, anything logged in `decisions/`) before the PO treats them as Decided. Role brief: `roles/technical-lead.md`.
- **Troubleshoot** — standing chat. Independent test execution (unit suite, coverage of acceptance criteria) and general environment/bug diagnosis — the kind of investigation `decisions/DEC-001`, `DEC-002`, `DEC-003` record. Role brief: `roles/troubleshoot.md`.

These replace the earlier model of ephemeral coworkers (`roles/code-reviewer.md`, `roles/test-runner.md`, kept in place with a superseded notice) spawned per story inside a single Coordinator session. The responsibilities are the same in substance — independent review, independent testing — the difference is these are now long-lived chats the user opens directly, rather than subagents spawned and discarded within one session.

## Coordination model

No automatic chat-to-chat messaging exists between the three chats — coordination happens through files in this folder, which any chat reads first, plus the user relaying context between chats (pasting a ticket, a verdict, a question) when more than one needs to be involved.

`status.md` acts as the de facto orchestrator: it always reflects current state (active epic/sprint, what's done, what's next, any open decision). Any chat — new or returning — starts by reading it. Verdicts from Technical Lead and Troubleshoot are written to `verification/US-XXX-review.md` and `verification/US-XXX-tests.md` respectively (see `verification/README.md`) so they survive independently of any one chat's own conversation history.

**Human-in-the-loop rule:** routine, mechanical steps (writing a story ticket from an already-agreed design, updating status, logging a completed step) proceed without asking. Anything that is a genuine **design or direction decision** (architecture choice, scope change, trade-off with more than one reasonable answer, or a change to this process itself) stops and is validated with the user before proceeding, and gets recorded in `decisions/`. Technical decisions specifically (ADRs, stack/library choices, anything with lasting architectural consequence) are drafted by the PO but need the **Technical Lead's sign-off**, via the user relaying between chats, before they move from `PROPOSED` to `Decided`.

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
PO picks story  →  user pastes ticket into Copilot  →  Copilot writes code
        ↓
user reports Copilot done  →  PO hands off (via the user) to, independently and in parallel:
   • Technical Lead  — reviews the changed files against the acceptance criteria
   • Troubleshoot    — runs the unit suite in its own sandbox
   each writes its verdict to verification/US-XXX-review.md / US-XXX-tests.md
        ↓
   both PASS ──→ PO issues the manual QA checklist  →  user confirms  →  DONE
   either FAIL ─→ PO writes a fix ticket (US-XXX-fixN)  →  back to Copilot
        ↓
   design/direction question at any point  →  stop, ask the user, log in decisions/
   (technical direction questions route to Technical Lead for sign-off before Decided)
```

Technical Lead and Troubleshoot work independently from Copilot's output and from each other. Neither declares a story Done or edits `status.md` — that stays the PO's job; they report a verdict, the PO judges and acts on it.

### Two hard constraints on the verification side

1. **The three chats are separate, memory-isolated conversations.** There is no automatic way for the PO to see what happened inside the Technical Lead or Troubleshoot chats, or vice versa. Everything durable — verdicts, decisions, status — must be written into this folder (`verification/`, `decisions/`, `status.md`), or it is lost to the other chats even if the originating chat still remembers it.
2. **The sandbox cannot reach bvb.ro.** Whichever chat runs the tests has no network access to the data source, and no shell access to the user's machine. Therefore: all extraction tests run against fixture PDFs committed to `test/fixtures/`, and anything requiring live BVB access, a real Neon database, or the deployed Vercel environment is the user's manual step, not an automated one.

## Definition of Ready (before a story starts)

- Acceptance criteria are concrete and testable.
- Any design/direction ambiguity has already been resolved and validated with the user (see Coordination model above) — a story should not require Copilot (or the user) to make an unreviewed design call.

## Definition of Done (before a story is marked complete)

- Code implements the acceptance criteria.
- **Automated unit tests** exist for the new logic and pass.
- **Technical Lead verdict: PASS** — every acceptance criterion individually met.
- **Troubleshoot verdict: PASS** — suite green *and* the story's acceptance criteria actually covered by tests.
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
