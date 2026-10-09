# DEC-003 — `.profile` was overwriting nvm's PATH on every login shell

**Date:** 2026-09-23
**Status:** Decided / Fixed

## Context

After DEC-001 (Node 22 via nvm) and DEC-002 (Zscaler certs) were both fixed and verified, `node -v` kept reverting to the system Node (`v20.20.2`) in brand-new terminals and — critically — even after a full WSL restart, on **both** the root and the regular (`bicajanm`) accounts. `nvm current` reported `system`.

## Investigation

- Confirmed `~/.bashrc` was correct: it sources `nvm.sh` and then calls `nvm use default`, and running `source ~/.bashrc` manually always activated Node 22 correctly (`nvm current` → `v22.23.2` immediately, alias file `~/.nvm/alias/default` correctly set to `22`).
- Confirmed the terminal opens a **login shell** (`shopt login_shell` → `on`), so `~/.profile` runs, which in turn sources `~/.bashrc`.
- Removed the `> /dev/null 2>&1` redirect from the `nvm use default` line in `.bashrc` to see it live: a brand-new terminal printed `Now using node v22.23.2 (npm v10.9.8)` at startup — proving `.bashrc` *did* run and *did* activate Node 22 — but a `node -v` typed immediately after, in that same shell, still showed `v20.20.2`.
- Root cause found in `~/.profile` (identical structure on both accounts): it sources `~/.bashrc` **first**, but then, later in the same file, does a hardcoded `export PATH=/home/<user>/go/bin:/usr/local/go/bin:...:/usr/bin:/sbin:/bin:...:/mnt/c/Windows/system32:...` (added earlier for Windows/WSL interop — access to `go`, Windows executables, etc.). That fixed list does **not** include nvm's per-version `bin` directory (`~/.nvm/versions/node/v22.23.2/bin`), so this line silently threw away everything `nvm use default` had just prepended onto `PATH` inside `.bashrc`, reverting effectively to the system `node`/`npm` found on the hardcoded `PATH`. It also meant `$HOME/bin` and `$HOME/.local/bin` (added conditionally earlier in `.profile`, before the hardcoded export) were being wiped the same way, though that had gone unnoticed.

## Decision

Reordered `~/.profile` on both accounts so nothing runs after the `.bashrc` sourcing: the hardcoded Windows-interop `PATH` export and the `$HOME/bin` / `$HOME/.local/bin` conditionals now run first, and `. ~/.bashrc` (which activates nvm's default Node version) runs **last**, so its `PATH` changes are never overwritten. Backups of the original files were kept as `~/.profile.bak` on both accounts before editing. A harmless duplicate `nvm use default` line left in root's `.bashrc` from an earlier fix attempt was also cleaned up.

Confirmed, from genuinely fresh terminals on both accounts (and surviving a full WSL restart): `node -v` → `v22.23.2`, `nvm current` → `v22.23.2`, `pnpm -v` → `12.5.1`.

## Consequences

- Any future "my PATH change isn't sticking" surprise on this machine should check `~/.profile` for something running *after* the `.bashrc` sourcing line, before assuming a new problem — this exact shape (a late hardcoded `export PATH=...` for Windows interop) is very likely to recur if `.profile` is ever regenerated or re-templated (e.g., a fresh WSL distro re-import).
- This is a per-account, local-machine-only file; it has no equivalent on Vercel or in CI.
- Local environment setup (DEC-001 + DEC-002 + this fix) is now considered fully done and verified on both `root` and the regular account, persistent across fresh terminals and a full WSL restart.
