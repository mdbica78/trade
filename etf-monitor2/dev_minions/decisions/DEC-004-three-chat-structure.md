# DEC-004 — Move from one Coordinator chat + ephemeral coworkers to three standing chats

**Date:** 2026-09-23
**Status:** PROPOSED — pending Technical Lead sign-off (this is itself a process/structure decision, drafted by the PO; the user will relay it to the Technical Lead chat for confirmation)

## Context

`process.md` and `roles/` (written 2026-09-22) deliberately specified a lean model: one Coordinator chat combining Product Owner + Delivery, with two ephemeral coworkers (Code Reviewer, Test Runner) spawned per story inside that same session and discarded afterward. The stated reasoning was that a solo, personal-use project didn't justify the coordination overhead of separate standing chats.

As of 2026-09-23, the user has instead set up three separate, standing claude.ai chats: this one (PO), a Technical Lead chat, and a Troubleshoot chat.

## Decision

Adopt the three-chat structure going forward:

- **PO** (this chat) — unchanged in substance: requirements, backlog, sequencing, the only role that talks to the user about planning and the only one that updates `status.md`.
- **Technical Lead** — takes over the former Code Reviewer's responsibilities (independent code review against acceptance criteria), plus technical/architecture sign-off authority: direction decisions drafted by the PO (ADRs, stack/library choices) need the Technical Lead's confirmation before moving from `PROPOSED` to `Decided`.
- **Troubleshoot** — takes over the former Test Runner's responsibilities (independent test execution, AC coverage reporting), plus general environment/bug diagnosis (the `DEC-001`…`DEC-003` kind of work).

The former `roles/code-reviewer.md` and `roles/test-runner.md` are kept in place with a superseded notice, for history — not deleted, since they document the original reasoning and output formats the new roles still use.

Because none of the three chats can see into each other's conversation — there is no automatic chat-to-chat messaging — a `verification/` folder is added: `US-XXX-review.md` and `US-XXX-tests.md` per story, so a verdict survives independently of the chat that produced it. This is a direct consequence of moving from "coworkers with no memory between sessions" (the old constraint, which forced writing everything to this folder) to "three chats that each have memory, but only of themselves" (the new constraint, which still forces writing everything to this folder, for a different reason).

`process.md` and `roles/coordinator.md` have been updated to match. `README.md`'s folder layout is updated to list the new role files and `verification/`.

## Consequences

- Slightly more coordination overhead than the original lean model (the user now relays between three chats instead of running everything in one), but this reflects how the user actually chose to run the project, not a recommendation to add process for its own sake.
- The Definition of Done wording changes from "Code Reviewer verdict" / "Test Runner verdict" to "Technical Lead verdict" / "Troubleshoot verdict" — same bar, same output formats, different name.
- Technical decisions now get an explicit second technical opinion (the Technical Lead) before being treated as settled, rather than the PO alone deciding when something counts as "already validated."
- Pending immediate consequence: **ADR-001 (tech stack) is still `PROPOSED`** and Sprint 1 stories from US-002 onward are still blocked on it. Whether the Technical Lead's sign-off on ADR-001 is bundled with sign-off on this restructuring, or handled separately, is the user's call.
