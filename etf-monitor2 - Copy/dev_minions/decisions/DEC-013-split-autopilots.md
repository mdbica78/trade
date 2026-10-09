# DEC-013 — Split the autopilot: Claude Code for development, Codex for QA + deploy

- Status: **Decided** — requested by the user, 2026-09-24; design by the Technical Lead.
  **Amended by DEC-014** (2026-09-25): the QA loop runs only while the dev loop runs and ends its
  session when the dev loop pauses — decision 2's "run continuously" no longer holds on its own.
  **Amended by DEC-015**: QA evidence must quote command, exit code and output tail.
- Amends: DEC-009 (delivery loop stays, QA step removed from it), DEC-012 (QA moves off Claude
  Code entirely, onto a separate Codex loop; the check mechanics and output format are
  otherwise unchanged)

## Context

Claude usage was burning fast: every story's loop was plan → implement → independent review →
independent tests → automated QA (a full extra build + serve + multi-check pass, DEC-012) →
sprint audit, all inside the same Claude Code session. The user has a separate Codex session
that already understands this process well and is good at running tests and at deploying to
Vercel. Rather than keep paying for QA inside the expensive loop, split delivery into two
independent, asynchronous loops that hand off through the same files `dev_minions/` already
uses — no new plumbing, no direct communication channel between the two tools (there isn't
one), just files each loop reads and a narrow write scope so they don't collide.

## Decision

1. **Dev autopilot (Claude Code) — unchanged except QA comes out.** Pick → detail sprints →
   plan → implement → independent review + tests (`story-reviewer`/`story-tester`, DEC-005,
   stay here) → `tech-lead` for decisions/escalations/sprint audits (DEC-009, stays here) →
   story → `Awaiting QA`. It no longer delegates to `qa-runner` and no longer waits for a QA
   verdict before moving to the next story or closing a sprint.
2. **QA/Deploy autopilot (Codex) — new.** A separate loop the user starts themselves in a
   Codex session (`dev_minions/automation/qa-goal.txt` is the prompt to paste in), run
   continuously, polling `status.md`'s Story board for stories `Awaiting QA` with no QA run
   yet, or reopened-and-redelivered ones. Brief: `dev_minions/roles/qa.md` (rewritten by this
   decision for a standalone polling loop; the check classification and mechanics from
   DEC-012 are unchanged in substance).
3. **Fix ownership stays with Claude.** Codex never edits application code or tests. A QA
   `FAIL`: it writes the findings into `US-XXX-qa-run.md` exactly as DEC-012 specified, and
   reopens the story by setting its `status.md` Story board row to
   `Ready — reopened by QA (see US-XXX-qa-run.md)`. The dev autopilot's existing picker
   (`deliver-story` step 1: "Ready/To Do **or reopened**") already treats this as eligible
   work — no new state machinery needed. Codex does not wait for the fix; it moves to its next
   eligible story and re-checks this one once it's back at `Awaiting QA`.
4. **Deploy — Codex never touches git, not even to push.** "No agent runs git" stays absolute
   with zero exceptions, for every agent in this project including the QA/Deploy loop — this
   revises the first draft of this decision, which gave Codex a `git push`-only carve-out; the
   user asked for that to come out. Instead: once Codex has nothing more eligible to QA this
   cycle, it checks whether something looks ready to ship (commits it can see locally that
   haven't shown up on the deployed site). If so, it does **not** push — it records one line in
   its own log section (see "Notice, don't wait") naming what's ready and that it needs a push,
   and moves on. The user pushes on their own schedule; once it lands and Vercel deploys, Codex
   smoke-checks the deployed `/health` page on a later cycle.
5. **"Notice, don't wait."** If Codex needs something from the user — a push only they can make,
   a check it genuinely can't settle, missing credentials for something else — it records one
   line in its own log section (see write scope) and continues with other eligible work. It
   never blocks its loop waiting for an answer; nobody may be watching it.
6. **Write scope**, so the two independent loops never collide on a shared file without a
   lock: Codex may write or append only —
   - `dev_minions/verification/US-XXX-qa-run.md` (append a new round; DEC-012's format,
     unchanged);
   - the Story board row, in `status.md`, of the story it just QA'd — nothing else in that
     file;
   - a `## QA/Deploy log (Codex)` section at the very bottom of `HANDOVER.md`, append-only.

   Codex never touches `decisions/`, `escalations/`, `verification/SPRINT-*`, or any part of
   `HANDOVER.md` above its own log section (Active story, Files changed, Exact next step,
   Waiting on the user all stay the dev autopilot's).
7. **Sprint close decouples from QA.** `tech-lead`'s sprint audit (DEC-009) no longer requires
   every story in the sprint to have a QA run before auditing — Codex is async and may lag.
   The audit checks review/test evidence as before, and separately lists which of the sprint's
   stories don't have a `US-XXX-qa-run.md` yet (informational, not blocking, not reopening
   anything).
8. **Kit changes.** `qa-runner` is retired from `.claude/agents/` — it was designed by the
   prior DEC-012 kit update but never installed, so this retires it before it ever ran; the
   pending-kit copy is left as an inert stub pointing here, in case `install-kit.sh` runs
   before the user removes it by hand. `roles/qa.md` is rewritten for a human-started,
   continuously-polling Codex session instead of a per-story Claude subagent delegation.
   `.claude/settings.json` drops the `qa-serve.sh` permission (Claude no longer runs it).
   `scripts/claude/qa-serve.sh` and every QA check mechanic are otherwise unchanged — they now
   belong to the Codex loop, run from wherever Codex's shell runs.

## Consequences

- Claude Code's usage drops by roughly the review+test+QA-run share of every story — QA was a
  full extra build+serve+multi-check pass per story, on top of the independent review/test
  pair that stays.
- QA now genuinely runs in parallel with development instead of gating the same loop that
  just wrote the code. Stories can sit in `Awaiting QA` longer before Codex reaches them —
  same as they already did waiting on the user's own manual QA before DEC-012 existed.
- **"No agent runs git" stays a genuinely absolute rule, zero exceptions, for every agent in
  this project** — the QA/Deploy loop included. Deploys therefore always have a human step in
  the middle: Codex notices and names what's ready, the user pushes when they choose to, Codex
  notices the result on its next cycle. This is slightly less automated than a QA loop that
  could push for itself, in exchange for never having an agent touch the project's git history
  at all.
- The write-scope rule (decision 6) is what keeps two independent, asynchronous loops from
  corrupting each other's shared files without a lock file. If it's ever violated in practice
  (a QA run clobbers part of HANDOVER.md's Active-story block, say), that's a kit bug to fix
  immediately, not something to work around by hand.
