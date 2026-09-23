# DEC-009 — Autopilot: continuous multi-sprint delivery, in-loop Technical Lead, stop only when blocked on the user

- Status: **Decided** — requested by the user, 2026-09-23; technical design by the Technical Lead
- Amends: DEC-005 (delivery loop, story states, stop conditions), DEC-006 (Technical Lead scope)
- Related: `AGENTS.md`, `CLAUDE.md`, `.claude/`, `dev_minions/automation/`, `scripts/claude/autopilot.sh`

## Context

Under DEC-005 Claude Code delivers one sprint per `/goal` run (60-turn cap), stops at the
end of the sprint, and stops whenever a technical decision needs the Technical Lead chat,
which only the user can relay. Sprints 2–7 exist only as titles in `backlog/roadmap.md`,
so every new sprint also needed the PO to detail it first. The user wants the automation
to deliver as many stories as possible and to stop **only** when it needs a decision from
the user or has nothing left it can do without the user (the "demo").

User's choices (2026-09-23): no per-sprint demo stops; roll across sprints and stop only
when every remaining story is blocked on the user. No scheduled watcher from the
Technical Lead chat; the Technical Lead check runs inside the loop.

## Decision

1. **Continuous across sprints.** When every story of the current sprint is Awaiting QA,
   Done or Blocked, Claude Code rolls into the next sprint of `backlog/roadmap.md`
   without stopping.
2. **Agent-detailed sprints.** Title-only sprints are detailed by `story-planner`
   (opus): a sprint file plus one story file per roadmap title, every acceptance
   criterion citing its FR, headed `Detailed by agent — PO to confirm at demo`. The
   in-loop `tech-lead` subagent reviews the drafted sprint for requirement fidelity
   before any of its stories starts. A story that needs a product choice the
   requirements don't make gets a PROPOSED decision and is Blocked; the others go ahead.
3. **In-loop Technical Lead.** A new `tech-lead` subagent (opus, high effort, brief =
   `roles/technical-lead.md`) runs inside Claude Code and:
   - validates **technical** PROPOSED decisions (architecture, library, schema, pattern)
     and sets them Decided without stopping;
   - leaves **product / scope / cost / credential** decisions PROPOSED as `NEEDS USER`,
     and those stories are blocked on the user;
   - triages every escalation (after 3 failed rounds): `AGENT-FIXABLE` + plan → one
     more round (round 4); `NEEDS-USER` → the story is Blocked and the loop moves on;
   - audits each sprint when it closes (`verification/SPRINT-0N-audit.md`). A Critical
     audit finding re-opens that story for a fix round.
   Independence: `tech-lead` runs on a different model tier (opus) from the
   implementer/reviewer (sonnet) and tester (haiku), with fresh context. The standing
   Technical Lead chat audits the subagent's calls after the fact, whenever the user
   brings it back.
4. **Stop only when blocked on the user.** The loop keeps picking any eligible story in
   any detailed sprint. It stops (`Automation state: STOPPED-FOR-USER`) only when no
   story is eligible because everything left waits on the user: a `NEEDS USER`
   decision, a live step (create Neon/Vercel, enter keys, deploy, migrate), an
   escalation marked `NEEDS-USER`, or dependencies on those. It then writes one
   consolidated demo file, `verification/DEMO-YYYYMMDD-HHMM.md`. When the whole roadmap
   is Awaiting QA or Done: `ALL-DONE`, same demo file.
5. **Stories still stop at Awaiting QA individually.** Awaiting QA already satisfies
   dependencies (AGENTS.md), so it never blocks the loop. The QA checklists accumulate
   and are merged into the demo file.
6. **Done via the demo file.** The user ticks accepted stories in the demo file
   (`- [x] US-XXX`). On its next start the agent moves exactly those stories to Done in
   `status.md` and logs it: the user's recorded acceptance, agent bookkeeping. Rejected
   items with notes re-open that story for a fix round. Stories are still never
   self-certified as Done.
7. **Unattended runner.** `scripts/claude/autopilot.sh` runs Claude Code in cycles with a
   fresh context each cycle (a cycle ends by itself after about 120 turns with a
   handover, state `PAUSED`). It restarts while the state is `RUNNING`/`PAUSED`. It waits
   out usage limits, stops after two cycles without any progress, and has a maximum
   cycle count. `HANDOVER.md` now carries a machine-readable `Automation state:` line.
8. **Unchanged:** agents never run git (not even read-only), never deploy, migrate Neon,
   change Vercel settings, or read `.env*`; never weaken tests; never edit
   `requirements/` or accepted ADRs. Copilot fallback keeps the old, more conservative
   stop rules (it has no subagents): it stops for any decision.
9. **Technical Lead scope (amends DEC-006):** the Technical Lead also maintains the
   automation kit (`AGENTS.md`, `CLAUDE.md`, `.claude/`, `.github/` prompts,
   `dev_minions/automation/`, `scripts/claude/`, the delivery-loop section of
   `process.md`). It still never writes application code or tests. `.claude/` and
   `.github/` can't be written remotely, so their updates are staged in
   `dev_minions/automation/pending-kit/` and installed by the user with
   `bash scripts/claude/install-kit.sh` (backs up the old files). `autopilot.sh` refuses to
   start until the kit is installed.

## Consequences

- Many fewer stops. Expected stops: the end of Sprint 1 at the latest for its live steps
  (Neon + Vercel creation, env vars, migrate/seed/deploy), then any product decision, AI
  provider keys (Sprint 6), and live-only investigations (US-029, US-031).
- **Risk accepted by the user:** later sprints get built with mocks before the live
  Vercel ↔ Neon chain has been proven (Sprint 1's goal). A problem in that chain would
  surface late, across more code.
- **Risk:** uncommitted work accumulates across sprints (agents never run git). The
  demo file lists every file changed since the last demo. The user can commit at any
  time without stopping the loop; recommended at least once per sprint.
- **Risk:** agent-drafted acceptance criteria can drift from intent. Mitigations: FR
  citation required on every criterion, `tech-lead` fidelity review per sprint, and the
  user's confirmation at the demo.
- Cost: continuous runs use the Claude Code budget faster. opus is used only for
  planning complex stories, detailing sprints, and the tech-lead calls. Everything else
  stays on sonnet/haiku.
