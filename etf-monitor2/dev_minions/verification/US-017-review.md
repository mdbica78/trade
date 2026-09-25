# US-017 — Independent Review

## Round 1 — 2026-09-25

Verdict: PASS

Reviewer: `story-reviewer` subagent (fresh context, did not write this code). No git commands were
run (per AGENTS.md/technical-lead.md; only `Read`/`Bash` non-git commands and `pnpm typecheck`,
`pnpm lint`, `pnpm test`, `pnpm build` were used, plus process-management commands to clear a
stray `.next/lock` left by an unrelated concurrent build process before re-running `pnpm build`
myself).

Story: `dev_minions/backlog/stories/US-017.md` (AC1-AC8, including the 2026-09-25 tech-lead review
section). Plan: `dev_minions/verification/US-017-plan.md`. Files changed per
`dev_minions/HANDOVER.md`: `lib/monitoring/delta.ts`/`.test.ts` (new), `lib/format/delta.ts`/`.test.ts`
(new), `lib/monitoring/home-delta.pglite.test.ts` (new), `lib/monitoring/home.ts` (edit),
`lib/monitoring/home.pglite.test.ts` (edit), `components/HomeTable.tsx`/`.test.ts` (edit),
`app/page.test.tsx` (edit, fixture only), `messages/ro.json`/`messages/en.json` (edit). Grepped the
repo for every new symbol (`computeDelta`, `previousCalendarDay`, `formatDeltaAbsolute`,
`formatDeltaPercent`, `deltaAbsolute`, `deltaPercent`, `buildPreviousDayOkValuesStatement`) — every
hit is inside this file list, confirming no scope creep. `app/page.tsx` itself has zero references
to delta, matching the plan's "No change to `app/page.tsx`."

### Acceptance criteria

- **AC1 (absolute delta exact)** — MET. `lib/monitoring/delta.ts:62-66` (`computeAbsolute`), all
  bigint arithmetic, no float. Proven by `lib/monitoring/delta.test.ts:6-28` (all four story cases
  plus negative inputs, a scale-0-vs-scale-4 case, and a large-value case). A dedicated source-scan
  test (`delta.test.ts:110-153`) statically proves no `Number(`, `parseFloat`, `parseInt`,
  `.toFixed(`, `Intl`, `Date`, or unary `+` appears on the arithmetic path (scoped to before
  `previousCalendarDay`, with a non-vacuity assertion on the boundary index and source length, plus
  positive/negative controls on the unary-plus regex). I independently traced the bigint math by
  hand for two cases (`5`/`4.9999`→`0.0001`, `-10`/`-20`→`10`) and it is correct.
- **AC2 (percentage exact, half away from zero, null at previous=0)** — MET.
  `lib/monitoring/delta.ts:73-98` (`computePercent`). Proven by `delta.test.ts:30-57`, including the
  exact-tie case (`1000.15`/`1000`→`0.02`, which a float `toFixed` would give as `0.01`) and the
  round-to-zero cases (`1000.00004`/`1000`→`0.00`, `999.99996`/`1000`→`0.00`, never a signed zero). I
  hand-verified the tie case against the bigint formula (`numerator=15*10000=150000`,
  `quotient=1`, `remainder=50000`, `2*50000 >= 100000` → round up to `2` → `"0.02"`) and it matches.
  HANDOVER.md documents a real bug the implementer caught before it ever ran: an earlier version
  divided by `previous.digits` at its *native* scale instead of the common rescaled scale, which
  would have misplaced the decimal point for exactly this test case. Reading the shipped code
  confirms the fix (`previousScaled = rescale(previous, scale)` before taking the magnitude) —
  worth recording as a caught-early bug, not a residual risk.
- **AC3 (previous day = calendar day before; TZ-independent; proven through the read model)** — MET.
  `previousCalendarDay` (`delta.ts:127-156`) is pure integer arithmetic, no `Date`. Unit tests
  (`delta.test.ts:73-108`) cover the four story cases plus a century-non-leap-year case
  (`2100-03-01`→`2100-02-28`), re-run under `TZ=Pacific/Kiritimati` and `TZ=America/Los_Angeles`,
  and an invalid-input throw case. The read model is proven separately in
  `lib/monitoring/home-delta.pglite.test.ts:60-94`: month, year and leap-year boundaries through
  `createHomeTableLoader` itself (SQL `report_date - 1`, per plan option (a)), plus a negative
  control (a 2-day gap gives `delta: null`, not a guess). `home.ts:74-78` keeps
  `previousCalendarDay` on the production path via the documented invariant check
  (`computeCellDelta`, `home.ts:245-262`), exactly as the tech-lead review required — confirmed by
  reading the code, not just the plan's claim.
- **AC4 (blank, never guessed)** — MET. All seven PGlite cases from the plan are present and pass:
  `home-delta.pglite.test.ts:96-168` (missing previous day with an older report further back,
  `parse_error` previous day with a stored value, previous `ok` day missing the field while another
  field has a delta — the non-vacuity case, current value null, exact consecutive-day delta,
  previous value `0` giving a null percent, and a newer `parse_error` correctly ignored so the shown
  value is compared against the right day, not a stale one two days back).
- **AC5 (display: sign from rounded value, DEC-007 mark, no grouping, `%` no space)** — MET.
  `lib/format/delta.ts` reuses `formatNumber` (the only DEC-007 formatter — checked
  `lib/format/number.ts`, confirmed it is a plain string `.replace(".", ",")`, so it preserves an
  existing `-` sign and never introduces a grouping character). `lib/format/delta.test.ts` covers ro
  `+0,006`/`+0,05%`, en `-30000`/`-0.08%`, zero-shows-no-sign for both absolute and percent, a
  defensive `-0.00` input never rendering a signed zero, and no grouping character on
  `1234567.89`.
- **AC6 (home cell order, null renders nothing, new strings in both catalogues)** — MET.
  `components/HomeTable.tsx:56-80` renders value, then absolute (if `delta`), then percent (if
  `delta.percent !== null`), each in a separate `<span title=…>`. Tests in
  `components/HomeTable.test.tsx:74-145` prove ordering by `indexOf` (both-deltas case), assert no
  `%` in the absolute-only cell, assert the null-delta cell is byte-for-byte
  `"<td>11.171</td></tr>"` (no stray `+`/`-`/`%`/`0,00`), and that the two new title labels render
  only in their own locale. `messages/ro.json`/`en.json` both carry `Home.deltaAbsolute` and
  `Home.deltaPercent`; `i18n/messages.test.ts` (key-parity test, unmodified this story) passed in
  the full run, so the two catalogues stay in lockstep.
- **AC7 (offline, PGlite, shipped statements)** — MET.
  `home-delta.pglite.test.ts` uses `createTestDatabase()`/`createHomeTableLoader(db.mockDb,
  undefined, db.runner)` — the same statements `createHomeTableLoader` uses in production
  (`home.ts:321-343`). Grepped the whole diff for `@neondatabase/serverless` and `DATABASE_URL`:
  no hit in any new/edited file.
- **AC8 (gates)** — MET. I ran all four gates myself, independently: `pnpm typecheck` (clean),
  `pnpm lint` (exit 0, only the three known pre-existing unused-test-param warnings), `pnpm test`
  (706/706 passed, 52 files, including all 11 new `home-delta.pglite.test.ts` cases and the 10 new
  `lib/format/delta.test.ts` cases), `pnpm build` (passes, both with and without `DATABASE_URL` set
  — matches the sprint DoD noted in the plan). One unrelated, already-running concurrent `next
  build` process from another session held a stale `.next/lock`; I waited for it to exit and
  re-ran cleanly rather than treating it as this story's failure.

### AGENTS.md non-negotiables

- Deterministic extraction / adapter-per-format / AI scope: not touched by this story, no
  regression found.
- Empty day on missing report: consistent — a missing/parse_error previous day yields
  `delta: null`, never a guessed value (AC4).
- next-intl ro+en for every new string: both new keys present in both catalogues, key-parity test
  green.
- DEC-007 number display: reused `formatNumber` exactly, no new formatting logic that could drift
  from it.
- No secrets in code or logs: none introduced; this story has no I/O of its own beyond read-only
  SQL already covered by AC7.
- No weakened/skipped tests: the four edited `home.pglite.test.ts` expectations only *add*
  `delta: null` to existing `toEqual` objects — I read the file and confirm no assertion was
  removed, no `toEqual` downgraded to `toMatchObject`.
- No scope creep: confirmed above via the symbol grep; only the files HANDOVER.md lists were
  touched for this story.

### Findings

No Critical or Warning findings.

Notes (non-blocking):
- `previousCalendarDay`'s own `Number(match[1..3])` calls are outside the arithmetic-path source
  scan's boundary by design (they parse small calendar-integer components, not
  `report_values.numeric_value`). This is a deliberate, documented scope for the scan and matches
  AC1's own wording ("no test result depends on floating-point rounding" — about the value
  arithmetic, not date parsing). Confirmed correct, not a gap.
- The Romanian wording of the two new `title` labels (`Home.deltaAbsolute`/`deltaPercent`) is
  explicitly left for PO confirmation at the demo, per the story's and plan's own notes — correctly
  not blocking this review.
- MANUAL-QA (sprint-04.md step 3, live Neon data on two consecutive calendar days) is correctly
  deferred and out of this review's scope; nothing in this story's ACs required it to be tested
  here.
