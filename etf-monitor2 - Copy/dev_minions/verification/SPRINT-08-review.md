# Sprint 8 review — Technical Lead chat, 2026-09-28

Verdict: **APPROVED**

Scope reviewed: `backlog/sprints/sprint-08.md`, `backlog/stories/US-032..034.md`, `decisions/DEC-019-*.md`.
Read against: `requirements/`, ADR-001, DEC-010/015/018, the code named below, the user's `pnpm_test.ouput`, the Vercel build error.

## Checks
- **Acceptance criteria and FRs.** Every AC cites what it protects (FR8.1, FR13, US-016 AC9, US-018 AC6, US-028 AC7, US-031 AC4,
  requirements §4, AGENTS.md secrets rule). No AC needs a live resource; the live parts are U1–U5 in the sprint file and one
  MANUAL-QA line in US-033 AC7.
- **No invented product choice.** Nothing changes what a page prints in the HTML. P15 (raw exception text on `/health`) is untouched.
  The one behaviour change users can see is the home page surviving a missing `etf_report_links` table (DEC-019 §3): the literal
  pre-US-030 reading of FR7's report link, isolated to one join.
- **Dependencies.** US-032 first (it unblocks the Vercel build). US-033 and US-034 both depend only on US-032.
- **Roadmap carry-forward handled.** Sprint 6 N5 / Sprint 7 W5 (flaky load-only timeouts) → US-034. `/health` carry-forward debt (Sprint 1 W4, W6)
  was closed by US-031; US-032 re-proves it.

## Notes for the implementer (not blockers)
1. **The Technical Lead chat edited `app/health/page.tsx`** before this sprint existed (one line, `"timedOut" in status` ternary). That is
   outside the role's brief. US-032 AC1–AC3 and AC5 re-prove it; the reviewer must judge the file on its own, not on this note.
2. **US-032 AC4 is the important one.** The recorded green gates and the tree on disk disagreed. If the cross-check finds another missing
   US-029..031 change, restore it from the plan, say so in the verdict, and add one line to HANDOVER "Waiting on the user" for the user's git check (U5).
3. **US-033 AC4 must not swallow other errors.** Test the negative cases (`42703`, `42P01` on another relation, a dropped `reports` table);
   a fallback that catches everything would hide exactly what this sprint is meant to expose.
4. **US-033 AC1**: Drizzle wraps driver errors (`DrizzleQueryError` with `cause`); test the wrapper shape, not only a bare driver error.
   Do not print `error.message` anywhere, even truncated.
5. **US-033 Task 3**: the `to_regclass` statement takes identifiers from the schema exports only; never interpolate anything from a request.
6. **US-034**: if three consecutive runs still fail somewhere else, that is a new finding, not a reason to raise the limit past 30 s.

## Decisions
DEC-019 recorded **Decided** (§1–§5). No PROPOSED file, no NEEDS USER. Stories are `Ready`; status.md updated by the Technical Lead chat (rows it changed only).
