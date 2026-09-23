# DEC-001 — Pin project to Node.js 22 LTS (not 24)

**Date:** 2026-09-22
**Status:** Decided

## Context

During Sprint 1 environment setup, `nvm install 24` produced a working download (checksum matched, correct x86_64 architecture) but the resulting `node` binary failed to execute at all (`Exec format error`).

## Investigation

- Confirmed architecture was correct (`uname -m` → `x86_64`).
- Confirmed the environment is **WSL1**, not WSL2 (`cat /proc/version` showed no `WSL2` kernel signature — classic WSL1 signature), and confirmed with the user this **cannot be changed** (device/organizational restriction).
- Root cause identified: Node.js binaries from v23/v24 onward are post-processed with LLVM BOLT, producing ELF program headers with non-standard alignment that WSL1's stricter ELF parser rejects. This is a documented, WSL1-specific issue (not particular to this machine) — see [microsoft/WSL#12359](https://github.com/microsoft/WSL/issues/12359).

## Decision

The project targets **Node.js 22 LTS** everywhere the user develops locally. Node 22 predates the incompatible binary post-processing, remains an officially supported LTS line, and satisfies Next.js 16's minimum requirement (20.9+).

## Consequences

- `ADR-001-tech-stack.md` updated to record this as a hard local-environment constraint.
- Applies only to the local WSL1 dev machine — Vercel (Linux, not WSL) and any future CI (e.g. GitHub Actions) are unaffected and could use a newer Node version if ever needed there.
- If a future story needs a Node feature that only exists in 23+, that is a reason to revisit this decision with the user, not to silently upgrade.
