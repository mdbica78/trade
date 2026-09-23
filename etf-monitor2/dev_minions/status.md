# Status

*Last updated: 2026-09-23 (PO sync — see note at bottom on why this was out of date)*

## Current phase

Sprint 1 in progress. **US-001 and US-002 are Done** (QA'd and committed by the user). **US-003 and US-004 are Ready.** **Autopilot (DEC-009) installed:** Claude Code now runs continuously across sprints (`scripts/claude/autopilot.sh`), details new sprints from the roadmap itself, validates technical decisions through an in-loop `tech-lead` subagent, and stops only when nothing is left it can do without the user. When it stops, it writes a demo file (`verification/DEMO-*.md`).

## Done

- Functional requirements defined and validated with the user — `requirements/etf-monitoring-requirements.md`.
- Confirmed live on bvb.ro that report formats differ between issuers: BTBETRETF / TVBETETF / PTENGETF share the BRD depositary format with direct PDF links; ICBETNETF uses a different format and a submit-button download whose mechanism is still unknown.
- Hosting direction chosen: new Vercel project (Hobby) + Vercel Cron (once daily) + Neon Postgres (free tier).
- Working process defined — `process.md`, with role briefs in `roles/`.
- Backlog defined — 7 epics (`backlog/epics.md`), 7 sprints (`backlog/roadmap.md`), Sprint 1 fully detailed (6 stories, US-001…US-006).
- Data model specified — `architecture/data-model.md`.
- **ADR-001 (tech stack) — Decided**, including the PDF library choice (`unpdf`, resolved by US-001 — see below). See `architecture/ADR-001-tech-stack.md`.
- **DEC-001**: pinned to Node.js 22 LTS (not 24) — WSL1 constraint. See `decisions/DEC-001-node-22-wsl1.md`.
- **DEC-002**: corporate TLS-inspecting proxy (Zscaler) — `NODE_EXTRA_CA_CERTS` + npm `cafile` required. See `decisions/DEC-002-corporate-tls-proxy.md`.
- **DEC-003**: `~/.profile` was silently reverting nvm's PATH on every login shell; fixed by reordering so `.bashrc` sourcing runs last. See `decisions/DEC-003-profile-path-override.md`.
- **DEC-004 (three standing chats: PO/Technical Lead/Troubleshoot)** — Decided, then **amended** by DEC-005 for the per-story loop specifically (see next line). The three-chat structure itself stands for planning, escalations, decisions, and sprint audits.
- **DEC-005 (Claude Code as implementer and orchestrator) — Decided**, requested by the user, validated by the Technical Lead. For routine stories: Claude Code (local) implements from `AGENTS.md` via the `deliver-story` skill and can run unattended (`/goal`); independent verification is done by fresh-context subagents `story-reviewer` and `story-tester` (replacing the per-story Technical Lead/Troubleshoot review from DEC-004). The Technical Lead and Troubleshoot chats leave the per-story loop and instead handle escalations (`escalations/`), PROPOSED decisions, and one verification audit per sprint. GitHub Copilot remains the documented fallback if the Claude Code usage budget runs out — see `automation/AUTOMATION.md` and `HANDOVER.md`. See `decisions/DEC-005-claude-code-automation.md`.
- **US-001 (Spike: PDF text extraction) — Done.** Both `story-reviewer` and `story-tester` PASSed round 1, unanimous, no fix loop needed. Result: all three BRD-format fixtures are vector-text (no OCR needed); recommended library `unpdf` (now reflected in ADR-001); two extraction traps documented for the future adapter (VUAN's value sits well before its own label; the footer report-date is one day behind an unrelated filing-stamp date). QA'd and committed by the user. See `spikes/pdf-extraction/FINDINGS.md` and `verification/US-001-{review,tests,qa}.md`.
- **US-002 (Project scaffold) — Done.** Both `story-reviewer` and `story-tester` PASSed round 1. Next.js App Router + TypeScript + Tailwind + Vitest + pnpm scaffolded, all 7 acceptance criteria green. Two environment fixes logged as DEC-008 (Turbopack crashes on this WSL1/DrvFs mount — build/dev scripts use `--webpack`; `NODE_EXTRA_CA_CERTS` needs explicit export per non-interactive WSL command). QA'd and committed by the user. See `verification/US-002-{plan,review,tests,qa}.md` and `decisions/DEC-008-turbopack-wsl1-drvfs.md`.
- **DEC-006**: Technical Lead moved from a chat-only, no-file-access advisory role to a persistent, file-access role. See `decisions/DEC-006-technical-lead-file-access.md`.
- **DEC-007**: Number display format — no thousands separator in either locale, decimal mark only (comma for RO, dot for EN). Requested and confirmed by the user directly. See `decisions/DEC-007-number-display-format.md`.
- **DEC-008**: local `dev`/`build` use webpack, not Turbopack (Turbopack's cache crashes on this WSL1/DrvFs mount); `NODE_EXTRA_CA_CERTS` must be exported in non-interactive WSL shells. Logged by Claude Code during US-002. See `decisions/DEC-008-turbopack-wsl1-drvfs.md`.
- **DEC-009 (autopilot) — Decided**, requested by the user. Continuous multi-sprint delivery; agent-detailed sprints (`story-planner`) reviewed by an in-loop `tech-lead` subagent (opus), which also validates technical decisions, triages escalations and audits each sprint; product/scope/cost/credential decisions still go to the user; stop only when nothing is eligible without the user, with a consolidated demo file; Done recorded from the user's `[x]` in the demo file. Amends DEC-005 and DEC-006. See `decisions/DEC-009-autopilot-multi-sprint.md`.

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
| Claude Code (automation) | Installed and running — used WSL1 "Ubuntu" (Node v20.20.2, pnpm 12.5.1); this Windows machine has no Node.js on the Windows side |

## Open decisions

- None blocking right now. ADR-001, DEC-005 … DEC-009 are all Decided. DEC-004 stands, amended by DEC-005 and DEC-009 for the delivery loop.

## Next step

1. **Install the kit once, then start the autopilot** (WSL): `cd /mnt/c/_mystaff/myG/trade/etf-monitor2 && bash scripts/claude/install-kit.sh && tmux new -s etf 'bash scripts/claude/autopilot.sh'`. It picks US-003/US-004 first, then US-005/US-006, then details Sprint 2 and carries on. See `automation/AUTOMATION.md`.
2. Expected first stop: Sprint 1's live steps (create Neon + Vercel, set env vars, migrate/seed, deploy — US-006), unless a product decision comes up earlier. Everything that doesn't depend on those keeps going with mocks until then.

## Story board

| Story | Title | State |
|---|---|---|
| US-001 | Spike: PDF text extraction | Done — QA'd and committed by the user |
| US-002 | Project scaffold | Done — QA'd and committed by the user |
| US-003 | Database schema and Drizzle/Neon setup | Done — QA'd and committed by the user |
| US-004 | Bilingual (RO/EN) infrastructure | Awaiting QA — round 1 PASS/PASS |
| US-005 | Seed ETF registry and field catalogue | Awaiting QA — round 1 PASS/PASS |
| US-006 | Deploy to Vercel with health check | Awaiting QA — round 1 PASS/PASS |
| US-007 | Report discovery: find the latest report link on a BVB instrument page | Awaiting QA — round 1 PASS/PASS |
| US-008 | PDF download and text extraction service | Ready — US-002 Done |
| US-009 | Adapter interface and registry | Ready — US-005 Awaiting QA |
| US-010 | BRD depositary adapter | Blocked — depends on US-009 |
| US-011 | Test fixtures: committed sample reports and adapter unit tests | Blocked — depends on US-007, US-008, US-010 |

## Notes for whoever picks this up next

- If you are a coding agent (Claude Code, GitHub Copilot), start with `AGENTS.md` / `CLAUDE.md` at the repo root and `dev_minions/HANDOVER.md`, not this file's older per-story wording below — `HANDOVER.md` and `automation/AUTOMATION.md` are the live operating instructions under DEC-005.
- The local `etf-monitor2` folder is not yet a git repository connected to the GitHub repo of the same name; the user handles all git themselves — no chat or agent here runs git.
- Root-level `README.md` and `etf-monitoring-requirements.md` are earlier drafts. US-002 replaces the README; the current requirements live under `dev_minions/requirements/`.
- Test execution cannot rely on live bvb.ro access. All extraction testing uses committed fixtures (`test/fixtures/`); live checks (BVB, Neon, Vercel) are the user's manual step.
- **The dev machine is WSL1, permanently** (confirmed by the user, cannot be changed). Any tool that fails with `Exec format error` should be checked against DEC-001's root cause before assuming a new problem.
- **The dev machine is behind a corporate TLS-inspecting proxy (Zscaler).** Any Node/npm/pnpm tool that fails with a certificate error should be checked against DEC-002 before assuming a new problem.
- **If a `PATH` change doesn't seem to "stick" across terminals**, check `~/.profile` first — see DEC-003.
- **Process, 2026-09-23**: three standing chats (PO/Technical Lead/Troubleshoot) for planning, escalations, decisions and sprint audits (DEC-004); Claude Code + subagents for the actual delivery loop (DEC-005), now continuous across sprints with an in-loop `tech-lead` subagent (DEC-009); Copilot as fallback (one story at a time, stops for any decision).
- **Number display format (DEC-007)**: whoever builds the shared number-display component (deferred by US-004, "belongs with the stories that render numbers") must apply no thousands separator in either locale, decimal mark only — comma for RO, dot for EN (`useGrouping: false`). See `decisions/DEC-007-number-display-format.md`. Not yet reflected in `requirements/etf-monitoring-requirements.md` — PO to fold in when convenient (Technical Lead doesn't edit `requirements/`).

---

*Why this file was out of date when the PO chat last checked: the automation kit install (DEC-005) and ADR-001's acceptance both happened without this file's "Current phase" / "Done" / "Open decisions" sections being updated — only the Story board row for US-001 was touched, correctly, since under DEC-005 rule 5 agents may only update the status of the story they deliver; planning sections stay with the PO. This sync closes that gap.*
