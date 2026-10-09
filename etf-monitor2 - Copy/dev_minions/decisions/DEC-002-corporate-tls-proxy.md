# DEC-002 — Trust the corporate TLS proxy (Zscaler) in Node/npm

**Date:** 2026-09-23
**Status:** Decided

## Context

After fixing DEC-001 (Node 22), `corepack prepare pnpm@latest --activate` and `pnpm -v` both failed with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` when reaching `registry.npmjs.org`, even though `apt` and `curl` worked fine.

## Investigation

- `update-ca-certificates --fresh` output showed `zscaler-root.pem` already present in the system trust store — the machine sits behind a corporate TLS-inspecting proxy (Zscaler), which re-signs HTTPS traffic with its own root certificate. The OS already trusts it.
- Root cause: **Node.js does not use the OS certificate store by default.** It ships its own bundled CA list (Mozilla's) and ignores certificates added to the system store unless told to via `NODE_EXTRA_CA_CERTS` (or an equivalent per-tool setting). This is why `curl`/`apt` worked immediately while every Node-based tool (corepack, npm registry fetches) failed identically.
- `corepack prepare` continued to be unreliable even after setting `NODE_EXTRA_CA_CERTS` (the machine also has a separate Node 20.x installed via the NodeSource apt repo, alongside nvm's Node 22 — a second, likely contributing source of inconsistency). Rather than debug corepack's shim mechanism further, pnpm was installed directly via `npm install -g pnpm`, which is not a deviation from ADR-001 (that ADR fixed the tool, `pnpm`, not the install method).

## Decision

On this machine, both of the following are required and are now set **system-wide** (not just for one user — the Zscaler interception applies to all traffic regardless of which OS user is active):

1. `NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt` — in `/etc/environment` and in both root's and the regular user's `~/.bashrc`.
2. `npm config set cafile /etc/ssl/certs/ca-certificates.crt --location=global`.
3. pnpm is installed via `npm install -g pnpm`, not via `corepack prepare`.

Confirmed working under both the root account and the user's normal account: `pnpm -v` → `12.5.1`.

## Consequences

- Any future tool that talks HTTPS from inside Node (or npm/pnpm) and fails with a certificate error on this machine should be checked against this cause first: does it need `NODE_EXTRA_CA_CERTS` explicitly, rather than relying on the OS trust store.
- This is specific to the **local dev machine**. Vercel's build environment and any GitHub Actions runner are not behind this corporate proxy and do not need this workaround — do not carry `NODE_EXTRA_CA_CERTS` into deployment configuration.
- The coexistence of a NodeSource-installed Node 20.x (apt) and nvm-managed Node 22 on this machine is a latent source of confusion (which `node`/`npm` resolves first depends on `PATH` order). Not fixed now since nvm's version wins in the tested shells, but worth remembering if a "wrong version" surprise ever shows up.
