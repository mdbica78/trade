# DEC-008 — Use webpack, not Turbopack, for local `dev`/`build` on this machine

**Date:** 2026-09-23
**Status:** Decided

## Context

US-002 scaffolded the Next.js 16 app. Next.js 16 defaults `next dev` and `next build`
to Turbopack. Both failed identically on this machine:

```
Error: Failed to open database
Caused by:
  0: Creating and initializing persistence directory failed
  1: Failed to sync database directory after updating CURRENT
  2: failed to sync file `.../.next/.../turbopack/...`: Invalid argument (os error 22)
```

## Investigation

Turbopack's persistent cache (both `dev` and `build`) needs to `fsync` its cache
directory. The project folder is mounted from Windows into WSL1 via DrvFs
(`/mnt/c/...`), which does not support the fsync semantics Turbopack's cache store
needs — same family of problem as DEC-001 (WSL1 is permanent on this machine, not
upgradable to WSL2 for this project). Confirmed reproducible on both `next dev` and
`next build` before any project code was touched; not caused by anything in `app/`.

## Decision

`package.json`'s `dev` and `build` scripts explicitly pass `--webpack`:
```
"dev": "next dev --webpack",
"build": "next build --webpack",
```
This is a local-machine workaround, not a stack decision — it does not change
ADR-001. Vercel's own build environment does not sit on DrvFs and is unaffected;
if it ever also needs this flag, that would be a separate, new finding.

## Consequences

- Any future `next dev`/`next build` invocation bypassing the `pnpm` scripts (e.g. a
  one-off `npx next build`) must add `--webpack` manually on this machine or it will
  fail with the error above.
- If this project is ever developed from a WSL2 or native Linux filesystem path
  instead of `/mnt/c/...`, Turbopack should work natively — this workaround could be
  revisited then.
- Related: while investigating, `next build`/`next dev` also failed with
  `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` (fetching Google Fonts) unless
  `NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt` was explicitly exported in
  the shell — `/etc/environment`'s copy of this var (set per DEC-002) is not picked
  up by a non-interactive `wsl.exe -e bash -lc '...'` invocation from outside WSL,
  only by an actual interactive/login WSL session. Any agent driving WSL commands
  from a Windows-side shell must export it explicitly each time.
