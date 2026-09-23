# Status

*Last updated: 2026-09-23 (PO sync — see note at bottom on why this was out of date)*

## Current phase

Planning complete. **ADR-001 (tech stack) Decided.** **DEC-005 (Claude Code as implementer/orchestrator) Decided** — automation kit installed and running. US-001 delivered by the automation and **Awaiting QA** (both independent gates PASS). US-002 is now unblocked (ADR-001 accepted) and eligible to start once the automation is run again or the user asks for it.

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
- **US-001 (Spike: PDF text extraction) — delivered, Awaiting QA.** Both `story-reviewer` and `story-tester` PASSed round 1, unanimous, no fix loop needed. Result: all three BRD-format fixtures are vector-text (no OCR needed); recommended library `unpdf` (now reflected in ADR-001); two extraction traps documented for the future adapter (VUAN's value sits well before its own label; the footer report-date is one day behind an unrelated filing-stamp date). See `spikes/pdf-extraction/FINDINGS.md` and `verification/US-001-{review,tests,qa}.md`.
- **DEC-006**: Technical Lead moved from a chat-only, no-file-access advisory role to a persistent, file-access role. See `decisions/DEC-006-technical-lead-file-access.md`.
- **DEC-007**: Number display format — no thousands separator in either locale, decimal mark only (comma for RO, dot for EN). Requested and confirmed by the user directly. See `decisions/DEC-007-number-display-format.md`.

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

- None blocking right now. ADR-001 and DEC-005 are both Decided. DEC-004 stands, amended by DEC-005 for the per-story loop.

## Next step

1. **User QA on US-001** — run through `verification/US-001-qa.md`, then `git add`/commit the listed files (note: `.gitignore` was added at repo root for `node_modules/`/`.next/`/`.env*` — check `git status` before adding). Tell the PO chat once done so the story can be marked Done here.
2. **US-002 (Project scaffold)** is now eligible (ADR-001 accepted). Next automation run (`/deliver-story` or `/goal`) will pick it up, or ask the PO chat if you want a ticket prepared for Copilot instead.

## Story board

| Story | Title | State |
|---|---|---|
| US-001 | Spike: PDF text extraction | Awaiting QA — both gates PASS, see `verification/US-001-qa.md` |
| US-002 | Project scaffold | Awaiting QA — both gates PASS, see `verification/US-002-qa.md` |
| US-003 | Database schema and Drizzle/Neon setup | Blocked — US-002 |
| US-004 | Bilingual (RO/EN) infrastructure | Blocked — US-002 |
| US-005 | Seed ETF registry and field catalogue | Blocked — US-003 |
| US-006 | Deploy to Vercel with health check | Blocked — US-003 |

## Notes for whoever picks this up next

- If you are a coding agent (Claude Code, GitHub Copilot), start with `AGENTS.md` / `CLAUDE.md` at the repo root and `dev_minions/HANDOVER.md`, not this file's older per-story wording below — `HANDOVER.md` and `automation/AUTOMATION.md` are the live operating instructions under DEC-005.
- The local `etf-monitor2` folder is not yet a git repository connected to the GitHub repo of the same name; the user handles all git themselves — no chat or agent here runs git.
- Root-level `README.md` and `etf-monitoring-requirements.md` are earlier drafts. US-002 replaces the README; the current requirements live under `dev_minions/requirements/`.
- Test execution cannot rely on live bvb.ro access. All extraction testing uses committed fixtures (`test/fixtures/`); live checks (BVB, Neon, Vercel) are the user's manual step.
- **The dev machine is WSL1, permanently** (confirmed by the user, cannot be changed). Any tool that fails with `Exec format error` should be checked against DEC-001's root cause before assuming a new problem.
- **The dev machine is behind a corporate TLS-inspecting proxy (Zscaler).** Any Node/npm/pnpm tool that fails with a certificate error should be checked against DEC-002 before assuming a new problem.
- **If a `PATH` change doesn't seem to "stick" across terminals**, check `~/.profile` first — see DEC-003.
- **Process, 2026-09-23**: three standing chats (PO/Technical Lead/Troubleshoot) for planning, escalations, decisions and sprint audits (DEC-004); Claude Code + subagents for the actual per-story delivery loop (DEC-005), with Copilot as fallback.
- **Number display format (DEC-007)**: whoever builds the shared number-display component (deferred by US-004, "belongs with the stories that render numbers") must apply no thousands separator in either locale, decimal mark only — comma for RO, dot for EN (`useGrouping: false`). See `decisions/DEC-007-number-display-format.md`. Not yet reflected in `requirements/etf-monitoring-requirements.md` — PO to fold in when convenient (Technical Lead doesn't edit `requirements/`).

---

*Why this file was out of date when the PO chat last checked: the automation kit install (DEC-005) and ADR-001's acceptance both happened without this file's "Current phase" / "Done" / "Open decisions" sections being updated — only the Story board row for US-001 was touched, correctly, since under DEC-005 rule 5 agents may only update the status of the story they deliver; planning sections stay with the PO. This sync closes that gap.*
