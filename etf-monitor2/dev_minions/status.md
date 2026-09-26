# Status

*Last updated: 2026-09-25 23:00 (PO — docs cleanup; both loops stopped)*

This is the single place for **where the project is** and **what waits on you**.
How we work: `process.md`. Live dev-loop state: `HANDOVER.md`.

## Where we are

| Sprint | Stories | State |
|---|---|---|
| 1 Foundation | US-001..006 | Done — all accepted |
| 2 Extraction core | US-007..011 | US-007, US-011 Done; US-008..010 built, QA PASS, awaiting your acceptance |
| 3 Automation & persistence | US-012..015 | US-015 Done; US-012..014 built, QA PASS, awaiting your acceptance |
| 4 Monitoring UI | US-016..019 | Built; US-016..018 QA PASS, US-019 QA not yet run; all awaiting your acceptance |
| 5 Admin panel | US-020..024 | Not detailed yet — next for the dev loop |
| 6 AI configuration | US-025..028 | Not detailed yet |
| 7 Hardening | US-029..031 | Not detailed yet |

**Progress:** 9 of 31 stories Done, 10 built and waiting on your acceptance, 12 not started.
All four sprint audits are written (`verification/SPRINT-0N-audit.md`); none left a story open.
The app is deployed at https://etf-monitor2.vercel.app (health check confirmed by you on 2026-09-24).

## Waiting on you (in this order)

**1. Security — do first.** A dev-loop session ran `cat ~/.npmrc` and printed your GitHub Packages token
into two local log files (Sprint 4 audit C1). They are gitignored, but the token went to the model provider.
- Revoke or rotate that token.
- Delete `dev_minions/automation/logs/autopilot-20260925-153758-a1.jsonl` and `autopilot-20260925-203756-a3.jsonl`.

**2. Product decisions.** Each story shipped a default, so nothing is blocked. Answer P1 and P2 first:
they change P6, P9 and P11. Details: `backlog/sprints/sprint-03.md` and `sprint-04.md` → "Decisions needed".

| # | Question | Shipped now | Recommended |
|---|---|---|---|
| P1 | Store only tracked fields, or every field the adapter extracts? (US-012) | Tracked only | Every field, so a newly tracked field already has history |
| P2 | Monday filings hold Fri+Sat+Sun reports. Ingest only the newest, or all of them? (US-012) | Newest only — Fri and Sat are never stored | All reports in the newest filing row |
| P3 | "Today's value" on the home table (US-016) | Newest `ok` report, with its date shown | same |
| P4 | Show values from `parse_error` reports? (US-016..019) | No — only `ok` reports; errors go to the admin dashboard (US-024) | same |
| P5 | Date format (US-016) | RO `22.09.2026`, EN `2026-09-22` | same |
| P6 | "Previous day" for deltas (US-017) | The calendar day before; blank if missing (blanks Sunday under P2 = newest only) | same |
| P7 | Delta display (US-017) | %, 2 decimals, half away from zero, explicit `+`/`-`, no space before `%`, blank when previous value is 0 | same |
| P8 | How to open the detail page when the symbol links to the PDF (US-018) | Separate "Istoric / History" link per row | same |
| P9 | Days with no `ok` report in the history table (US-018) | Omitted | same |
| P10 | Detail page of a deactivated ETF (US-018) | Still reachable by URL | same |
| P11 | Chart gaps and range (US-019) | Line breaks at missing days; whole history, no range selector | same |

Also confirm the agent-drafted acceptance criteria of Sprints 2–4 (or tell me what to correct),
and judge whether the charts look close enough to bvb.ro (FR8).

**3. Accept stories.** For each story below, run the "For the user" items in `verification/US-XXX-qa-run.md`
(or `US-XXX-qa.md` if no QA run exists yet), then tell any agent "accept US-XXX" (or "reject US-XXX: <reason>").
- QA PASS, awaiting acceptance: US-008, US-009, US-010, US-012, US-013, US-014, US-016, US-017, US-018.
- Not yet QA'd by Codex: US-019.
- Sprint 4's live checks need at least two consecutive days of reports in Neon (`sprint-04.md` → "Manual QA").
- Still observational: at least one **scheduled** (not manual) cron run has written a `job_runs` row.

**4. Git.** Commit and push whatever you have not pushed yet. Agents never run git.

**5. Install the kit update, then start both loops together.** In WSL, in the project folder:
`bash scripts/claude/install-kit.sh`, then `tmux new -s etf 'bash scripts/claude/autopilot.sh'`, then paste
`automation/qa-goal.txt` into Codex. From now on Codex stops by itself whenever the autopilot pauses (usage limit,
network, stopped); after a usage-limit wait the autopilot resumes on its own, Codex needs a new paste (DEC-014,
`automation/AUTOMATION.md`).

## Open items for the Technical Lead chat (kit changes — not blocking stories)

None. The six items from the Sprint 3–4 audits (secrets rule and deny list, disclosing denied commands,
verifier honesty, Codex evidence, kit contradictions, kit clutter) were done on 2026-09-25 — DEC-015 —
together with DEC-014 (the Codex QA loop stops whenever the dev loop pauses). They take effect once you
run the kit installer (item 5 above).

## PO to-dos

- Fold DEC-007 (number format) and the answers to P5/P7 into `requirements/etf-monitoring-requirements.md` once you confirm them.

## Story board

| Story | Title | State |
|---|---|---|
| US-001 | Spike: PDF text extraction | Done — accepted by the user |
| US-002 | Project scaffold | Done — accepted by the user |
| US-003 | Database schema and Drizzle/Neon setup | Done — accepted by the user |
| US-004 | Bilingual (RO/EN) infrastructure | Done — accepted by the user (2026-09-24) |
| US-005 | Seed ETF registry and field catalogue | Done — accepted by the user (2026-09-24) |
| US-006 | Deploy to Vercel with health check | Done — accepted by the user (2026-09-24) |
| US-007 | Report discovery: find the latest report link on a BVB instrument page | Done — accepted by the user (2026-09-24) |
| US-008 | PDF download and text extraction service | Awaiting QA — Codex QA PASS (2026-09-24); awaiting user acceptance |
| US-009 | Adapter interface and registry | Awaiting QA — Codex QA PASS (2026-09-24); awaiting user acceptance |
| US-010 | BRD depositary adapter | Awaiting QA — Codex QA PASS (2026-09-24); awaiting user acceptance |
| US-011 | Test fixtures: committed sample reports and adapter unit tests | Done — accepted by the user (2026-09-24) |
| US-012 | Ingestion pipeline: discover → download → extract → persist, per ETF | Awaiting QA — Codex QA PASS (2026-09-24); awaiting user acceptance |
| US-013 | Daily cron endpoint and Vercel Cron configuration | Awaiting QA — Codex QA PASS (2026-09-25); awaiting user acceptance |
| US-014 | Missing report, parse failure, and no-adapter handling | Awaiting QA — Codex QA PASS (2026-09-25); awaiting user acceptance |
| US-015 | Job run logging | Done — accepted by the user (2026-09-25) |
| US-016 | Home table with configurable columns and PDF links | Awaiting QA — Codex QA PASS (2026-09-25); awaiting user acceptance |
| US-017 | Day-over-day delta calculation (absolute and percentage) | Awaiting QA — Codex QA PASS (2026-09-25); awaiting user acceptance |
| US-018 | ETF detail page: historical values table | Awaiting QA — Codex QA PASS (2026-09-25); awaiting user acceptance |
| US-019 | ETF detail page: time-series charts for tracked fields | Awaiting QA — Codex QA PASS (2026-09-26); awaiting user acceptance |
| US-020 | Admin: ETF management (add, remove, activate) | Awaiting QA — Codex QA PASS (2026-09-26); awaiting user acceptance |
| US-021 | Admin: tracked-field management per ETF | Awaiting QA — Codex QA PASS (2026-09-26); awaiting user acceptance |
| US-022 | Admin: AI provider and API key settings | Awaiting QA — Codex QA PASS (2026-09-26); awaiting user acceptance |
| US-023 | Admin: cron hour setting | Awaiting QA — Codex QA PASS (2026-09-26); awaiting user acceptance |
| US-024 | Admin: operational dashboard (job runs, last successful extraction, parse errors) | Ready |

Sprint 5 detailed and reviewed by tech-lead (`SPRINT-05-review.md`), 2026-09-26; DEC-016 recorded. Sprints 6–7 (US-025..US-031) get rows when the dev loop details them.
