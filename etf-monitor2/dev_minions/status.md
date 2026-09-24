# Status

*Last updated: 2026-09-24 (PO sync)*

## Current phase

**Sprint 1 fully Done. Sprint 2 (extraction core, US-007..US-011) fully delivered — Awaiting QA, and audited PASS by the in-loop `tech-lead` (no Critical findings).** Autopilot (DEC-009, hardened by DEC-011) is running continuously and is now detailing Sprint 3 (US-012..US-015, scheduled automation & persistence). Eight stories (US-004..US-011) are piled up Awaiting QA — the user has not yet run through their QA checklists or committed.

## Done

- Functional requirements defined and validated with the user — `requirements/etf-monitoring-requirements.md`.
- Confirmed live on bvb.ro that report formats differ between issuers: BTBETRETF / TVBETETF / PTENGETF share the BRD depositary format with direct PDF links; ICBETNETF uses a different format and a submit-button download whose mechanism is still unknown.
- Hosting direction chosen: new Vercel project (Hobby) + Vercel Cron (once daily) + Neon Postgres (free tier).
- Working process defined — `process.md`, with role briefs in `roles/`.
- Backlog defined — 7 epics (`backlog/epics.md`), 7 sprints (`backlog/roadmap.md`); Sprint 1 and Sprint 2 fully detailed and delivered, Sprint 3 being detailed now.
- Data model specified — `architecture/data-model.md` (FK nullability tightened by DEC-010).
- **ADR-001 (tech stack) — Decided**, including the PDF library choice (`unpdf@0.11.0`, resolved by US-001, re-confirmed by US-008/US-010 after a newer `unpdf` version briefly broke the flattened-text contract — pinned back, not a new DEC).
- **DEC-001…DEC-003**: local environment (Node 22/WSL1, Zscaler proxy certs, `.profile` PATH ordering).
- **DEC-004**: three standing chats (PO/Technical Lead/Troubleshoot) — amended by DEC-005/DEC-009 for the per-story loop.
- **DEC-005**: Claude Code as implementer/orchestrator, `story-reviewer`/`story-tester` subagents.
- **DEC-006**: Technical Lead moved to a persistent, file-access role.
- **DEC-007**: Number display format — no thousands separator, decimal mark only. Not yet folded into `requirements/etf-monitoring-requirements.md` (PO todo, low priority).
- **DEC-008**: local `dev`/`build` use webpack not Turbopack (WSL1/DrvFs crash); `NODE_EXTRA_CA_CERTS` must be exported per non-interactive shell.
- **DEC-009**: autopilot — continuous multi-sprint delivery, in-loop `tech-lead`, stop only when blocked on the user.
- **DEC-010**: US-003 schema clarifications (FK nullability, Neon driver mode) — Decided by the in-loop tech-lead; left a binding note for Sprint 3 (US-012 must write report+values in one HTTP-driver call, not two).
- **DEC-011**: autopilot resilience — file-write tracking hook (`.files-touched.log`) so a killed session resumes exactly; exact usage-limit-reset waits instead of a fixed guess. **Amended 2026-09-24**: an overnight network outage (~03:21, API unreachable) was miscounted as "no progress" and stopped the runner, losing the rest of the night — the runner now backs off and retries network errors (5→10→20→30 min, gives up after 10h) instead of giving up immediately. Keeping the PC awake while the autopilot runs avoids most of these.
- **US-001…US-003 — Done**, QA'd and committed by the user.
- **US-004…US-011 — Awaiting QA** (Sprint 1 tail + all of Sprint 2). See Story board below and `HANDOVER.md` → "Waiting on the user" for the checklists and manual steps.
- **Sprint 1 audit — PASS** (`verification/SPRINT-01-audit.md`), 6 non-blocking Warnings.
- **Sprint 2 audit — PASS** (`verification/SPRINT-02-audit.md`), no Critical findings. Two Warnings worth the user's attention (not blocking any story, see Next step below): a broken/unreadable `scripts/claude/autopilot.sh` file found on disk, and a recurring pattern of agents *attempting* (always denied) git commands that verdict files don't disclose.

## Local environment setup — done

| Tool | Status |
|---|---|
| nvm | Installed on both accounts (root and the user's normal account) |
| Node.js 22 LTS | Confirmed (`v22.23.2`) on both accounts, persistent across fresh terminals and a full WSL restart |
| pnpm | Confirmed (`12.5.1`) on both accounts |
| git | OK (2.43.0) — commit author identity noted as unrelated to push auth (user authenticates via manual username+token) |
| gh CLI | Skipped — user authenticates git push/pull manually with username+token, doesn't need gh |
| VS Code ↔ WSL | Not yet confirmed — `code --version` was not found in WSL PATH; fix given (`code .` from WSL after installing the WSL extension), not yet verified |
| Local repo ↔ GitHub | Not yet done — `etf-monitor2` locally is not yet `git init`'d / connected to the existing GitHub repo (user is handling this themselves) |
| Claude Code (automation) | Installed and running continuously via `scripts/claude/autopilot.sh` in WSL1 "Ubuntu" — see the file-corruption note under Next step |

## Open decisions

- None blocking right now. ADR-001 and DEC-001…DEC-011 are all Decided.
- **Not yet a formal decision, flagged by the Sprint 2 audit**: verdict files (`story-reviewer`, `story-tester`) should disclose *denied* git/`.env*` attempts, not just successful ones — currently a review file can truthfully say "no git commands were run" about a call that was attempted and blocked, which hides the attempt. Needs a Technical Lead kit-maintenance decision, not urgent (nothing has actually leaked — the permission system caught all three attempts across two sprints).

## Next step

1. **Check `scripts/claude/autopilot.sh` on disk.** The Sprint 2 audit found it showing as an unreadable/permission-broken file (`ls -la` → `-?????????`) — no agent touched it; likely the same class of WSL1/DrvFs filesystem quirk as DEC-001/DEC-008. Reinstall with `bash scripts/claude/install-kit.sh` if it's actually broken, before the next unattended `tmux ... autopilot.sh` run.
2. **Work through the QA backlog** — 8 stories (US-004..US-011) are Awaiting QA with nothing blocking them; `HANDOVER.md`'s "Waiting on the user" section lists each checklist and exactly what's manual (a few need live Neon/bvb.ro checks, most are quick). Commit as you go — agents never run git, so uncommitted work keeps piling up.
3. Sprint 3 (US-012..US-015, cron + persistence) is being detailed and delivered now; the autopilot keeps going on its own and will next stop for Sprint 1's live infra steps (Neon + Vercel account, env vars, migrate, seed, deploy — US-006) or a genuine product decision, whichever comes first.

## Story board

| Story | Title | State |
|---|---|---|
| US-001 | Spike: PDF text extraction | Done — QA'd and committed by the user |
| US-002 | Project scaffold | Done — QA'd and committed by the user |
| US-003 | Database schema and Drizzle/Neon setup | Done — QA'd and committed by the user |
| US-004 | Bilingual (RO/EN) infrastructure | Awaiting QA — round 1 PASS/PASS |
| US-005 | Seed ETF registry and field catalogue | Awaiting QA — round 1 PASS/PASS |
| US-006 | Deploy to Vercel with health check | Awaiting QA — round 1 PASS/PASS (needs live Neon/Vercel setup) |
| US-007 | Report discovery: find the latest report link on a BVB instrument page | Awaiting QA — round 1 PASS/PASS |
| US-008 | PDF download and text extraction service | Awaiting QA — round 2 PASS/PASS (round 1 review FAIL, fixed) |
| US-009 | Adapter interface and registry | Awaiting QA — round 1 PASS/PASS |
| US-010 | BRD depositary adapter | Awaiting QA — round 1 PASS/PASS |
| US-011 | Test fixtures: committed sample reports and adapter unit tests | Awaiting QA — round 1 PASS/PASS |
| US-012 | Ingestion pipeline: discover → download → extract → persist, per ETF | Ready |
| US-013 | Daily cron endpoint and Vercel Cron configuration | Blocked — depends on US-012 |
| US-014 | Missing report, parse failure, and no-adapter handling | Blocked — depends on US-012 |
| US-015 | Job run logging | Blocked — depends on US-013, US-014 |

## Notes for whoever picks this up next

- If you are a coding agent (Claude Code, GitHub Copilot), start with `AGENTS.md` / `CLAUDE.md` at the repo root and `dev_minions/HANDOVER.md`, not this file's older per-story wording below — `HANDOVER.md` and `automation/AUTOMATION.md` are the live operating instructions under DEC-005/DEC-009.
- The local `etf-monitor2` folder is not yet a git repository connected to the GitHub repo of the same name; the user handles all git themselves — no chat or agent here runs git (see the Open decisions note above about disclosing denied attempts).
- Root-level `README.md` and `etf-monitoring-requirements.md` are earlier drafts. US-002 replaces the README; the current requirements live under `dev_minions/requirements/`.
- Test execution cannot rely on live bvb.ro access as a hard dependency, though several stories (US-007, US-011) did successfully use live access when it happened to be reachable in-session. Extraction *tests* still run against committed fixtures (`test/fixtures/`); live checks (BVB, Neon, Vercel) are the user's manual step.
- **The dev machine is WSL1, permanently.** Any tool that fails with `Exec format error` should be checked against DEC-001 before assuming a new problem.
- **The dev machine is behind a corporate TLS-inspecting proxy (Zscaler).** Any Node/npm/pnpm cert error should be checked against DEC-002 first.
- **If a `PATH` change doesn't seem to "stick" across terminals**, check `~/.profile` first — see DEC-003.
- **Process, as of 2026-09-24**: three standing chats (PO/Technical Lead/Troubleshoot) for planning, escalations, decisions and sprint audits (DEC-004); Claude Code + subagents for the actual delivery loop, continuous across sprints with an in-loop `tech-lead` subagent (DEC-005/DEC-009), hardened against usage-limit and network-outage interruptions (DEC-011); Copilot as fallback.
- **Number display format (DEC-007)**: whoever builds the shared number-display component (deferred by US-004) must apply no thousands separator in either locale, decimal mark only — comma for RO, dot for EN (`useGrouping: false`).
- **Sprint 3 binding note (from DEC-010)**: US-012's ingestion pipeline must write a report and its values in a single Neon HTTP-driver call, not two independent ones — a split write risks a report row with no values on a mid-write failure.
