# DEC-006 — Technical Lead moves from a chat-only advisory role to a persistent, file-access role

- Status: **Decided**
- Date: 2026-09-23
- Supersedes: DEC-004's Technical Lead description
- Related: DEC-005 (per-story review/test verdicts remain with the `story-reviewer`/`story-tester` subagents; unchanged by this decision)

## Context

DEC-004 set up the Technical Lead as a standing chat with no file access: verdicts and sign-offs were given verbally to the user, who then relayed them and made the actual file edits (`status.md`, `HANDOVER.md`, decision files) on the Technical Lead's behalf. This created a hop where a decision could be validated in conversation but never make it to disk — which is exactly what happened to ADR-001: it was verbally validated by the Technical Lead in an earlier, file-less chat, but its `Status:` line, the validation rationale, its row in `status.md`, and the blocking entry in `HANDOVER.md`'s "Waiting on the user" were never updated to match.

## Decision

The Technical Lead is now a persistent role with direct read/write access to the repo and `dev_minions/`, defined in `roles/technical-lead.md`. Under this role it:

- Reviews PROPOSED architecture/technical decisions and, on acceptance, edits the decision file directly (`Status:` line to `Decided`, plus a dated validation note) rather than relaying a verbal verdict for someone else to transcribe.
- Owns escalations (`escalations/ESC-XXX-*.md`) end to end, including any `status.md` / `HANDOVER.md` updates needed to unblock a story once an escalation is resolved.
- Runs the sprint verification audit (sampling `verification/US-XXX-review.md` / `-tests.md` against acceptance criteria).
- May edit `status.md` and `HANDOVER.md` for the decisions/escalations it resolves — only the rows/sections its own action changes, never the PO's planning sections or the per-story fields the delivery loop owns.

This does not pull per-story code review or test execution back into the Technical Lead chat — those stay with the `story-reviewer` and `story-tester` subagents per DEC-005. The role keeps all of `roles/technical-lead.md`'s existing boundaries: no git, no application code, no deploys, no touching Vercel/Neon/secrets, no moving a story to Done.

## Consequences

- Closes the gap that let a decision be "Decided" verbally but stay `PROPOSED` on disk indefinitely — as happened with ADR-001, now corrected (see `architecture/ADR-001-tech-stack.md`, `status.md`, `HANDOVER.md`).
- The Technical Lead can unblock a story chain directly instead of asking the user to relay a verdict to the PO chat for transcription.
- `roles/technical-lead.md` was rewritten to add this scope, with the prior chat-only version kept in the same file under a superseded notice, for history.
