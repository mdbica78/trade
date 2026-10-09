# US-008 — Independent review

## Round 1 — 2026-09-23

Verdict: FAIL

Reviewer: `story-reviewer` subagent, fresh context. No git commands were run (per role brief).
Sources read: `dev_minions/backlog/stories/US-008.md`, `dev_minions/verification/US-008-plan.md`,
`dev_minions/HANDOVER.md` ("Files changed"), `AGENTS.md`, `dev_minions/roles/technical-lead.md`
(review checklist), `lib/extraction/pdf.ts`, `lib/extraction/pdf.test.ts`, `lib/extraction/http.ts`,
`lib/extraction/discovery.ts` (for the shared `BVB_REQUEST_HEADERS` identity check), `package.json`,
`pnpm-workspace.yaml`, `test/fixtures/*.pdf`. Ran `pnpm typecheck`, `pnpm lint`, `pnpm test`, and —
because AC6 requires it — `pnpm build`, plus `pnpm install --frozen-lockfile` (permitted as a
read/verify-only command; no source file was modified, only `node_modules`/`.next`, which are
build artifacts, and I restored `node_modules` to the same state I found it in afterwards).

### Acceptance criteria

- **AC1** — MET. `package.json:23` lists `"unpdf": "^0.11.0"` under `dependencies`. Neither
  `pdfjs-dist` nor `pdf-parse` appears anywhere in `dependencies` or `devDependencies`. Proven by
  `lib/extraction/pdf.test.ts:30-40` ("dependencies (AC1)"), which reads and parses the real
  `package.json`. Test passes.
- **AC2** — MET. `lib/extraction/pdf.test.ts:42-82` runs `extractPdfText` against all three
  committed fixtures (`BTBETRETF-2026-09-21.pdf`, `TVBETETF-2026-09-21.pdf`,
  `PTENGETF-2026-09-21.pdf`), asserts `ok: true`, and checks each of the five labels from the
  story individually (so a failure names the missing label), plus a no-`\n` guard for US-010's
  flattened-text contract. All 39 tests in the file pass, including these. Implementation:
  `lib/extraction/pdf.ts:72-88` (`extractPdfText`, `unpdf`'s `getDocumentProxy` +
  `extractText({ mergePages: true })`, exactly the spike-validated call).
- **AC3** — MET. `lib/extraction/pdf.test.ts:84-117` covers pseudo-random bytes, a real fixture
  truncated to 1024 bytes (the story's named case, not swapped for an easier one), a valid
  signature followed by garbage, and an empty `Uint8Array`; all assert `{ ok: false, kind:
  "unreadable" }` with a non-empty message and never throw (the function body is wrapped in
  try/catch, `lib/extraction/pdf.ts:73-87`). Passes.
- **AC4** — MET. `lib/extraction/pdf.test.ts:130-246` covers all six required cases (200+PDF →
  `ok:true` with exact bytes and `fetchedAt`; 404/500 → `http_error` + `httpStatus`; 200+HTML,
  even mislabelled `application/pdf` → `not_pdf`; PDF served as `application/octet-stream` →
  `ok:true` (header not trusted either way); empty 200 body → `not_pdf`; rejected promise →
  `network`; body-read rejection → `network`; slower than `timeoutMs` → `timeout`). One test
  quality gap, Warning-level (see Findings): not every case explicitly asserts
  `fetchImpl` was called exactly once, though the plan asked for that in every case, and it's true
  by construction because `fetchOnce` (`lib/extraction/http.ts`, already tested in US-007) never
  retries.
- **AC5** — MET. `beforeEach` stubs `globalThis.fetch` with a guard that throws if called
  (`lib/extraction/pdf.test.ts:133-137`); every `downloadReportPdf` call in the file either passes
  an injected `fetchImpl` or, in the one case that relies on the global (`"defaults fetchImpl to
  globalThis.fetch read at call time"`), re-stubs `fetch` with a mock, never a real network call.
  No real fetch/HTTP is made anywhere in the file; `extractPdfText` runs `unpdf` in-process on
  fixture bytes read from disk.
- **AC6** — NOT MET. `pnpm typecheck`, `pnpm lint`, `pnpm test` (143/143) and `pnpm build` all pass
  when run against an already-populated `node_modules`. But a genuinely clean install —
  `rm -rf node_modules && pnpm install --frozen-lockfile`, the exact command AGENTS.md's
  "Commands" section lists as the first of the authoritative set — hard-fails:
  ```
  Error: ERR_PNPM_IGNORED_BUILDS
    × installing dependencies
    ╰─▶ Ignored build scripts: canvas@2.11.2
    help: Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.
  ```
  exit code 1. `canvas` is a new transitive dependency pulled in by `unpdf` (added by this
  story) — it was not part of the dependency tree before US-008. See Findings #1 below for the
  root cause and why this is a real regression, not an environment artifact.

### Findings (ordered by severity)

1. **Critical — `pnpm install --frozen-lockfile` fails on a clean checkout, `pnpm-workspace.yaml`
   (root, `allowBuilds` block).** The file currently reads:
   ```yaml
   allowBuilds:
     '@parcel/watcher': true
     '@swc/core': true
     canvas: set this to true or false
     esbuild: true
     unrs-resolver: true
   ```
   `canvas: set this to true or false` is not a boolean — it is literal placeholder/instructional
   text, left unresolved. pnpm 12's `ERR_PNPM_IGNORED_BUILDS` gate treats an invalid value the same
   as "no decision made" and hard-fails the install (verified twice: once against the node_modules
   left on disk, once against a fully fresh `rm -rf node_modules && pnpm install --frozen-lockfile`
   — both fail with exit code 1). This directly breaks the first command in AGENTS.md's "Commands"
   list and would break CI or any other machine cloning the repo fresh (including, plausibly, the
   `story-tester` subagent, depending on what state its own sandbox's `node_modules` is in).
   HANDOVER.md's own R1 note for this story says "`pnpm add unpdf@0.11.0` printed
   `ERR_PNPM_IGNORED_BUILDS` for `canvas`'s postinstall script … left unapproved since we don't
   need canvas's native build" — i.e. the implementer knew about this and made the right call
   (deny it, no native build needed), but never actually wrote that decision into the file; a
   placeholder was left instead of `canvas: false`. This is the story's own change (canvas was not
   a dependency before `unpdf` was added here) and it is not listed in HANDOVER.md's "Files
   changed" for US-008, even though `pnpm-workspace.yaml` shows modified relative to the last
   commit. Fix: set `canvas: false` (matching the stated intent) and re-verify
   `pnpm install --frozen-lockfile` exits 0 from a clean `node_modules`, then add
   `pnpm-workspace.yaml` to Files changed.
2. **Warning — test quality gap on AC4's "exactly once" requirement.** The plan
   (`US-008-plan.md` §1, AC4 row) says "every case asserts `expect(fetchImpl).toHaveBeenCalledTimes(1)`".
   In `lib/extraction/pdf.test.ts`, that assertion is present for the 200-success case, the
   404/500 `it.each`, the request-shape case, and the timeout case, but is missing from the
   HTML-body, octet-stream, empty-body, promise-rejection and body-read-rejection cases
   (`pdf.test.ts:174-212`). Low risk in practice — `fetchOnce` is a single, already-tested call
   path with no retry logic reachable from these branches — but as written, those five tests would
   not catch an accidental extra `fetch` call in a future change to `downloadReportPdf` or
   `fetchOnce`.
3. **Note — HANDOVER.md "Files changed" is incomplete.** Beyond the `pnpm-workspace.yaml` gap
   above, this is the only omission found; `package.json`, `pnpm-lock.yaml`, `lib/extraction/pdf.ts`
   and `lib/extraction/pdf.test.ts` are all accurately listed. A repo-wide grep for the new
   symbols (`extractPdfText`, `downloadReportPdf`, `PDF_REQUEST_HEADERS`, `hasPdfSignature`) found
   no usage outside `lib/extraction/pdf.ts` and `lib/extraction/pdf.test.ts` — confirms no route
   wiring happened (correctly out of scope per the story) and no other file was touched for this
   story's functional code.

### Scope deviations

- None beyond the undisclosed `pnpm-workspace.yaml` change covered in Finding #1 (which is a
  necessary side effect of `pnpm add unpdf`, not an unrequested feature, but it needed to be both
  finished and disclosed).
- `lib/extraction/http.ts` and `lib/extraction/discovery.ts` (from US-007, Awaiting QA) are reused
  unchanged, as the plan required; confirmed no edits to either.

### Non-negotiable rules (AGENTS.md) spot-check

- Deterministic, non-AI extraction: N/A yet (this story only gets text out of a PDF; no field
  parsing). No AI used.
- Adapter per report format: N/A yet (US-009/US-010).
- Missing report → empty day / no retries: `downloadReportPdf` makes exactly one `fetchOnce` call,
  never retries (FR4.1), confirmed by AC4's tests.
- next-intl ro+en: no UI strings added; result messages are internal diagnostics (consistent with
  US-007's precedent), not user-facing.
- DEC-007 number display: N/A, no numbers formatted here.
- Secrets: none in code; `not_pdf`'s message includes only the URL and byte length, never response
  body content (`lib/extraction/pdf.ts:66`) — correctly treats a downloaded page as data, never
  echoing it into a message/log.
- No weakened/skipped tests: none skipped; AC3's named truncation case (1024 bytes) was kept as
  specified, not swapped for an easier cut.

### Why FAIL

AC6 is not actually satisfiable from a clean checkout: `pnpm install --frozen-lockfile` — the
first command AGENTS.md lists and the precondition for every other command in AC6 — exits 1 with
`ERR_PNPM_IGNORED_BUILDS` because of an invalid placeholder value in `pnpm-workspace.yaml`
introduced by this story's new `unpdf` → `canvas` transitive dependency. This is a Critical,
reproducible finding (confirmed against both the pre-existing `node_modules` and a fully fresh
install), not an environment quirk. Everything else in the story (AC1–AC5, the extraction/download
logic itself, and its tests) is solid; the fix is a one-line change to `pnpm-workspace.yaml`
(`canvas: false`) plus updating "Files changed".

## Round 2 — 2026-09-23

Verdict: PASS

Reviewer: `story-reviewer` subagent, fresh context. No git commands were run (not even
read-only). Sources read: `dev_minions/backlog/stories/US-008.md`,
`dev_minions/verification/US-008-plan.md`, `dev_minions/HANDOVER.md` ("Files changed" and the
round 1 fix note), `dev_minions/verification/US-008-review.md` (round 1), `AGENTS.md`,
`dev_minions/roles/technical-lead.md` (review checklist), `lib/extraction/pdf.ts`,
`lib/extraction/pdf.test.ts`, `lib/extraction/http.ts`, `lib/extraction/discovery.ts` (shared
`BVB_REQUEST_HEADERS` identity), `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`,
`test/fixtures/*.pdf`. Commands run: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`,
and — to re-verify the round 1 Critical finding specifically — `rm -rf node_modules && pnpm
install --frozen-lockfile` from a genuinely empty `node_modules` (the WSL1/DrvFs mount threw a
non-fatal `fts_read failed: Invalid argument` partway through the `rm -rf`, a known quirk on this
machine per DEC-008; `node_modules` was confirmed empty (0 entries) before reinstalling). All
green; `node_modules` was left populated afterward (487 `.pnpm` entries, `node_modules/.bin/next`
present), a build artifact, not a source change.

### Round 1 fix verification

- **Critical (pnpm-workspace.yaml `allowBuilds.canvas` placeholder) — FIXED.**
  `pnpm-workspace.yaml` now reads `canvas: false` (was the literal placeholder text `set this to
  true or false`). Re-ran `rm -rf node_modules && pnpm install --frozen-lockfile` from empty:
  exits 0, no `ERR_PNPM_IGNORED_BUILDS`, `unpdf@0.11.0` and its transitive `canvas` dependency
  both present under `node_modules/.pnpm` with no native build attempted. This was checked to
  make sure the fix — not an unrelated pre-existing `.pnpmrc` (`auto-install-peers=true` /
  `auto-approve builds`, present but untouched by this story per
  `dev_minions/.files-touched.log`, which has no `.pnpmrc` entry, and absent from the
  conversation's initial git-status snapshot as a modified/untracked file) — is what makes the
  install succeed: `.pnpmrc`'s second line, `auto-approve builds`, has no `=` and is not a valid
  pnpm rc key=value pair, so it is inert; the workspace's `allowBuilds` block in
  `pnpm-workspace.yaml` is the only mechanism actually gating `canvas`'s postinstall script, and
  it is now a real boolean. Confirmed `package.json` has no `pnpm.onlyBuiltDependencies` field
  either, so there is exactly one place this is controlled. Note: this `.pnpmrc` predates US-008
  and is not part of this story's Files changed — flagged as a Note below for awareness only, not
  a blocker for this story.
- **Warning (AC4 "exactly once" assertion gap) — FIXED.** `lib/extraction/pdf.test.ts:181, 191,
  198, 206, 215` now all carry `expect(fetchImpl).toHaveBeenCalledTimes(1)` — the five cases the
  round 1 review flagged as missing it (HTML-body, octet-stream, empty-body, promise-rejection,
  body-read-rejection) all have it now, alongside the cases that already did.
- **Files changed disclosure** — `pnpm-workspace.yaml` is now listed in HANDOVER.md's "Files
  changed" for US-008, closing round 1's Note.

### Acceptance criteria (re-checked in full, not just the delta)

- **AC1** — MET. `package.json:23` `"unpdf": "^0.11.0"` under `dependencies`; neither
  `pdfjs-dist` nor `pdf-parse` anywhere in `package.json` or `pnpm-lock.yaml`. Proven by
  `pdf.test.ts:30-40` ("dependencies (AC1)"), passing.
- **AC2** — MET. `pdf.test.ts:42-82` runs `extractPdfText` on all three committed fixtures,
  asserts `ok: true`, checks each of the five labels individually, plus the no-`\n` flattened-text
  guard. `lib/extraction/pdf.ts:72-88` implements it with `unpdf`'s `getDocumentProxy` +
  `extractText({ mergePages: true })`, pinned to `0.11.0` (HANDOVER.md's R1 note: `1.8.1` inserted
  `\n` between text items, breaking US-010's flattened-text contract; caught by the guard exactly
  as the plan anticipated, then pinned back). All 39 tests in the file pass, including the no-`\n`
  guard, confirming the pin holds.
- **AC3** — MET. `pdf.test.ts:84-117` covers pseudo-random bytes, the fixture truncated to 1024
  bytes (the story's named case, unchanged), a valid signature followed by garbage, and an empty
  array — all assert `{ ok: false, kind: "unreadable" }` with a non-empty message; `pdf.ts:72-87`
  wraps the body in try/catch so it never throws.
- **AC4** — MET. `pdf.test.ts:130-251` covers all required cases (200+PDF → exact bytes +
  `fetchedAt`; 404/500 → `http_error` + `httpStatus`; HTML mislabelled `application/pdf` →
  `not_pdf`; PDF as `application/octet-stream` → `ok:true`; empty 200 body → `not_pdf`; rejected
  promise → `network`; body-read rejection → `network`; timeout via fake timers → `timeout`), each
  now asserting `fetchImpl` was called exactly once (round 1 gap closed) and that the network
  guard was never invoked.
- **AC5** — MET. `beforeEach` stubs `globalThis.fetch` with a throwing guard
  (`pdf.test.ts:133-137`); every `downloadReportPdf` call either injects `fetchImpl` or re-stubs
  `fetch` deliberately for the one default-fetch case; a final assertion
  (`pdf.test.ts:248-250`) checks the guard was never called. `extractPdfText` needs no network.
- **AC6** — MET. `pnpm typecheck`, `pnpm lint`, `pnpm test` (143/143), `pnpm build` all pass, and —
  the round 1 blocker — a fully clean `rm -rf node_modules && pnpm install --frozen-lockfile` now
  exits 0.

### Findings (ordered by severity)

No Critical or Warning findings this round.

1. **Note — pre-existing `.pnpmrc` has a malformed line, unrelated to this story.** Root
   `.pnpmrc` contains `auto-install-peers=true` (valid) and `auto-approve builds` (no `=`, not a
   real pnpm rc key — inert). It predates US-008 (not in `dev_minions/.files-touched.log`, not
   modified per the conversation's initial git status) and was not touched by this story. Worth a
   cleanup pass whenever someone next touches pnpm config, but out of scope here and not a defect
   introduced by this story.

### Scope deviations

- None. `lib/extraction/http.ts` and `lib/extraction/discovery.ts` (US-007) remain unedited, as
  required. No route imports the new functions yet (`extractPdfText`, `downloadReportPdf`,
  `PDF_REQUEST_HEADERS`, `hasPdfSignature` appear only in `pdf.ts`/`pdf.test.ts`, confirmed by a
  repo-wide grep), consistent with the story's "Out of scope" section.

### Non-negotiable rules (AGENTS.md) spot-check

- Deterministic, non-AI extraction: N/A yet, no field parsing in this story. No AI used anywhere.
- Adapter per report format: N/A yet (US-009/US-010).
- Missing report → empty day / no retries: `downloadReportPdf` makes exactly one `fetchOnce` call
  and never retries (FR4.1), proven by AC4's "called exactly once" assertions in every case.
- next-intl ro+en: no UI strings added; result `message` fields are internal diagnostics, not
  user-facing, consistent with US-007's precedent.
- DEC-007 number display: N/A, no numbers formatted here.
- Secrets: none in code; `not_pdf`'s message includes only the URL and byte length, never body
  content (`pdf.ts:66`) — a downloaded page is treated as data, never echoed into a message/log.
- No weakened/skipped tests: none skipped; the round 1 fixes strictly added assertions
  (`toHaveBeenCalledTimes(1)`) and fixed environment config — no test was loosened to pass.
- No scope creep: the only change beyond `pdf.ts`/`pdf.test.ts` is the `unpdf` dependency and the
  workspace config it needs, both required by the story itself (ADR-001, Task 1).

### Why PASS

Both round 1 issues are fixed and independently re-verified: the Critical
`ERR_PNPM_IGNORED_BUILDS` failure is gone from a genuinely clean install (re-run from an emptied
`node_modules`, not just against the pre-existing one), and the Warning about the AC4 "called
once" assertions is closed in the five cases that lacked it. All six acceptance criteria are MET
with real, passing tests; `pnpm typecheck`, `pnpm lint`, `pnpm test` (143/143) and `pnpm build`
all pass. No Critical or Warning findings remain; one Note (a pre-existing, unrelated `.pnpmrc`
oddity) is recorded for awareness only.
