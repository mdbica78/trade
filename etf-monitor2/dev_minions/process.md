# Working Process — ETF BVB Monitoring

*Established 2026-09-22. Revised 2026-09-23 (see `decisions/DEC-004-three-chat-structure.md`) — moved from one Coordinator chat + ephemeral spawned coworkers to three standing chats (PO, Technical Lead, Troubleshoot). Revised again the same day (see `decisions/DEC-005-claude-code-automation.md`) — for routine stories, Claude Code (local) now implements and independently verifies via fresh-context subagents, and the Technical Lead/Troubleshoot chats leave the per-story loop (see "The delivery loop" below). This is a working agreement, not a rigid contract — revise it here when we actually change how we work, and note the change in `status.md`.*

## Division of labor

- **This Claude project (chat-based planning: PO, Technical Lead, Troubleshoot)** — owns requirements, process, and architecture. Nothing here writes application code.
- **Claude Code, running locally in WSL/Ubuntu (DEC-005)** — writes the actual code, one user story at a time, orchestrating itself from `AGENTS.md`. **GitHub Copilot in VS Code** is the fallback implementer when the Claude Code usage budget runs out.
- None of the three chats can execute shell/git commands on the user's machine (no shell access to that environment from here). They prepare and organize files in the connected folder; the user runs `git`/`gh` commands themselves, and no coding agent (Claude Code or Copilot) runs git either (DEC-005) — that stays the user's, always.

## Repository structure — important

The git repository is **`trade`** (`github.com/mdbica78/trade.git`), at `C:\_mystaff\myG\trade` (`/mnt/c/_mystaff/myG/trade` in WSL) — **not** a dedicated `etf_monitor2` repo. It contains several unrelated subprojects as sibling folders.

- This project's root is the **`etf-monitor2/`** subfolder (`C:\_mystaff\myG\trade\etf-monitor2`). Everything for this project — code, `dev_minions/`, config, `.env.example`, etc. — lives inside `etf-monitor2/`, never at the `trade/` repo root.
- The sibling folder **`etf-monitor/`** (no "2") is an earlier, unrelated, abandoned attempt. It is **not part of this project** — never read from it, reference it, or modify it. Any story or instruction to Copilot must stay scoped to `etf-monitor2/`.
- When opening the project in VS Code for Copilot work, open `etf-monitor2/` directly (not the `trade/` repo root), so Copilot's context doesn't include unrelated sibling projects.
- Every story ticket that says "repository root" or "project root" means `etf-monitor2/`, not the top of the `trade` git repo.

## Roles

Three standing Claude chats, each a separate conversation with no automatic messaging between them (see Coordination model below), **plus Claude Code running locally** as the actual implementer for routine stories (DEC-005):

- **PO (Product Owner + Delivery)** — this chat. Owns requirements, backlog, breaking epics into sprints and stories, picks/confirms sprint scope, judges when a story is ready to close, and is the only role that talks to the user about planning/sequencing and the only one that updates `status.md`'s planning sections. Role brief: `roles/coordinator.md` (filename kept for continuity; the role is the PO).
- **Technical Lead** — standing chat. Technical/architecture authority: signs off on direction decisions (ADRs, stack choices, anything logged in `decisions/`) before the PO treats them as Decided; handles escalations routed to it (`escalations/`); runs one verification audit per sprint (samples `verification/` files, diffs against acceptance criteria). No longer does the per-story code review directly — that's `story-reviewer` now (see below). Role brief: `roles/technical-lead.md`.
- **Troubleshoot** — standing chat. General environment/bug diagnosis — the kind of investigation `decisions/DEC-001`, `DEC-002`, `DEC-003` record — plus escalations routed to it. No longer runs the per-story test suite directly — that's `story-tester` now (see below). Role brief: `roles/troubleshoot.md`.
- **Claude Code (local, on the user's machine)** — implements stories and orchestrates the delivery loop from `AGENTS.md` via the `deliver-story` skill; can run a whole sprint unattended (`/goal`). For each story it spawns fresh-context subagents `story-reviewer` and `story-tester` — these are the ones actually doing the independent code review and test run for routine stories, replacing the Technical Lead/Troubleshoot chats in that specific job. GitHub Copilot is the documented fallback when the Claude Code usage budget runs out (`AGENTS.md`/`CLAUDE.md` hold the shared rules; `HANDOVER.md` + `.checkpoint.md` let Copilot resume mid-story). See `automation/AUTOMATION.md`, `decisions/DEC-005-claude-code-automation.md`.

The three chats replace the earlier model of ephemeral coworkers (`roles/code-reviewer.md`, `roles/test-runner.md`, kept in place with a superseded notice) spawned per story inside a single Coordinator session (DEC-004). DEC-005 then moved the actual per-story verification work again, from the Technical Lead/Troubleshoot chats onto Claude Code's own subagents — the three chats stay standing for everything above the level of an individual story.

## Coordination model

No automatic chat-to-chat messaging exists between the three chats, and no messaging at all between them and Claude Code running locally — coordination happens through files in this folder, which any chat or agent reads first, plus the user relaying context (pasting a ticket, a verdict, a question, or just saying "US-001 is Done") when more than one needs to be involved.

`status.md`'s planning sections (Current phase, Done, Open decisions, Next step) act as the de facto orchestrator for anything above story level — the PO keeps these accurate; other roles/agents may only touch the Story board row for whatever they delivered (DEC-005 rule 5). `HANDOVER.md` and `.checkpoint.md` are the live, story-level equivalent for whichever agent (Claude Code or Copilot) is mid-delivery. Any chat or agent — new or returning — starts by reading `status.md`, and a coding agent also reads `HANDOVER.md`. Verdicts are written to `verification/US-XXX-review.md` and `verification/US-XXX-tests.md` (see `verification/README.md`) so they survive independently of any one chat's or agent's own context.

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

**Current mechanism (DEC-005), for routine stories:**

```
PO/user picks the sprint scope in backlog/  →  Claude Code, via /deliver-story or /goal, implements a story
        ↓
Claude Code spawns, independently and in parallel, fresh-context subagents:
   • story-reviewer  — reviews the changed files against the acceptance criteria
   • story-tester    — runs the unit suite
   each writes its verdict to verification/US-XXX-review.md / US-XXX-tests.md
        ↓
   both PASS ──→ automation writes verification/US-XXX-qa.md, story state → Awaiting QA
   either FAIL (round < limit) ─→ fix loop, same story, next round
   fails repeatedly, or an environment problem with no clear fix ─→ escalations/ESC-XXX-US-XXX.md
        ↓
user runs the QA checklist, commits the files (git is always the user's), tells the PO chat  →  PO marks the story Done, updates status.md
        ↓
design/direction question at any point (drafted by the PO, or surfaced in a QA checklist / escalation)  →  stop, log in decisions/ as PROPOSED, route technical ones to the Technical Lead chat for sign-off before Decided
```

**Fallback (Copilot), when the Claude Code usage budget runs out:** `AGENTS.md` holds the shared rules Copilot follows too; `HANDOVER.md` + the automatic `.checkpoint.md` let it resume the exact story and phase (`/resume-from-handover`), and a fresh Copilot chat runs `/review-story` for the independent review. See `automation/AUTOMATION.md` for the exact commands.

**Escalations:** the Technical Lead and Troubleshoot chats no longer sit in the per-story loop, but they are exactly where an `escalations/ESC-XXX` goes — architecture/design ones to Technical Lead, environment/bug ones to Troubleshoot — and the Technical Lead runs one verification audit per sprint (sampling `verification/` files against acceptance criteria) as the independence check on Claude Code reviewing its own implementation with a fresh context.

No coding agent declares a story Done or edits `status.md`'s planning sections — that stays the PO's job (agents may only update the Story board row for the story they deliver, DEC-005 rule 5); agents report a verdict/state, the PO (with the user) judges and acts on it.

### Two hard constraints on the verification side

1. **None of these — three chats, Claude Code, Copilot — automatically see each other's context.** Everything durable — verdicts, decisions, status, handover state — must be written into this folder (`verification/`, `decisions/`, `escalations/`, `status.md`, `HANDOVER.md`), or it is lost the moment a different chat or agent needs it.
2. **Extraction tests never depend on live bvb.ro access.** Whoever runs the tests — `story-tester`, Troubleshoot, or Copilot under the fallback — uses fixture PDFs committed to `test/fixtures/`. Anything requiring live BVB access, a real Neon database, or the deployed Vercel environment is the user's manual step (in the QA checklist), never an automated one.

## Definition of Ready (before a story starts)

- Acceptance criteria are concrete and testable.
- Any design/direction ambiguity has already been resolved and validated with the user (see Coordination model above) — a story should not require Copilot (or the user) to make an unreviewed design call.

## Definition of Done (before a story is marked complete)

- Code implements the acceptance criteria.
- **Automated unit tests** exist for the new logic and pass.
- **Review verdict: PASS** — every acceptance criterion individually met (`story-reviewer`, or the Technical Lead directly under the Copilot fallback).
- **Test verdict: PASS** — suite green *and* the story's acceptance criteria actually covered by tests (`story-tester`, or Troubleshoot directly under the fallback).
- **Manual verification by the user** — the user runs/checks the result and confirms it behaves as expected. This is a required step, not optional, even when everything above is green.
- `status.md` updated (PO).

## Model & cost strategy (VS Code / Copilot side)

- Instructions to Copilot are written in English (see story format above) — reduces token cost vs. Romanian.
- Model + thinking-level choice is made **per story**, not fixed project-wide, based on the story's actual complexity:
  - Low/mechanical (boilerplate, simple CRUD, formatting, config) → cheaper/faster model, low thinking effort.
  - Higher complexity (parsing logic, architecture-adjacent code, ambiguous edge cases) → stronger model, higher thinking effort.
- Several of the models currently available in the user's Copilot model picker are recent enough that Claude doesn't have reliable first-hand knowledge of their cost/quality trade-offs. Rather than guess, this is decided per story when it's written, checked against current info if needed.

## Testing policy

- Automated unit tests are written alongside the code they cover (not deferred to "later").
- In addition, functionality that affects user-visible behavior gets a manual check by the user before a story is marked done.
