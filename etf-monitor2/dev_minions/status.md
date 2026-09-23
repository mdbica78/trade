# Status

*Last updated: 2026-09-23*

## Current phase

Planning complete. ADR-001 accepted. **Local environment fully set up and verified on both accounts (root and the user's normal account), persistent across fresh terminals and a full WSL restart.** Sprint 1 ready to start — next action is connecting the local folder to git/GitHub, then US-001.

## Done

- Functional requirements defined and validated with the user — `requirements/etf-monitoring-requirements.md`.
- Confirmed live on bvb.ro that report formats differ between issuers: BTBETRETF / TVBETETF / PTENGETF share the BRD depositary format with direct PDF links; ICBETNETF uses a different format and a submit-button download whose mechanism is still unknown.
- Hosting direction chosen: new Vercel project (Hobby) + Vercel Cron (once daily) + Neon Postgres (free tier).
- Working process defined — `process.md`, with role briefs in `roles/`.
- Backlog defined — 7 epics (`backlog/epics.md`), 7 sprints (`backlog/roadmap.md`), Sprint 1 fully detailed (6 stories, US-001…US-006).
- Data model specified — `architecture/data-model.md`.
- **ADR-001 (tech stack) ACCEPTED.** See `architecture/ADR-001-tech-stack.md`.
- **DEC-001**: pinned to Node.js 22 LTS (not 24) — the user's machine runs WSL1 (fixed constraint, cannot move to WSL2), and Node 23+ binaries fail to execute on WSL1 (confirmed, documented upstream issue: LLVM BOLT post-processing vs. WSL1's strict ELF parser). See `decisions/DEC-001-node-22-wsl1.md`.
- **DEC-002**: machine sits behind a corporate TLS-inspecting proxy (Zscaler). Node/npm don't use the OS certificate store by default, so `NODE_EXTRA_CA_CERTS` + `npm config set cafile` (both set system-wide) were required; pnpm installed via `npm install -g pnpm` rather than corepack. See `decisions/DEC-002-corporate-tls-proxy.md`.
- **DEC-003**: `~/.profile` on both accounts sourced `~/.bashrc` (which correctly activates Node 22 via `nvm use default`) but then, later in the same file, ran a hardcoded `export PATH=...` (added earlier for Windows/WSL interop) that didn't include nvm's bin directory — silently reverting every login shell back to the system Node. Fixed by reordering `.profile` so the `.bashrc` sourcing runs last on both accounts. This is why Node kept "reverting" even after DEC-001's fix looked confirmed. See `decisions/DEC-003-profile-path-override.md`.

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

## Next step

Connect the local folder to git/GitHub (commands already given to the user), then start **US-001** — the PDF extraction spike, deliberately first, before any scaffold, because if the depositary PDFs don't yield extractable text the whole extraction approach changes.

## Story board

| Story | Title | State |
|---|---|---|
| US-001 | Spike: PDF text extraction | Ready — can start as soon as the repo is connected to git |
| US-002 | Project scaffold | Ready (ADR-001 accepted) — blocked only on local env finishing |
| US-003 | Database schema and Drizzle/Neon setup | Blocked — US-002 |
| US-004 | Bilingual (RO/EN) infrastructure | Blocked — US-002 |
| US-005 | Seed ETF registry and field catalogue | Blocked — US-003 |
| US-006 | Deploy to Vercel with health check | Blocked — US-003 |

## Notes for whoever picks this up next

- The local `etf-monitor2` folder is not yet a git repository connected to the GitHub repo of the same name. The user runs `git init` / `git remote add` / the first commit themselves — this session has no shell access to their machine.
- Root-level `README.md` and `etf-monitoring-requirements.md` are earlier drafts. US-002 replaces the README; the current requirements live under `dev_minions/requirements/`.
- The cloud sandbox used by the verification coworkers cannot reach bvb.ro. All extraction testing uses committed fixtures; live checks are the user's manual step.
- **The dev machine is WSL1, permanently** (not a temporary state — confirmed by the user, cannot be changed). Any tool that fails with `Exec format error` should be checked against DEC-001's root cause before assuming a new problem.
- **The dev machine is behind a corporate TLS-inspecting proxy (Zscaler).** Any Node/npm/pnpm tool that fails with a certificate error (`UNABLE_TO_GET_ISSUER_CERT_LOCALLY` or similar) should be checked against DEC-002 before assuming a new problem.
- **If a `PATH` change (nvm, a new tool install, etc.) doesn't seem to "stick" across terminals**, check `~/.profile` first (on both accounts) for anything running after the `.bashrc` sourcing line — see DEC-003. This exact bug already cost significant back-and-forth once; it's very likely to resurface if `.profile` is ever regenerated.
