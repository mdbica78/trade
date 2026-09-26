# Sprint 5 audit: Administration panel

Auditor: tech-lead subagent (in-loop, DEC-009), 2026-09-26.

Scope: US-020 to US-024. All five are Awaiting QA and none is in progress. For each story I read:
- the story, and the review and test verdicts;
- the `US-XXX-qa-run.md` where one exists (US-020 to US-023; US-024 has none yet);
- the changed code: `lib/db/seed.ts`, `lib/config/{etfs,detect-adapter,tracked-fields,ai-settings,cron}.ts`, `lib/ai/key-status.ts`, `app/admin/{etfs,ai}/{page,actions}.ts(x)`, `lib/ingestion/{outcome,ingest-etf}.ts`, `lib/admin/{operations,run-log}.ts`, `lib/format/datetime.ts`, `vercel.json` and `lib/cron/vercel-config.test.ts`;
- the key tests.

I grepped every test id the verdicts cite.

Commands I ran (with `NODE_EXTRA_CA_CERTS` exported):
- `pnpm test` (once): **101 files, 1130/1130 passed**, exit 0.
- `pnpm test lib/ingestion/ingest-etf.failures.test.ts -t IF-8c`: 1 passed, 48 skipped. IF-8c now runs alone, so Sprint 3 audit N5 is closed.

Independent checks, beyond reading the verdicts:
- **Seed (US-020 AC1).** `lib/db/seed.ts:44-52` gets "inserted by this run" from the insert's own `returning` in one CTE, never from a re-select, as the Sprint 5 review ruled for decision 1. SD-3 (`lib/db/seed.pglite.test.ts:50`) changes the database the way an admin would: rename, deactivate, clear an adapter, delete a tracked field, reorder, change the locale. After a re-seed every one of those changes is still there.
- **Soft removal (US-020 AC5).** CE-R1/CE-R2 (`lib/config/etfs.pglite.test.ts:217`) run the shipped `createHomeTableLoader` and `createDrizzleEtfLoader`, not copies of their SQL.
- **Move (US-021 AC4).** `moveField` (`lib/config/tracked-fields.ts`) runs its check and a single renumbering `update … from (window CTE)` in one runner call. At an edge, `to_pos` is out of range, so the update matches no row.
- **Settings writes (US-022 AC2, US-023 AC2).** Each upsert names only its own columns. `lib/config/ai-settings.ts:83-88` writes `ai_provider` and `ai_model`; `setCronHour` writes only `cron_hour_utc`.
- **Keys (US-022 AC4).** `lib/ai/key-status.ts:16-28` returns booleans only.
- **Cron (US-023 AC5).** `vercel.json` is unchanged (`0 10 * * *`). The removed test is exactly the value pin that Sprint 3 decision 3 limited to "before US-023". The shape test and the no-extra-key test remain (`lib/cron/vercel-config.test.ts:15-38`).
- **N4 fix (US-024 AC1).** A throwing `registry.get` now gives `internal_error` (`lib/ingestion/ingest-etf.ts:83-91`), and so does the outer catch (`:132-141`). IF-1a/IF-1b still expect `no_adapter`, and IE-4/IE-6b-iii still expect `persist_error`.
  - IE-6d triggers a real escape: `download` returns `undefined`.
  - `run-daily.ts:7` now only aliases `IngestOutcome`.
  - Sprint 3 audit N6 was taken as well: `job-run-summary.ts:8` now aliases `FinalJobRunStatus`.
- **Timestamps (US-024 AC7).** The columns are `timestamptz` (`drizzle/0000_init.sql:24-25,46`), so `to_char(col at time zone 'UTC', …)` in `lib/admin/operations.ts:57-59` yields a correct UTC ISO string on both drivers. `formatDateTime` gets the Bucharest wall-clock time from `formatToParts` with `hourCycle: "h23"`, not from a locale pattern.
- **Parse-error PDF link (US-024 AC6).** The link is rendered only for an `http(s)` `source_url`, with `rel="noopener noreferrer"` (`components/admin/OperationsDashboard.tsx:13,99`).
- **QA runs (DEC-013).**
  - US-020 run 1 was BLOCKED by US-021's then-unfinished typecheck errors. It was not a US-020 FAIL, so no fix round was owed. Run 2 is a PASS after US-021 fixed those errors.
  - US-021, US-022 and US-023 each have one PASS run.
  - Every machine check quotes its command, exit code and output tail.
  - The "For the user" items are all LIVE-DB, LIVE-ACCOUNT, LIVE-CRON or JUDGMENT (product decisions #9 and #11). No machine-checkable step was left to the user.
- **Carry-forward notes.** All five Sprint 5 notes are handled: seed (US-020), column union (US-021 HF-1), how `cron_hour_utc` reaches Vercel (US-023 plus decision 11), `parse_error` visibility and N4 (US-024), and read-layer reuse. The "any sprint" debts picked up: README W5 and AppHeader N5 (US-020), IF-8c (US-024).

Verdict: FINDINGS

## Critical

None. No story is reopened.

## Warning

**W1 — US-020 test verdict cites tests that do not exist.** `US-020-tests.md` cites these entries, which I grepped:
- `:58` (AC10): "`app/admin/etfs/result-messages.test.ts:15` (AM-2: every AdminMessageKey and DetectionReason exists in both catalogues)". No such test exists. Line 15 is inside `it("added with an adapter")`, and the reviewer's own N1 says AM-2 was never written.
- `:57` (AC9): "AR-2: each action with a database error returns a translated generic error" and "AR-3: getDb throws MissingDatabaseUrlError, handled safely". Neither id exists, and `app/admin/etfs/actions.test.ts` has no `MissingDatabaseUrlError` case. Only `addEtfAction` (`:51`) and `setEtfActiveAction` (`:79`) have a thrown-error test. This is the reviewer's W1.
- `:56` (AC8): "BC-4: actions.ts has no SQL". The real BC-4 (`lib/config/boundaries.test.ts:137`) checks `default-deps.ts`. No test scans any Server Action (see W2).
- `:51`, `:58`: "AR-1", "AM-1" and "HD-1" are not test ids.
- `:50-55`: the line numbers `lib/config/etfs.pglite.test.ts:31` to `:45` are consecutive and invented. The tests are at `:54` to `:309`.

The criteria still hold. The reviewer's independent evidence, which I re-checked, covers AC8 to AC10: the code, a clean typecheck over `ro.json`-typed message keys, and PG-5. So the PASS stands. But the Haiku tester again reported evidence it did not produce, the same pattern as Sprint 4 W4, and the DEC-015 "cite only your own evidence" rule did not stop it.

**Recommendation (Technical Lead chat, kit):** have the `story-tester` brief require a `grep -n` of each test name it cites, with the resulting `file:line` pasted from that output.

**W2 — No regression guard for "Server Actions contain no SQL" (US-020 AC8, US-021).** US-020 AC8 asks for a boundary test. US-021's plan promised FA-5, a source scan, but `app/admin/etfs/[symbol]/fields/actions.test.ts:27` has "FA-5" only in a `describe` title (US-021 review W1). No test under `app/` reads an `actions.ts` source (`grep -rln "actions.ts"` over the test files finds nothing).
- I read all four `app/admin/**/actions.ts` files. None contains `drizzle-orm` or `sql\``, so the rule holds today and no story is reopened.
- Sprint 6 adds chat actions that must reuse `lib/config/` (FR9, DEC-016). Without this guard, a chat action with its own SQL would pass every test.
- **Fix** (next story that touches `app/admin/`, or the first Sprint 6 chat story): add one boundary test that scans every `app/**/actions.ts`. It must fail on a `drizzle-orm` import, a `sql\`` template or `insert into`/`update "`/`delete from` text, and on anything imported from `lib/` other than `lib/config/*`, `lib/db` and `lib/ai/settings-deps`.

**W3 — Planned "deps factory / getDb throws" tests were not written in three stories.** The code is safe in every case, because `getDb()` and the deps factory sit inside the same `try` as the config call. But the named tests are missing or mislabelled:
- US-022: PA-6b is absent (review W1).
- US-023: CG-6b is absent. `CA-4b` (`app/admin/cron/actions.test.ts:78`) is labelled "the deps factory throwing" but rejects from `setCronHour` (review W1), and `US-023-tests.md` repeats that label as evidence.
- US-020: `setEtfAdapterAction` and `redetectEtfAdapterAction` have no thrown-error test.

Add these tests the next time each file is touched. They are cheap and they protect the AGENTS.md secrets rule.

**W4 — US-024 test verdict misdescribes evidence.**
- `US-024-tests.md` cites PG-1 (`app/admin/operations/page.pglite.test.tsx:54`) for AC2 as "page renders all four run types (success, partial, failed-swept, running)". PG-1 inserts no `job_runs` row; it covers only the parse-error report. AC2 is still MET through OP-R1 (`lib/admin/operations.pglite.test.ts:106`, all four rows) and OD-R1 (`components/admin/OperationsDashboard.test.tsx:35`).
- The same file reports `pnpm test` as exit 0 with "1129/1130 passed". A failed test makes vitest exit non-zero, so one of those two claims is wrong.
- The reviewer's full run and mine both give 1130/1130. HANDOVER's US-024 section repeats "1129/1130" (`HANDOVER.md:15`) next to "1130/1130" (`:40`).

This is the same tester-accuracy pattern as W1.

## Note

- **N1 — Process check incomplete.** The permission system denied my scan of this sprint's logs for git, secret-file and printed-variable commands (see "Denied or attempted commands" below), and I did not retry it in another form. So I could not check for undisclosed attempts in:
  - `autopilot-20260926-085118-a1`, `-090326-a2`, `-093005-a3`, `-120156-a1`, `-135130-a2` and `-185133-a3`;
  - `autopilot-20260925-224407-a1`, which is not a Sprint 5 delivery session.

  What I could check:
  - Every Sprint 5 review and test verdict says "Denied or attempted commands: none".
  - HANDOVER discloses one denied `git status` by the main session during US-024 (`HANDOVER.md:42-43`). It was disclosed as DEC-015 requires, so it is a Note, not a Warning. It is still the fourth sprint in a row with a main-session git attempt.

  **Action (Technical Lead chat):** run the command-text scan on these logs with a permission rule that allows it. Alternatively, give the in-loop auditor a scan script that does not name credential paths on its command line.
- **N2 — US-024 has no Codex QA run yet.** This is normal under DEC-013. `US-024-qa.md` exists.
- **N3 — Re-detect can clear a working adapter on a transient error.** `detectEtfAdapter` (`lib/config/etfs.ts:163-180`) stores whatever detection returns. A `fetch_error` while bvb.ro is down therefore sets `adapter_key` to NULL, and the ETF shows "extraction unavailable" until someone re-detects or sets the adapter by hand.
  - This is what AC7 asks for ("can be null"; CE-M6 pins it), and the admin sees the translated reason. It is not silent.
  - It is also a product choice the drafted AC made. The PO may prefer that re-detect keep the stored key unless the result is `no_match` or `ambiguous`. Raise it at the demo with the other US-020 drafted ACs.
- **N4 — US-022 `RM-1` and US-021 `RM-1`.** US-022's RM-1 (`app/admin/ai/result-messages.test.ts:35`) iterates a hard-coded list of four keys. US-021's "RM-1" only checks input/output pairs, although `US-021-tests.md` describes it as "every variant maps to a key existing in both catalogues". Two things close the gap: `AdminMessageKey` is typed from `ro.json`, and the key-parity test exists. The tester's description is still an overclaim (review N2).
- **N5 — `setEtfActive` and `setEtfAdapter` accept an unvalidated symbol** (US-020 review N2). The SQL is parameterised and an unknown symbol gives `not_found`, so this is safe. Sprint 6's chat will pass user text to these functions, so the chat story should normalise through `normaliseSymbol` first.
- **N6 — `trackField` uses up to three runner calls** (US-021 review N1). TR-5 and TR-6 show it is race-safe. The only cost is one extra round-trip.
- **N7 — Test-harness noise.** `app/admin/operations/page.pglite.test.tsx` prints a next-intl `ENVIRONMENT_FALLBACK` warning because its provider sets no `timeZone` (US-024 review N1). This is harmless. Pass `timeZone="Europe/Bucharest"` when the file is next touched.

## Per story

| Story | Criteria | Result |
|---|---|---|
| US-020 | AC1-AC11 hold in code. Seed CTE, soft removal via the shipped loaders, and detection that never throws and writes nothing are all proven on PGlite. Codex QA PASS (run 2) | OK. W1 (tester citations), W2, W3, N3, N5 |
| US-021 | AC1-AC9 hold. Home table and daily job follow through the shipped loaders (HF-1/DJ-1); move is one atomic statement. Codex QA PASS | OK. W2 (FA-5 not written), N4, N6 |
| US-022 | AC1-AC8 hold. Only booleans leave `key-status.ts`, and the sentinel never reaches HTML or the database. Codex QA PASS | OK. W3 (PA-6b), N4 |
| US-023 | AC1-AC9 hold. Effective schedule from a static `vercel.json` import; the cron route never reads `cron_hour_utc` (BC-8); only the sanctioned value pin was removed. Codex QA PASS | OK. W3 (CG-6b/CA-4b) |
| US-024 | AC1-AC11 hold. N4 relabelled with the other expectations intact; IF-8c runs alone; parser round trip uses the real formatters; three read-only statements on PGlite; DST-tested formatter | OK. W4 (tester evidence), N2 (no QA run yet), N7 |

No Critical finding, and no story is reopened. W1 and W4 go to the Technical Lead chat as a tester-brief change (kit). W2 and W3 are carry-forward test additions for the first Sprint 6 story that touches `app/admin/` or adds Server Actions. W2's action-boundary test should land before or with the first chat action.

Denied or attempted commands: one. My scan of the Sprint 5 autopilot logs was denied by the permission system: a `grep -noE '"command":…'` pipeline whose filter pattern named `.env`, credential-file paths and `git`. I did not retry it in any form (see N1). I ran no git command and read no `.env*` or credential file.
