# Status

*Last updated: 2026-09-28 (Technical Lead chat — Sprint 9 reviewed, DEC-020..022 recorded, Sprint 8 attribution corrected; PO docs cleanup 2026-09-25)*

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
| 6 AI configuration | US-025..028 | Built; all four Awaiting QA (review+tests PASS), awaiting Codex QA and your acceptance |
| 7 Hardening | US-029..031 | Built; all three Awaiting QA (Codex QA PASS 2026-09-28), awaiting your acceptance. First Vercel build failed (see Sprint 8) |
| 8 Stabilisation | US-032..034 | All three Awaiting QA (review+tests PASS); sprint audit done, FINDINGS, no Critical, none reopened |
| 9 Look, home table, ingestion | US-048, US-035..039, US-047 | Reviewed by the Technical Lead (`SPRINT-09-review.md`, APPROVED); US-048 (migrations on deploy) written; the rest not detailed yet — the dev loop details it next (DEC-020, DEC-023; design reference `backlog/home-design/` is binding) |
| 10 AI setup in the browser | US-040..042 | Not detailed; DEC-021 decided (no user step: key derived from the existing `CRON_SECRET`) |
| 11 Programmable history | US-043..046 | Not detailed; DEC-022 decided |

**Progress:** 9 of 31 roadmap stories Done, 22 built and waiting on your acceptance (US-008..010, 012..014, 016..031),
and 3 new Sprint 8 stabilisation stories built and Awaiting QA (US-032..034).
All five sprint audits are written (`verification/SPRINT-0N-audit.md`); none left a story open. Every roadmap sprint
(1-8) is now detailed and every story is Awaiting QA or Done — nothing is eligible for the dev loop.
The app is deployed at https://etf-monitor2.vercel.app (health check confirmed by you on 2026-09-24).

## UI restyle by an outside designer (PO, 2026-09-28)
A UI designer restyled the app on 2026-09-28 about 06:56 without the Technical Lead, QA or dev loop knowing. It is in the
tree (`app/globals.css`, about 17 components), tests still pass. PO verdict: keep it, no design sprint now, adopt it with a
Sprint 9 (confirmed by the user 2026-09-28, with more items: see `roadmap.md` Sprints 9-11). The Sprint 8 note that blamed a git operation for the five rewritten `app/` files was **corrected by the Technical Lead on 2026-09-28** in `sprint-08.md`, `HANDOVER.md`, `US-032.md` and `DEMO-20260928-1300.md`: it was this designer's work, and it caused the failed Vercel build. Details and the proposed stories:
`backlog/ui-design-adoption.md`.

## Waiting on you (in this order)

**00. Home page.** Look at the approved design reference `backlog/home-design/` (spec + PNGs; binding for US-035, US-036, US-047, DEC-020 §10) and say yes or what to change. Hand the designer's written review to the PO/Technical Lead if there is one, and answer the open questions in `requirements/etf-monitoring-requirements.md` §8 (PROPOSED items).

**00a. Sprints 9-11: no manual steps (Technical Lead, 2026-09-28, your rule "everything with git push").**
- Database migrations are applied by the production build (DEC-023, first story US-048); you never run `pnpm db:migrate` or open Neon. Stored AI keys use a key derived from the `CRON_SECRET` you already have (DEC-021), so nothing to add in Vercel.
- What is left for you: commit and push (git stays yours), and keep the tmux session running so the dev loop continues: `tmux new -s etf 'bash scripts/claude/autopilot.sh'` (state is RUNNING; no kit reinstall is needed for this change; run `bash scripts/claude/install-kit.sh` only if item 5 below was never done). The loop does not wait for you: after a usage-limit pause it resumes on its own, and no story waits for a user step.
- No login, by your decision: nothing in the project proposes or waits for one, and no agent will raise it. The home Customize panel saves one shared view (P-6).
- Product defaults P-1..P-6 (`verification/SPRINT-09-review.md` §4) need no answer unless you disagree.

**0. Production home page shows an error — superseded by 00a.** The likely cause (migration `0001_etf_report_links` never applied) is repaired automatically by the first production deploy after US-048 ships (DEC-023); until then no manual Neon step is asked of you. The one thing worth confirming once, in Vercel → Environment Variables, is that `DATABASE_URL` and `CRON_SECRET` are enabled for Production (the build step needs `DATABASE_URL` too). Optional before a push: `bash scripts/claude/predeploy-check.sh` (typecheck, lint, build, tests; never touches Neon). (No git check needed: the five `app/` files were the designer's restyle, see the correction above.)

**1. Security — do first.** A dev-loop session ran `cat ~/.npmrc` and printed your GitHub Packages token
into two local log files (Sprint 4 audit C1). They are gitignored, but the token went to the model provider.
- Revoke or rotate that token.
- Delete `dev_minions/automation/logs/autopilot-20260925-153758-a1.jsonl` and `autopilot-20260925-203756-a3.jsonl`.

**2. Product decisions.** Each story shipped a default, so nothing is blocked. Answer P1 and P2 first:
they change P6, P9 and P11. Details: `backlog/sprints/sprint-03.md` and `sprint-04.md` → "Decisions needed".

| # | Question | Shipped now | Recommended |
|---|---|---|---|
| P1 | Store only tracked fields, or every field the adapter extracts? (US-012) | Tracked only | **ANSWERED 2026-09-28 (PO, FR3.1):** every field |
| P2 | Monday filings hold Fri+Sat+Sun reports. Ingest only the newest, or all of them? (US-012) | Newest only — Fri and Sat are never stored | **ANSWERED 2026-09-28:** all reports in the newest filing (FR3.1, US-037) |
| P3 | "Today's value" on the home table (US-016) | Newest `ok` report, with its date shown | same |
| P4 | Show values from `parse_error` reports? (US-016..019) | No — only `ok` reports; errors go to the admin dashboard (US-024) | same |
| P5 | Date format (US-016) | RO `22.09.2026`, EN `2026-09-22` | same |
| P6 | "Previous day" for deltas (US-017) | The calendar day before; blank if missing | **ANSWERED 2026-09-28:** previous available report, with arrows (FR7.2, US-036) |
| P7 | Delta display (US-017) | %, 2 decimals, half away from zero, explicit `+`/`-`, no space before `%`, blank when previous value is 0 | same |
| P8 | How to open the detail page when the symbol links to the PDF (US-018) | Separate "Istoric / History" link per row | **ANSWERED 2026-09-28:** symbol opens the detail page, PDF becomes an icon (FR7.1) |
| P9 | Days with no `ok` report in the history table (US-018) | Omitted | same |
| P10 | Detail page of a deactivated ETF (US-018) | Still reachable by URL | same |
| P11 | Chart gaps and range (US-019) | Line breaks at missing days; whole history, no range selector | same |
| P12 | Symbol link when no direct PDF URL is known (US-029/US-030) | Plain text, as today | Link to the ETF's bvb.ro instrument page (`bvb_url`) instead |
| P13 | "A link to its report" for a no-adapter ETF (US-030) | The newest depositary-report PDF link report discovery finds | same |
| P14 | Does the ETF detail page say "extraction unavailable" for a no-adapter ETF? (US-030) | Yes, same marker as the home table | same |
| P15 | `/health` renders the raw database exception text (US-031, carried from US-006 AC2) | Unchanged (accepted behaviour) | Show it only for known-safe cases (`DATABASE_URL` unset, timeout); translated generic text otherwise |

Sprint 5 audit N3 (P-numbered separately, already listed below as item 2's "already asked"): re-detect
clears a working adapter to NULL on a transient network error; US-030 ships this unchanged unless you say
otherwise before it starts.

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

1. **Done 2026-09-28:** Sprint 8 attribution corrected; DEC-020 (visual layer), DEC-021 (stored provider keys, FR16) and DEC-022 (history widget, FR18) recorded; Sprint 9 reviewed (`verification/SPRINT-09-review.md`). Sprints 10 and 11 are reviewed by the in-loop `tech-lead` before they are detailed.

The six items from the Sprint 3–4 audits (secrets rule and deny list, disclosing denied commands,
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
| US-024 | Admin: operational dashboard (job runs, last successful extraction, parse errors) | Awaiting QA — Codex QA PASS (2026-09-26); awaiting user acceptance |
| US-025 | Pluggable LLM provider adapter interface | Awaiting QA — Codex QA PASS (2026-09-27); awaiting user acceptance |
| US-026 | Two concrete free providers behind that interface | Awaiting QA — Codex QA PASS (2026-09-27; intermittent unrelated full-suite timing noted); awaiting user acceptance |
| US-027 | Intent extraction: natural language → configuration action | Awaiting QA — Codex QA PASS (2026-09-27); awaiting user acceptance |
| US-028 | Chat surface wired to the configuration actions (RO and EN) | Awaiting QA — Codex QA PASS (2026-09-27); awaiting user acceptance |
| US-029 | Investigate and implement ICBETNETF report access | Awaiting QA — Codex QA PASS (2026-09-28); awaiting user acceptance |
| US-030 | No-adapter degradation path, end to end | Awaiting QA — Codex QA PASS (2026-09-28); awaiting user acceptance |
| US-031 | End-to-end verification on the real deployment | Awaiting QA — Codex QA PASS (2026-09-28); awaiting user acceptance |
| US-032 | Hotfix: `/health` timeout state, deploy-gate parity, working-tree cross-check | Awaiting QA — Codex QA PASS (2026-09-28); awaiting user acceptance |
| US-033 | Diagnosable load failures and schema-drift visibility | Awaiting QA — Codex QA PASS (2026-09-28); awaiting user acceptance |
| US-034 | Test stability under load and the pre-deploy gate | Awaiting QA — Codex QA PASS (2026-09-28); awaiting user acceptance |

| US-048 | Migrations applied by the production deploy (DEC-023) | Ready — reopened by Sprint 9 audit C1 (previously accepted by the user 2026-09-28); guard fix under verification |
| US-035 | Adopt the visual layer: lighter trader palette plus light theme, DEC-020 | Awaiting QA — Codex QA PASS (2026-09-29); awaiting user acceptance |
| US-037 | Ingest every report in the newest filing, store every extracted field | Awaiting QA — Codex QA PASS (2026-10-02); awaiting user acceptance |
| US-047 | Home display settings (FR7.3): choose ETFs, value columns, change columns | Awaiting QA — Codex QA PASS (2026-10-02); awaiting user acceptance |
| US-036 | Home table look: symbol opens detail page, delta vs previous available report | Awaiting QA — Codex QA PASS (2026-10-02); awaiting user acceptance |
| US-038 | Charts: type selector, palette, single-point display | Awaiting QA — review PASS (round 2), tests PASS (round 1); Codex QA not yet run |
| US-039 | Visual QA baseline (RO/EN, 375px/1280px, contrast check) | Awaiting QA — review PASS, tests PASS (round 2); Codex QA not yet run |
| US-040 | Store provider keys from `/admin/ai` (encrypted, write-only) | Ready — Sprint 10 detailed and reviewed; prerequisites Awaiting QA |
| US-041 | Provider presets and model picker | Blocked — US-040; Gemini/Groq isolated default, preset roster PROPOSED |
| US-042 | Bilingual chat instruction area | Blocked — US-040 (build order) |
| US-043 | Widget definition schema, validator and config | Ready — Sprint 11 reviewed; scheduled after Sprint 10 |
| US-044 | Widget engine and history-area rendering | Blocked — US-043 |
| US-045 | Multi-action widget chat capability | Blocked — US-043, US-044, US-040..042 |
| US-046 | Raw report-label field feasibility spike (no implementation) | Ready — scheduled last in Sprint 11; product outcome PROPOSED |

Sprint 9 detailed (story-planner) and reviewed by the in-loop tech-lead (`SPRINT-09-review.md` §7, APPROVED), 2026-09-28.
Build order: US-048 → US-035 → US-037 → US-047 → US-036 → US-038 → US-039. Settles D-1..D-10 (see sprint-09.md).
Sprint 8 detailed and reviewed by the Technical Lead chat (`SPRINT-08-review.md`), 2026-09-28; DEC-019 recorded.
Sprint 8 audit (`SPRINT-08-audit.md`), 2026-09-28: FINDINGS, no Critical, no story reopened (4 Warnings, all about
verifier evidence quality, none about shipped behaviour).
Sprint 5 detailed and reviewed by tech-lead (`SPRINT-05-review.md`), 2026-09-26; DEC-016 recorded.
Sprint 6 detailed and reviewed by tech-lead (`SPRINT-06-review.md`), 2026-09-26; DEC-017 recorded.
Sprint 7 detailed (`sprint-07.md`, `backlog/stories/US-029..031.md`) and reviewed by tech-lead
(`SPRINT-07-review.md`, APPROVED), 2026-09-27; DEC-018 recorded (report-access links live in
discovery, shared field-key labels, `etf_report_links` table, run deadline guard). Product items
#4/#5/#9/#10/#12 ship isolated defaults (P12–P15 above; #9 already listed).
