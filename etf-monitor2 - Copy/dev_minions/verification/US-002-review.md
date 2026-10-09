# US-002 review — Project scaffold

## Round 1 — 2026-09-23

**Verdict: PASS**

Reviewer: story-reviewer (independent, fresh context). Commands were actually executed
(via `wsl.exe -d Ubuntu -e bash -lc '...'`, `NODE_EXTRA_CA_CERTS` exported per DEC-008),
not just read.

### Acceptance criteria

**AC1 — `pnpm install && pnpm dev` starts the app and the default page renders without errors.**
MET. `pnpm install --frozen-lockfile` → lockfile up to date, no errors. Started
`pnpm dev --port 3411`; log shows `✓ Ready in 1742ms`, `GET / 200 in 3.3s`, no
error/warning lines. `curl -s -o /tmp/body.html -w "HTTP %{http_code}"` → `HTTP 200`;
body contains the default create-next-app `<title>Create Next App</title>` markup,
consistent with the story's "no UI design work beyond whatever the scaffold generates"
(US-002.md line 52). Evidence: `app/layout.tsx`, `app/page.tsx` (untouched
create-next-app output).

**AC2 — `pnpm test` runs Vitest and reports at least one passing test.**
MET. `pnpm test` → `vitest run`: `✓ lib/format.test.ts (1 test)`, `Test Files 1 passed
(1)`, `Tests 1 passed (1)`. Test: `lib/format.test.ts:5-7` asserts
`formatNumber(415591664.2) === "415591664.20"` against `lib/format.ts:3-5`. Trivial but
real (not a stub `expect(true).toBe(true)`), and explicitly documented as a placeholder
for the future DEC-007 formatter (`lib/format.ts:1-2`) rather than pretending to be it —
correct scope discipline.

**AC3 — `pnpm lint` completes with no errors.**
MET. `pnpm lint` → `eslint` exits 0, no output (no warnings/errors).
`eslint.config.mjs` extends `eslint-config-next/core-web-vitals` +
`eslint-config-next/typescript`, no rules disabled/weakened.

**AC4 — `pnpm build` completes successfully.**
MET. `pnpm build` → `next build --webpack`: "Compiled successfully in 3.0s", TypeScript
finished, 4 static routes generated (`/`, `/_not-found`), no errors. (First attempt hit
a stale `.next/lock` from an in-flight background build triggered by an earlier command
in this same review session — not a code defect; removing the lock and retrying built
cleanly.) `package.json:7` (`"build": "next build --webpack"`) matches DEC-008's
documented workaround for Turbopack/WSL1-DrvFs fsync failures, which is recorded as
pre-existing and reproducible on a bare scaffold, not caused by this story's code.

**AC5 — All folders listed above exist (empty ones with a `.gitkeep`).**
MET. Confirmed via directory listing: `app/`, `lib/db/.gitkeep`, `lib/extraction/.gitkeep`,
`components/.gitkeep`, `messages/.gitkeep`, `test/fixtures/{BTBETRETF,PTENGETF,TVBETETF}-2026-09-21.pdf`
(the US-001 fixtures, moved into place as the plan said). Matches the story's literal
tree (US-002.md lines 18-27), including the singular `test/fixtures/` naming — AGENTS.md
says `tests/fixtures/` (plural) but AGENTS.md itself states `dev_minions/` wins on
conflict, and the story (under `dev_minions/backlog/`) is explicit about `test/`
singular, so this is not a defect, just a Note for whoever reconciles the docs later.

**AC6 — `.env.example` exists and documents `DATABASE_URL` and `CRON_SECRET`; no real secret values are committed anywhere.**
MET. `.env.example:1-6` lists both variables, each preceded by a one-line comment, both
values empty. Repo-root file listing confirms `.env.example` is the *only* `.env*` file
present (no `.env`, `.env.local`, etc. committed or on disk). No secret-shaped strings
(`postgres://user:pass@...`, API keys) found anywhere in the tree.

**AC7 — Root `README.md` describes install/run/test and points to `dev_minions/`.**
MET. `README.md` has Install/Run/Test/Environment variables/Process documentation
sections, with explicit `pnpm install`, `pnpm dev`, `pnpm test`/`typecheck`/`lint`/`build`
commands and a link to `dev_minions/HANDOVER.md` and `dev_minions/status.md`
(README.md:14-49). Replaces the earlier placeholder as required.

### Non-negotiable rules (AGENTS.md) — scope check

- No DB/extraction/AI/cron code was added in this story (correctly out of scope); `lib/db/`
  and `lib/extraction/` are empty placeholders per the story.
- next-intl / i18n: correctly out of scope for this story (US-004); no UI strings were
  added beyond the unmodified create-next-app defaults.
- Secrets: none committed; see AC6.
- No test was weakened or skipped to pass.
- Scope: file-by-file comparison of the working tree against HANDOVER.md's "Files
  changed" list found no undeclared changes. All new/untracked paths map onto that list;
  the handful of already-modified `dev_minions/*` files (status.md, README.md, role
  files, ADR-001) predate this story (kit install / US-001 / DEC-006/007 work) and are
  not claimed as this story's output, correctly.

### Findings

**Critical: none.**

**Warning — `.gitignore` doesn't fully cover `.env*` as the story literally asked.**
The story's task text says: "`.gitignore` covering `node_modules`, `.next`, `.env*`
(except `.env.example`), and build output" (US-002.md line 33). The actual
`.gitignore` (repo root) has only:
```
.env
.env.local
.env.*.local
!.env.example
```
This misses any future `.env.development`, `.env.production`, `.env.test`, `.env.staging`
etc. (no `.local` suffix) — none of those patterns match them. There is no such file in
the repo today, so AC6 ("no real secret values are committed anywhere") is still
literally true, and this isn't an AC by itself, but it's a real gap against the story's
explicit instruction and against AGENTS.md's "secrets only in environment variables...
never commit". Recommend replacing with a proper catch-all, e.g. `.env*` +
`!.env.example`, in whichever story next touches env handling (likely US-003).

**Warning — `.claude/settings.json` deny-rule narrowing compounds the same gap.**
The delegation prompt asked me to judge this explicitly. Before: `Read(./.env.*)`
(blocked reading any dotted env variant, including `.env.example` itself — which is why
it had to change to let the agent write `.env.example`). After:
`Read(./.env.local)` + `Read(./.env.*.local)`. This is narrower than necessary: it now
lets an agent `Read` a hypothetical `.env.production`/`.env.development`/`.env.test`
(no `.local` suffix) if one is ever created, which — per the `.gitignore` gap above —
would also not be excluded from a commit. Today there is no such file, so there is no
live secret exposure, and the change was made with the user's explicit, recorded
approval, so it isn't a rule violation. But the two gaps reinforce each other; recommend
tightening both together (e.g. enumerate every real Next.js env-file variant in the deny
list, or use a proper `.env*` catch-all in both places, keeping only `.env.example`
readable) before US-003 introduces a real `DATABASE_URL`.

**Note.** `test/fixtures/` (singular) vs. AGENTS.md's `tests/fixtures/` (plural) — not a
defect (story text wins per AGENTS.md's own precedence rule), just worth reconciling in
the docs so future stories don't have to re-derive which one is authoritative.

**Note.** `app/page.tsx`, `app/layout.tsx`, `public/*.svg` are unmodified
`create-next-app` output — correct, matches "no UI design work" out-of-scope line.
