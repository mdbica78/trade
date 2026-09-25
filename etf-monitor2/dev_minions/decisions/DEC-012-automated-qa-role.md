# DEC-012 — Automated QA role (`qa-runner`)

- Status: **Superseded by DEC-013** the same day (was Decided 2026-09-24) — the `qa-runner` subagent was never installed or run; its QA mechanics now run in the Codex loop (`roles/qa.md`).
- Amends: DEC-009 (delivery loop step 7, demo file, sprint close)
- Brief: `dev_minions/roles/qa.md` · Agent: `.claude/agents/qa-runner.md` · Helper: `scripts/claude/qa-serve.sh`

## Context

After the first autopilot night, nine stories (US-003 … US-011) sat in Awaiting QA. Each QA
checklist was a list of manual steps for the user, even though most of them are things a
machine can do: run a command and read its output, open a page, switch the locale and check
the labels, confirm `/health` shows the failure state when the database is down, and read the
newest report link from bvb.ro. The user asked for a QA role that runs this testing
automatically.

## Decision

1. **New role and subagent.** A `qa-runner` subagent (sonnet, medium effort, fresh context)
   runs after story-reviewer and story-tester both PASS. It builds its check list from the
   story's acceptance criteria, the plan's `MANUAL-QA` items and the implementer's QA checklist.
   It adds checks where the checklist is too easy, and classifies every check: `AUTO`,
   `AUTO-PARTIAL`, `JUDGMENT`, `LIVE-DB`, `LIVE-ACCOUNT`, `NOT-AUTOMATABLE`.
2. **What it runs:** commands (tests, build, `pnpm report:latest`, …); the app built and served
   locally on `127.0.0.1:3100` through `scripts/claude/qa-serve.sh`, either with no database or
   with a deliberately unreachable one; locale switching via the locale cookie; and live bvb.ro
   reads (≤10 requests per run).
3. **What it doesn't run:** anything needing a real database (user's choice: no QA database for
   now), the user's accounts or credentials, editing project files, git, deploys. Those items,
   plus the judgment calls (Romanian wording, drafted criteria), are the only things left for
   the user.
4. **Output:** `verification/US-XXX-qa-run.md` holds a verdict (PASS / FAIL / BLOCKED), a table
   with evidence per check, and a "For the user" list. A **FAIL is a failed gate**: fix,
   re-review and re-test, then re-run QA; it counts toward the 3-round limit. BLOCKED is an
   environment problem and doesn't stop the story.
5. **User acceptance stays with the user** (user's choice). QA PASS doesn't make a story Done.
   The demo file now lists, per story, the QA result plus only the items left for the user.
6. **Backlog:** stories already in Awaiting QA without a QA run get one, up to 3 per session,
   before new work. A FAIL there reopens the story. Every story has a QA run before its
   sprint audit, and the tech-lead audit checks the QA evidence too.
7. QA agents run one at a time (shared port). Allowed via
   `Bash(bash scripts/claude/qa-serve.sh *)` in `.claude/settings.json`.

## Consequences

- The demo shrinks from "follow these 9 checklists" to a handful of questions, live steps and ticks.
- A true browser click (the language switcher button) stays with the user: AUTO-PARTIAL checks
  cover the rendering on both sides of the cookie, and unit tests cover the switcher logic.
  A headless browser on WSL1 was not attempted.
- Extra cost per story: one sonnet subagent plus a production build (~1–2 min on WSL1).
- Later option (not done now): a separate Neon `qa` branch would let the QA agent run the
  LIVE-DB checks too.
