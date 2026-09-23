# Status

*Last updated: 2026-09-23*

## Current phase

Planning complete. ADR-001 still **PROPOSED**. Local environment fully set up and verified on both accounts (root and the user's normal account), persistent across fresh terminals and a full WSL restart. Sprint 1 ready to start — but see "Next step" below: the process itself just changed and is waiting on the Technical Lead's sign-off before delivery resumes.

## Done

- Functional requirements defined and validated with the user — `requirements/etf-monitoring-requirements.md`.
- Confirmed live on bvb.ro that report formats differ between issuers: BTBETRETF / TVBETETF / PTENGETF share the BRD depositary format with direct PDF links; ICBETNETF uses a different format and a submit-button download whose mechanism is still unknown.
- Hosting direction chosen: new Vercel project (Hobby) + Vercel Cron (once daily) + Neon Postgres (free tier).
- Working process defined — `process.md`, with role briefs in `roles/`.
- Backlog defined — 7 epics (`backlog/epics.md`), 7 sprints (`backlog/roadmap.md`), Sprint 1 fully detailed (6 stories, US-001…US-006).
- Data model specified — `architecture/data-model.md`.
- **ADR-001 (tech stack) — still PROPOSED**, not yet accepted (see Open decisions below; earlier notes calling it "ACCEPTED" were premature).
- **DEC-001**: pinned to Node.js 22 LTS (not 24) — WSL1 constraint. See `decisions/DEC-001-node-22-wsl1.md`.
- **DEC-002**: corporate TLS-inspecting proxy (Zscaler) — `NODE_EXTRA_CA_CERTS` + npm `cafile` required. See `decisions/DEC-002-corporate-tls-proxy.md`.
- **DEC-003**: `~/.profile` was silently reverting nvm's PATH on every login shell; fixed by reordering so `.bashrc` sourcing runs last. See `decisions/DEC-003-profile-path-override.md`.
- **DEC-004 (process restructuring) — drafted, PROPOSED.** The project now runs as three standing chats — PO (this chat), Technical Lead, Troubleshoot — replacing the original single-Coordinator + ephemeral-coworkers model. `process.md`, `roles/` (new `technical-lead.md` and `troubleshoot.md`, old `code-reviewer.md`/`test-runner.md` kept with a superseded notice), `README.md`, and a new `verification/` folder (for per-story verdict files) have all been updated to match. See `decisions/DEC-004-three-chat-structure.md`.

## Local environment setup — done

| Tool | Status |
|---|---|
| nvm | Installed on both accounts (root and the user's normal account) |
| Node.js 22 LTS | Confirmed (`v22.23.2`) on both accounts, persistent across fresh terminals and a full WSL restart |
| pnpm | Confirmed (`12.5.1`) on both accounts |
| git | OK (2.43.0) — commit author identity noted as unrelated to push auth (user authenticates via manual username+token) |
| gh CLI | Skipped — user authenticates git push/pull manually with username+token, doesn't need gh |
| VS Code ↔ WSL | Not yet confirmed — `code --version` was not found in WSL PATH; fix given (`code .` from WSL after installing the WSL extension), not yet verified |
| Local repo ↔ GitHub | Not yet done — `etf-monitor2` locally is not yet `git init`'d / connected to the existing GitHub repo |

## Open decisions

- **DEC-004 (this restructuring)** — PROPOSED. Waiting on the user to relay it to the Technical Lead chat for sign-off.
- **ADR-001 (tech stack)** — PROPOSED. Sprint 1 stories US-002 onward stay blocked until it's confirmed. Whether Technical Lead sign-off on ADR-001 happens together with DEC-004 or separately is the user's call.

## Next step

**Paused for Technical Lead sign-off** on the updated process (DEC-004) — the user is relaying it to that chat now. Once confirmed (and ADR-001 is resolved one way or another), resume with: connect the local folder to git/GitHub (commands already prepared), then **US-001** — the PDF extraction spike, deliberately first, before any scaffold, because if the depositary PDFs don't yield extractable text the whole extraction approach changes.

## Story board

| Story | Title | State |
|---|---|---|
| US-001 | Spike: PDF text extraction | Ready — can start as soon as the repo is connected to git (independent of ADR-001) |
| US-002 | Project scaffold | Blocked — ADR-001 not yet confirmed |
| US-003 | Database schema and Drizzle/Neon setup | Blocked — US-002 |
| US-004 | Bilingual (RO/EN) infrastructure | Blocked — US-002 |
| US-005 | Seed ETF registry and field catalogue | Blocked — US-003 |
| US-006 | Deploy to Vercel with health check | Blocked — US-003 |

## Notes for whoever picks this up next

- The local `etf-monitor2` folder is not yet a git repository connected to the GitHub repo of the same name. The user runs `git init` / `git remote add` / the first commit themselves — no chat here has shell access to their machine.
- Root-level `README.md` and `etf-monitoring-requirements.md` are earlier drafts. US-002 replaces the README; the current requirements live under `dev_minions/requirements/`.
- Test execution (now Troubleshoot's job) cannot reach bvb.ro. All extraction testing uses committed fixtures; live checks are the user's manual step.
- **The dev machine is WSL1, permanently** (not a temporary state — confirmed by the user, cannot be changed). Any tool that fails with `Exec format error` should be checked against DEC-001's root cause before assuming a new problem.
- **The dev machine is behind a corporate TLS-inspecting proxy (Zscaler).** Any Node/npm/pnpm tool that fails with a certificate error (`UNABLE_TO_GET_ISSUER_CERT_LOCALLY` or similar) should be checked against DEC-002 before assuming a new problem.
- **If a `PATH` change (nvm, a new tool install, etc.) doesn't seem to "stick" across terminals**, check `~/.profile` first (on both accounts) for anything running after the `.bashrc` sourcing line — see DEC-003. This exact bug already cost significant back-and-forth once; it's very likely to resurface if `.profile` is ever regenerated.
- **Process changed 2026-09-23**: this project now runs as three standing chats (PO, Technical Lead, Troubleshoot) instead of one Coordinator + ephemeral coworkers. If you are a chat opened fresh and unsure which role you are, check which of `roles/coordinator.md`, `roles/technical-lead.md`, `roles/troubleshoot.md` matches what the user is asking of you.
