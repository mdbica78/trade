# Sprint 2 audit — Extraction core

Auditor: tech-lead subagent (in-loop, DEC-009), 2026-09-24.
Scope: US-007 … US-011, all Awaiting QA. For each story I read the story, plan, review and test
verdicts and the changed code, and checked each acceptance criterion against the code and tests
myself. I ran `pnpm test` once (`NODE_EXTRA_CA_CERTS` exported): **25 files, 387/387 passed**, exit 0.
The only stderr output is next-intl's `ENVIRONMENT_FALLBACK` timeZone warning (Sprint 1 N2, still open).
I ran no git command and read no `.env*` file.

Independent checks, beyond reading the code:
- **US-007:** I read the three instrument-page fixtures' `gv5News` rows myself with a separate
  Python regex. The newest row, its single href and its timestamp match `test/fixtures/bvb/README.md`
  §7 for BTBETRETF, TVBETETF and PTENGETF.
- **US-011:** I ran the spike's `pdf-parse` (a different library from `unpdf`) on
  BTBETRETF-2026-09-22, TVBETETF-2026-09-21 and PTENGETF-2026-09-22. All 8 values and the footer
  report date match `test/fixtures/expected.json` exactly, so the manifest was not copied from the
  adapter's output. I also dumped `unpdf` text for the 09-22 fixtures. The investors block is the
  last `Persoane fizice`/`Persoane juridice` pair in the text, so the unbounded investors
  sub-searches have nothing further on to borrow from.
- **Process:** I scanned every `dev_minions/automation/logs/*.jsonl` for Bash/Read calls that
  contain `git` or `.env`. The results are in W1. There were no `.env*` reads.

Verdict: PASS

There are no Critical findings, so no story is re-opened. Every acceptance criterion holds
against the code. The Warnings are about how well the verification was done and about process.
None of them makes a criterion false today.

## Per story

| Story | ACs checked against code/tests | Result |
|---|---|---|
| US-007 | AC1–AC8. Fixtures and README verified by hand. Parser isolates `#gv5News` and filters on the folded title "van la data". Newest-by-`publishedAt` ordering, same-row catch-up tie-break, relative/absolute resolution, `fetchOnce` single attempt with timeout race | OK. W2, N2 |
| US-008 | AC1–AC6. `unpdf` in `dependencies`, no pdfjs-dist/pdf-parse. `%PDF-` checked in a 1024-byte window, not trusted from Content-Type. `extractPdfText` never throws, empty text gives `unreadable`. A no-`\n` guard protects US-010's contract | OK. W2, N1 |
| US-009 | AC1–AC7. Exact-key `Map` lookup (no fallback, `null`/`undefined` give `undefined`). `detect` gives `undefined` on 0 or ≥2 claimants. Duplicate key throws. Validator covers the 5 story rules plus 2 hardening rules. No I/O imports | OK |
| US-010 | AC1–AC10. Footer-only report date, conflicting footers give `ok:false`. Units sub-fields bounded by the investors label. VUAN accepted only when the gap holds exactly one token. The number regex rejects ro-format. AC7 removal tests assert both `missingFields` and "no borrowed value" | OK. N3 |
| US-011 | AC1–AC8. Manifest independently confirmed (see above). Two-way set diff between PDFs and manifest. `BigInt`-exact sums. `detect` checked by instance identity. `report:latest` fully injected, `--save` date proven to come from the PDF (clock faked to 2030, `publishedAt` differs), write uses the `wx` flag | OK. W3, N4 |

## Critical

None.

## Warning

- **W1 — Agents attempted git again (process; systemic, repeat of Sprint 1 / US-002).**
  In `dev_minions/automation/logs/autopilot-20260923-222814-a1.jsonl`:
  - line 512: `story-reviewer` for US-007 round 1 ran `git diff --stat`;
  - line 901: the **main session**, during US-008, ran `git diff --stat pnpm-lock.yaml package.json`;
  - line 1904: `story-reviewer` for US-009 round 1 ran `git status --porcelain`.

  The permission system denied all three, so no state was read or changed. Two problems remain:
  1. `dev_minions/verification/US-009-review.md:7-8` says "No git commands were run". That is
     literally true, because the call was denied, but it hides the attempt.
  2. The HANDOVER log does not record any of the three attempts.

  This is the second sprint in a row, and now the orchestrator did it too. The brief wording
  alone is not stopping it. Recommendation for the Technical Lead chat (kit maintenance, DEC
  needed): keep the permission deny rules as the real control. Also add to the reviewer, tester
  and implementer briefs that a verdict file must disclose any *attempted* git or `.env*`
  access, including denied ones.
- **W2 — Vacuous "no real network" tests counted as AC evidence.**
  - `lib/extraction/discovery.test.ts:340-342`: "every mocked test above never calls the real fetch
    stub". The guard is created in this `describe`'s own `beforeEach`, after every earlier test
    has run, so it can never have been called.
  - `lib/extraction/pdf.test.ts:248-250`: the same pattern. `beforeEach` gives each test a fresh
    guard.

  Both tests pass no matter what the rest of the suite does. `US-007-tests.md:33` and
  `US-008-tests.md:36` still cite them as the evidence for US-007 AC7 and US-008 AC5. The
  criteria do hold: I checked by inspection that every test injects `fetchImpl` or stubs
  `fetch`. The real protection comes from elsewhere:
  - the per-test guard assertion at `pdf.test.ts:164`;
  - the "reads globalThis.fetch at call time" test;
  - a missing `fetchImpl` would turn into a `network` result, and the test expecting `found` or
    `ok` would then fail.

  Fix when either file is next touched: delete the vacuous `it`s, or install the guard once in a
  file-level `beforeAll` and assert it at the end in an `afterAll`.
- **W3 — US-011 verdicts overstate their evidence.**
  - `US-011-review.md:100` marks AC7 "MET (manual QA)". AC7 is a MANUAL-QA step the user has not
    run yet, so it is **UNVERIFIED**, not MET. This is the same pattern as Sprint 1 W1. The
    implementer's own live `--save` run is supporting evidence, not the check the AC asks for.
  - `US-011-tests.md:23-35` maps AC1/AC2/AC5 to 6/4/3 tests and says "all three committed PDF
    fixtures … all dated 2026-09-21". The suite actually runs 6 fixtures.

  The tester's mapping was not reconciled with the suite it claims to have mapped. That is a
  rubber-stamp signal, although its top-line counts (387, 49 + 23) are right. The reviewer
  caught it (Note 1) and it is already in the QA file, so no action is needed beyond
  keeping AC7 open until the user's demo answer.
- **W4 — Automation kit file missing on disk (environment, for the user).**
  `ls -la scripts/claude/` shows `autopilot.sh` as `-?????????` ("No such file or directory"),
  and the session-start git snapshot lists it as `D`. No agent tool call in any log touches
  `scripts/claude/`. The file is probably being replaced while the running `bash` holds it open,
  a DrvFs quirk. `dev_minions/automation/AUTOMATION.md:6` still tells the user to start the
  unattended runner with it. The user should check the file and reinstall it with
  `bash scripts/claude/install-kit.sh` if needed before the next `tmux` run. Agents may not
  touch `scripts/claude/`.

## Note

- **N1 — `package.json:24` has `"unpdf": "^0.11.0"`, not an exact pin.** HANDOVER says the
  version is pinned. In practice the lockfile pins `0.11.0`, and the no-`\n` test
  (`pdf.test.ts`, AC2) would catch drift within 0.11.x. Still, the `1.8.1` break shows that
  `unpdf`'s text layout changes without warning. Recommend `"unpdf": "0.11.0"` the next time
  `package.json` is touched.
- **N2 — `lib/extraction/discovery.ts:40`: `ROW_RE` matches only a bare `<tr>`.** If BVB adds any
  attribute to the rows, every row is skipped and discovery returns
  `not_found / no_report_entries`. That failure is visible, not a wrong value, so it is
  acceptable. The Sprint 3 cron should surface `list_not_found` and `no_report_entries` as
  distinct reasons (FR13).
- **N3 — `lib/extraction/adapters/brd-depositary.ts:151-153`: the units sub-search runs to end of
  text when the investors label is absent.** This follows the story's rule. However, if the
  units block's `Persoane fizice` were also missing (two faults at once), the investors value
  would be taken. The investors sub-searches (`:184-187`) are also unbounded to the end of the
  text. That is harmless on all 6 real fixtures (nothing follows the investors block). Consider
  bounding both when US-029 or a second adapter touches this area.
- **N4 — `lib/extraction/report-latest.ts:154-175`: a partial extraction still saves the PDF
  with `--save` (exit code 1).** This is intentional (plan R6) and tested
  (`report-latest.test.ts:263`). A saved partial fixture then fails the regression suite until it
  gets a manifest entry, which is the intended safety net.
- **N5 — The data-model thousands-separator note from the Sprint 2 review is resolved.**
  `architecture/data-model.md:85` now matches FINDINGS.
