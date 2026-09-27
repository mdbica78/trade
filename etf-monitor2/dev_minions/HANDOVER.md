# HANDOVER — live state of automated delivery
_Last updated: 2026-09-27 (autopilot, /goal) by Claude Code_
Automation state: RUNNING

Read this first, whatever agent you are (Claude Code, GitHub Copilot). Rules: AGENTS.md and `dev_minions/process.md` §5. Agents never run git — not even read-only; the user does.

## Active story
US-031 (End-to-end verification on the real deployment) — phase=plan, round=0. Complex (whole-
pipeline test through the cron handler, deployment smoke script, cron/infra, 7 ACs); story file
already has a binding tech-lead review (`backlog/stories/US-031.md` points 1-5). Picked because
both its dependencies, US-029 and US-030, are now Awaiting QA. Delegating to `story-planner`:
"plan US-031" next. Decision #12 (`/health` exception text) is `NEEDS USER`, isolated default
ships (unchanged from US-006 AC2) — already listed under "Waiting on the user" below.

## US-030 — closed out this round (Awaiting QA)
Round 1: review PASS (no Critical, 5 non-blocking Warnings — see below), tests PASS (1640/1640
full suite, all 11 acceptance criteria MET, `US-030-tests.md`). Fixed the three cheap warnings in
place (no re-review needed, all test-only, no application code changed): W1
(`test/helpers/pglite.migrations.test.ts` PM-1/PM-2/PM-3 — the ON DELETE CASCADE test the plan
asked for, which the tester had mistakenly cited as already existing), W3 (NA-5 tightened to the
exact fetch/saveReport counts the plan specified, over real fixtures instead of a loose stub), W4
(`lib/admin/run-log.test.ts` RL-9's hard-coded code list now includes `not_attempted`, 9 codes).
W2 (RL-1..RL-9 stub `detect` instead of routing a mocked fetch through the real `detectAdapter`)
and W5 (HANDOVER "Files changed" omitted `lib/db/schema.test.ts` and two type-only
`EtfConfigDeps.now` AI test fallout files) are accepted as-is; W5 was closed by the prior update.
Local gates re-run green after the fixes (typecheck, lint 0 errors/6 pre-existing warnings). QA
checklist written (`US-030-qa.md`). status.md → `Awaiting QA — review PASS, tests PASS (round 1);
Codex QA not yet run`. This also makes US-031 eligible (both its dependencies are now Awaiting QA).

### Round 1 verdicts
- Review: PASS, `dev_minions/verification/US-030-review.md` — no Critical; W1-W5 above.
- Tests: PASS, `dev_minions/verification/US-030-tests.md` — 1640/1640 full suite, all 11 ACs MET.

## Files changed (US-030, in flight)
- new: `lib/db/schema.ts` (+`etfReportLinks`), `drizzle/0001_etf_report_links.sql`,
  `drizzle/meta/0001_snapshot.json` (generated), `drizzle/meta/_journal.json` (updated)
- new: `lib/ingestion/report-links.ts`, `report-links.test.ts`
- new: `lib/ingestion/ingest-no-adapter.test.ts`, `run-deadline.test.ts`, `recovery.pglite.test.ts`
- new: `lib/monitoring/home-links.pglite.test.ts`
- new: `lib/cron/deadline.pglite.test.ts`
- new: `lib/config/etfs.report-link.pglite.test.ts`
- new: `app/chat/add-paths.pglite.test.ts`
- changed: `test/helpers/pglite.ts` (applies every journal migration, not just `0000_init.sql`)
- changed: `test/helpers/ingest-fakes.ts` (+`FakeLinkStore`, `FIXED_NOW`, `linkDeps()`, `roomyBudget()`,
  `stubPipelineDeps` wired with `...linkDeps()`)
- changed: `lib/ingestion/outcome.ts` (+`not_attempted` code, `NoAdapterLinkOutcome`,
  `formatNoAdapterDetail`), `outcome.test.ts` (OC-8a nine codes)
- changed: `lib/ingestion/ingest-etf.ts` (`IngestDeps` +`links`/`now`; new `ingestNoAdapter` — one
  discovery, no download, link upsert only on `found`), `ingest-etf.test.ts`, `ingest-etf.pglite.test.ts`,
  `ingest-etf.failures.test.ts` (IF-1a-d rewritten for the new branch; IF-8a +`not_attempted` trigger;
  every `IngestDeps` literal gains `links`/`now`), `ingest-icbetnetf.pglite.test.ts`,
  `request-bound.test.ts` (RB-4 +`reportUrl`, new RB-5)
- changed: `lib/ingestion/run-daily.ts` (+`CRON_MAX_DURATION_S`, `PARSE_ALLOWANCE_MS`,
  `FINISH_RESERVE_MS`, `etfWorstCaseMs`, `runDeadlineMs`, `canStartEtf`, `RunBudget`;
  `runDailyIngestion` takes a budget and guards each ETF start), `run-daily.test.ts` (all calls
  gain `roomyBudget()`)
- changed: `lib/ingestion/job-run-summary.test.ts` (JS-3a +`not_attempted`)
- changed: `lib/ingestion/default-deps.ts` (`createDefaultIngestDeps(now)`, `createDailyRunDeps({ now, fetchTimeoutMs? })`
  wire `links`/`now`), `default-deps.test.ts`, `default-deps.cron.test.ts`
- changed: `lib/ingestion/boundaries.test.ts` (+BD-16: only `report-links.ts` writes
  `etf_report_links`, only `lib/monitoring/home.ts` reads it elsewhere in `lib/`)
- changed: `lib/cron/daily-job.ts` (`DailyJobDeps.runIngestion` takes `{ startedAt }`),
  `daily-job.test.ts` (+DJ-S), `daily-handler.test.ts` (both `runIngestion` call sites)
- changed: `lib/cron/default-deps.ts` (shared `now`, `runIngestion` passes `{ startedAt, now }` into
  `runDailyIngestion`), `default-deps.test.ts` (+CD-3)
- changed: `lib/config/detect-adapter.ts` (`DetectionResult` +`reportUrl?`, set on any `found`
  discovery whatever the later outcome), `detect-adapter.test.ts` (DA-1/4/6/7/8b +`reportUrl`;
  DA-2/3 assert its absence)
- changed: `lib/config/etfs.ts` (`EtfConfigDeps` +`now`; `addEtf`/`detectEtfAdapter` upsert the
  link as a swallowed-failure side step), `etfs.test.ts`, `etfs.pglite.test.ts` (both +`now`)
- changed: `lib/config/default-deps.ts` (`createEtfConfigDeps` +`now: () => new Date()`)
- changed: `lib/monitoring/home.ts` (`buildLatestReportLinksStatement` rewritten: newest report vs.
  `etf_report_links`, link wins unless the report is newer or ties)
- changed: `lib/monitoring/history.ts` (`EtfHistory.etf` +`adapterAvailable`, selects `adapter_key`,
  new `registry` param), `history.pglite.test.ts` (AC1 +`adapterAvailable`, +HP-A)
- changed: `components/EtfDetail.tsx` (+extraction-unavailable marker), `EtfDetail.test.tsx`
  (+adapterAvailable on fixtures, +ED-M1/ED-M2)
- changed: `components/HomeTable.test.tsx` (+HT-L)
- changed: `components/admin/OperationsDashboard.test.tsx` (+OD-NA/OD-NA2)
- changed: `app/etf/[symbol]/page.test.tsx` (+adapterAvailable on fixtures, +marker-through-page case)
- changed: `app/page.test.tsx` (+AC8 missing-table-message case)
- changed: `app/api/cron/daily/route.test.ts` (RT-7b replaced with the named-constants budget
  check, +RT-7d)
- changed: `messages/en.json`, `messages/ro.json` (+`EtfDetail.extractionUnavailable`,
  +`Admin.operations.outcome.not_attempted`)
- changed: `dev_minions/architecture/data-model.md` (+`etf_report_links` table + write rule)
- changed (type-only, `EtfConfigDeps.now` fallout, no behaviour change): `lib/ai/chat.pglite.test.ts`,
  `lib/ai/capabilities/configuration/execute.pglite.test.ts`
- new (round-1 fix, W1): `test/helpers/pglite.migrations.test.ts` (PM-1/PM-2/PM-3)
- changed (round-1 fix, W3): `lib/ingestion/ingest-no-adapter.test.ts` (NA-5 tightened to exact
  counts over real fixtures)
- changed (round-1 fix, W4): `lib/admin/run-log.test.ts` (RL-9 code list, 8→9 codes)

### US-029 Phase A result: verdict ADAPTER, and a correction to requirements §3
Fetched ICBETNETF's live instrument page and its newest report PDF (network to bvb.ro was
reachable from this session). Two important findings, written up in full in
`spikes/icbetnetf/FINDINGS.md`:
1. **Requirements §3's "submit button, not a direct link" does not hold on the live page.**
   ICBETNETF's `gv5News` rows have the exact same shape as the three BRD fixtures: a decorative
   `<input type="submit">` plus a sibling `<a href="....pdf">`. `isDepositaryReportEntry`'s "van
   la data" prefix match already accepts ICBETNETF's row titles ("VAN la data …"). **No change
   to `lib/extraction/discovery.ts` is needed** — DEC-018 §2's in-memory form-post descriptor is
   not exercised by this ETF. Request count stays 2 (discovery + download), same as BRD; AC9's
   `MAX_REQUESTS_PER_ETF` needs no increase for ICBETNETF.
2. **"VAN instead of VUAN" is also only partly true**: the report prints both — "NAV per Unit
   VUAN" (per unit-class) and "VAN total (EUR)" (per-class total). Real structural difference:
   two unit classes (EUR-denominated Class A, RON-denominated Class B), each with its own NAV
   per unit / unit count / total NAV, no investor breakdown at all (BRD's `investors_*` /
   `units_held_*` have no equivalent — must go to `missingFields`, never guessed).
Verdict: **ADAPTER**. Cross-checked the extracted text against a second library
(`spikes/pdf-extraction/compare.mjs`, pdf-parse) — matches exactly.
Files saved this phase: `spikes/icbetnetf/FINDINGS.md`, `spikes/icbetnetf/extracted-text-sample.txt`,
`test/fixtures/bvb/ICBETNETF-instrument-2026-09-27.html` (+ README §8 added),
`test/fixtures/ICBETNETF-2026-09-24.pdf` (date from the report's own text). `expected.json` not
yet updated — the plan/implementation transcribes it independently, never from FINDINGS' excerpt.
No cookie value, hidden-field value or credential recorded anywhere.

## US-029 — closed out this round (Awaiting QA)
Round 1: review PASS (`US-029-review.md`, no Critical — N1 status.md bookkeeping lag, N2 AC4's
positive-header-value coverage is indirect for the ICBETNETF path but covered by the untouched
discovery.test.ts/pdf.test.ts), tests PASS (`US-029-tests.md`, 1575/1575 full suite, all 10
acceptance criteria MET). QA checklist written (`US-029-qa.md`). status.md → `Awaiting QA —
review PASS, tests PASS (round 1); Codex QA not yet run`. Verdict: **ADAPTER** — ICBETNETF's
report is a plain `<a href>` PDF link, same shape as the three BRD ETFs (Phase A spike correction
to requirements §3's "submit button" description); no discovery/http/pdf/ingest-etf/detect-adapter
change was needed. Ships: new `intercapital-nav` adapter (positional per-class-table rule,
documented in `spikes/icbetnetf/FINDINGS.md` §7), shared `lib/extraction/adapters/text.ts` helpers,
a 7-token BRD sub-search bound (AC8, Sprint 2 audit N3 closed), 8 new catalogue rows plus a
label-invariant test (AC10), and `MAX_REQUESTS_PER_ETF = 2` (AC9) wired into the cron and two new
add-time budget tests. D1 (which ICBETNETF figures share BRD's columns) ships its isolated
default and is logged under "Waiting on the user" below.

## Files changed (US-029, final)
- `dev_minions/verification/US-029-plan.md` (story-planner), `US-029-review.md`, `US-029-tests.md`, `US-029-qa.md` (new)
- new: `lib/extraction/adapters/text.ts`, `text.test.ts`, `intercapital-nav.ts`, `intercapital-nav.test.ts`
- new tests: `lib/extraction/discovery.icbetnetf.test.ts`, `lib/ingestion/request-bound.test.ts`,
  `lib/ingestion/ingest-icbetnetf.pglite.test.ts`
- changed: `lib/extraction/adapters/brd-depositary.ts` (imports helpers from `./text`; AC8 bound —
  `BRD_BLOCK_TOKENS = 7`), `brd-depositary.test.ts` (BB-1, BB-2 + a regression guard),
  `default-registry.ts` (registers `intercapitalNavAdapter`)
- changed: `lib/db/seed-data.ts` (+8 `intercapital-nav` catalogue rows), `seed-data.test.ts`
  (count 8→16, SL-1..SL-3 label-invariant test + self-check), `seed.pglite.test.ts` (count 8→16
  in SD-1/2/3)
- changed: `lib/extraction/fixtures.test.ts` (FX-1 generalised to any adapter's fieldKeys and
  non-seeded symbols; FX-5 generalised; FX-6 canHandle matrix new; FX-7 no-secret-leak scan new;
  BRD consistency block filtered to `brd-depositary` entries; FX-8 new for `intercapital-nav`
  sums + mis-anchoring guard; "not vacuous" now also requires an `intercapital-nav` entry)
- changed: `test/fixtures/expected.json` (ICBETNETF entry, independently transcribed and
  cross-checked against `spikes/pdf-extraction/compare.mjs`), `test/fixtures/README.md`
  (adapter-agnostic field-set wording, non-seeded-symbol capture note)
- changed: `lib/ingestion/run-daily.ts` (+`MAX_REQUESTS_PER_ETF = 2`)
- changed: `app/api/cron/daily/route.test.ts` (RT-7b uses the constant), `app/chat/page.test.tsx`
  (+CPG-4b add-time budget), `app/admin/etfs/page.test.tsx` (+PG-7b add-time budget)
- changed: `components/admin/TrackedFieldsAdmin.tsx` (`KNOWN_UNITS` +`"EUR"`), `messages/en.json`,
  `messages/ro.json` (`Admin.fields.units.EUR`)
- changed: `spikes/icbetnetf/FINDINGS.md` (+§7 positional-rule writeup, headers-not-kept line),
  `dev_minions/architecture/data-model.md` (write-rules wording: report-date footer → report-date
  text, BRD footer / InterCapital `Data:` line — wording only, no rule change)
- already saved in Phase A (unchanged this round): `spikes/icbetnetf/extracted-text-sample.txt`,
  `test/fixtures/bvb/ICBETNETF-instrument-2026-09-27.html`, `test/fixtures/bvb/README.md` (§8),
  `test/fixtures/ICBETNETF-2026-09-24.pdf`

## US-028 — round 2 fix closed out this round (Awaiting QA)
Reopened by the Sprint 6 tech-lead audit (`SPRINT-06-audit.md`) for C1, C2, W4, N4 (test-only
fixes, no application code changed — see findings below). Round 2: review PASS
(`US-028-review.md`, no Critical, no new Warning — independently re-derived file:line evidence for
all four fixes, did not just trust the audit's or each other's claims), tests PASS
(`US-028-tests.md`, typecheck/lint/build green, full suite 1478/1478 across 136 files; the one
full-run timeout in `app/chat/page.safety.test.tsx` CPS-1 is the same known flaky-under-concurrent-
load pattern seen on US-024/US-026, reproduced passing 5/5 in isolation — that file was untouched
this round). QA checklist updated (`US-028-qa.md`, round 2 section added). status.md → `Awaiting QA
— reopened by Sprint 6 tech-lead audit, round 2 fix ... review PASS + tests PASS`.

### Sprint 6 audit findings fixed this round (US-028)
- **C1** — AC2 required the shipped `createHomeTableLoader`/`createDrizzleEtfLoader` to be re-run
  and checked after each chat command; `lib/ai/chat.pglite.test.ts` CEP-1..4 only read rows
  directly. Fixed: each of CEP-1..4 now also calls both loaders and asserts on their output
  (XYZ listed, BTBETRETF omitted by both, `net_asset` column present, `nav_per_unit` gone from
  BTBETRETF's daily-job fields).
- **C2** — `app/actions.boundary.test.ts` passed a path relative to `app/` (e.g. `chat/actions.ts`)
  into `checkActionFile`, so a real relative `../../lib/...` import from an action file resolved
  outside `lib/` and was never flagged; the AB-4 self-check used an `app/`-prefixed fake path and
  didn't catch this. Fixed: line 76 now passes `` `app/${file}` ``, and a new AB-4 case runs the
  checker against a real action path (`app/chat/actions.ts`) with a relative `../../lib/ai/...`
  import and asserts it is flagged.
- **W4** — AC6 ("for each resolution reason") was chat-level-tested for only 2 of 5
  `ChatUnavailableReason`s. Fixed: `lib/ai/chat.test.ts`'s availability describe block is now
  `it.each(CHAT_UNAVAILABLE_REASONS)`, covering all five with overrides that trigger each reason
  via `resolveActiveProvider`; `app/chat/page.test.tsx` CPG-2 now also asserts the translated
  `Chat.replies.unavailable*` text per reason, not just "no textarea + admin link".
- **N4** — `README.md` still said the key variables were "Optional until the configuration chat
  ships (Sprint 6)". Fixed: rewritten to describe the current `/chat` behaviour, plus a new
  paragraph documenting `/chat` itself in the "Administration" section.

## US-028 — round 1 (superseded by round 2 above)
Round 1: review PASS (`US-028-review.md`, 4 non-blocking Notes, no Critical — plan/test naming
mismatches on two PGlite test names, a missing `expectTypeOf` regression guard, a missing README
line, one flaky test under concurrent load), tests PASS (`US-028-tests.md`, 1475/1475 full suite,
all 11 acceptance criteria MET with file:line evidence). Both verdicts missed C1/C2 above — the
Sprint 6 tech-lead audit caught them and reopened the story for round 2.

## Files changed (US-028, in flight)
- `dev_minions/verification/US-028-plan.md` (story-planner)
- new: `lib/ai/capabilities/configuration/execute.ts`, `lib/ai/chat.ts`, `app/chat/page.tsx`,
  `app/chat/actions.ts`, `app/chat/reply-messages.ts`, `app/actions.boundary.test.ts`,
  `components/chat/chat-state.ts`, `components/chat/transcript.ts`, `components/chat/ChatReply.tsx`,
  `components/chat/ChatPanel.tsx`, `components/chat/ChatView.tsx`
- new tests: `lib/ai/capabilities/configuration/execute.test.ts`, `execute.pglite.test.ts`,
  `lib/ai/chat.test.ts`, `lib/ai/chat.pglite.test.ts`, `app/chat/reply-messages.test.ts`,
  `app/chat/actions.test.ts`, `app/chat/actions.pglite.test.ts`, `app/chat/page.test.tsx`,
  `app/chat/page.safety.test.tsx`, `components/chat/ChatReply.test.tsx`,
  `components/chat/ChatPanel.test.tsx`, `components/chat/ChatView.test.tsx`,
  `components/chat/transcript.test.ts`
- changed: `components/AppHeader.tsx` (+`/chat` nav link), `components/AppHeader.test.tsx` (AH-1),
  `components/admin/AiSettingsAdmin.tsx` (chatUnavailableNote → chatLink), `app/admin/ai/page.test.tsx`
  (PA-5 updated, PA-10 new), `messages/en.json`, `messages/ro.json` (`Nav.chat`, `Chat.*`,
  `Admin.ai.chatLink`; `Admin.ai.chatUnavailableNote` removed), `lib/ai/boundaries.test.ts` (LB-0
  count 24, `chat.ts`/`execute.ts` added; LB-2 `ALLOWED_TARGETS` gains `lib/config/default-deps`,
  `lib/ai/provider-deps`, `lib/ai/capabilities/{generate,registry,configuration/execute}`),
  `lib/ai/capabilities/boundaries.test.ts` (CB-0 count 10, CB-4 exempts `execute.ts` + new
  CB-4-execute positive check)

## US-027 — closed out this round (Awaiting QA)
Round 1: review PASS (`US-027-review.md`, N1/N2 non-blocking notes — plan promised an explicit
`afterEach` "fetch never called" assertion that tests don't add, though the fake provider
structurally never reaches fetch so AC9 still holds; HANDOVER's "6 pre-existing warnings" line
corrected to 5, per the reviewer's own `pnpm lint` run), tests PASS (`US-027-tests.md`, 1330/1330
full suite, all 9 acceptance criteria MET with file:line evidence). QA checklist written
(`US-027-qa.md`). status.md → `Awaiting QA — review PASS, tests PASS (round 1); Codex QA not yet
run`. Manual/live QA (real Gemini/Groq language understanding, sprint-06.md steps 3-5) deferred to
US-028, since this story has no chat UI to exercise it through yet.
Files changed (US-027, final):
- `dev_minions/verification/US-027-plan.md` (story-planner), `US-027-review.md`, `US-027-tests.md`, `US-027-qa.md` (new)
- new: `lib/ai/capabilities/types.ts`, `lib/ai/capabilities/generate.ts`, `lib/ai/capabilities/registry.ts`,
  `lib/ai/capabilities/configuration/{context,intent,grounding,prompt,interpret,capability}.ts`,
  `test/helpers/ai-config-context.ts`
- new tests: `lib/ai/capabilities/registry.test.ts`, `lib/ai/capabilities/generate.test.ts`,
  `lib/ai/capabilities/boundaries.test.ts`, `lib/ai/capabilities/configuration/context.pglite.test.ts`,
  `lib/ai/capabilities/configuration/prompt.test.ts`, `lib/ai/capabilities/configuration/intent.test.ts`,
  `lib/ai/capabilities/configuration/grounding.test.ts`, `lib/ai/capabilities/configuration/interpret.test.ts`,
  `lib/ai/capabilities/configuration/interpret.pglite.test.ts`
- changed: `lib/ai/boundaries.test.ts` (LB-0 count 13→22 + new expected files, LB-2 `ALLOWED_TARGETS`
  gains `lib/config/etfs`, `lib/config/tracked-fields` and the 7 internal capability-file targets)

Denied or attempted commands: one `git diff --stat -- package.json pnpm-lock.yaml` attempted by
the reviewer mid-review to double-check no new dependency — denied, not retried; confirmed the
same fact (no new dependency) without git via `lib/ai/boundaries.test.ts` LB-7 passing and the
manifests being absent from "Files changed" (DEC-015).

## US-026 closed out (Awaiting QA) — see below.

## US-026 — closed out this round (Awaiting QA)
Round 1: review PASS (`US-026-review.md`, 1 non-blocking Note — reviewer didn't re-run the full
suite/build itself, that's the tester's gate), tests PASS (`US-026-tests.md`, 129/129 story-specific
tests, 1246/1248 full suite — 2 pre-existing/unrelated flaky timeouts in the fields-page and
cron-route tests). QA checklist written (`US-026-qa.md`). status.md →
`Awaiting QA — review PASS, tests PASS (round 1); Codex QA not yet run`.
Files changed (US-026, final):
- `dev_minions/verification/US-026-plan.md` (story-planner), `US-026-review.md`, `US-026-tests.md`, `US-026-qa.md` (new)
- new: `lib/ai/providers/http.ts`, `lib/ai/providers/gemini.ts`, `lib/ai/providers/openai-compatible.ts`,
  `lib/ai/providers/groq.ts`, `test/helpers/ai-http.ts`
- new fixtures: `test/fixtures/ai/README.md`, `test/fixtures/ai/gemini/{success,no-candidates,error-429,
  error-400-api-key-invalid,error-400-invalid-argument,error-404-model}.json`,
  `test/fixtures/ai/groq/{success,no-choices,error-429,error-401-invalid-key,error-404-model,
  error-400-json-validate-failed}.json`
- new tests: `lib/ai/providers/gemini.test.ts`, `lib/ai/providers/groq.test.ts`,
  `lib/ai/providers/openai-compatible.test.ts`, `lib/ai/providers/responses.test.ts`,
  `lib/ai/providers/errors.test.ts`, `lib/ai/providers/timeout.test.ts`,
  `lib/ai/provider-deps.interchange.test.ts`
- changed: `lib/ai/providers/default-registry.ts` (ships gemini+groq), `lib/ai/provider-catalog.ts`
  (trimmed to gemini+groq, sprint 6 decision 5), `lib/ai/provider-catalog.test.ts` (PC-1),
  `lib/ai/providers/registry.test.ts` (PR-5 replaced, PR-6 new), `lib/ai/boundaries.test.ts` (LB-0,
  LB-2(a), LB-4 widened to scan all of `lib/` — closes US-025 review W1; LB-8, LB-9 new),
  `lib/ai/env-example.test.ts` (EX-2, RM-1 new), `lib/ai/key-status.test.ts` (KS-2 catalogue-driven),
  `lib/ai/provider-deps.test.ts` (PD-7 catalogue-driven), `app/admin/ai/page.test.tsx` (PA-1/2/3/5
  catalogue-driven; PA-6b, PA-7b new), `app/admin/ai/actions.test.ts` (AA-7 title corrected, AA-7b
  new), `.env.example` (OpenRouter/Mistral blocks removed), `README.md` (env var + admin sections),
  `test/fixtures/README.md` (pointer to `ai/README.md`)

## US-025 — closed out this round (Awaiting QA)
Plan and implementation were already complete from an earlier (interrupted) session; `story-planner`'s
re-plan check confirmed every planned file exists and matches the plan, so it was not re-implemented.
Round 1: review PASS (`US-025-review.md`, W1 non-blocking warning, N1/N2 notes), tests PASS
(`US-025-tests.md`, 66 story-specific tests, 1187/1187 full suite — one isolated flaky timeout,
unrelated to `lib/ai/`, confirmed passing on retry). QA checklist written (`US-025-qa.md`).
status.md → `Awaiting QA — review PASS, tests PASS (round 1); Codex QA not yet run`.
W1 (non-blocking): tech-lead review point 2 asked the revised `LB-4` boundary test to scan the
whole `lib/` tree for importers of `key-status`; the shipped test widens it to include `lib/ai`
itself but not sibling `lib/*` folders. No live secrets leak (reviewer grepped and confirmed nothing
outside `lib/ai` imports `key-status` today) — a boundary-test coverage gap, not a criterion
failure. Recommend widening before/with US-026. Not reopened.
Files changed for US-025 (final):
- `dev_minions/verification/US-025-plan.md` (story-planner; re-plan check appended), `US-025-review.md`, `US-025-tests.md`, `US-025-qa.md` (new)
- new: `lib/ai/providers/types.ts`, `lib/ai/providers/run-generation.ts`, `lib/ai/providers/registry.ts`,
  `lib/ai/providers/default-registry.ts`, `lib/ai/providers/resolve.ts`, `lib/ai/provider-deps.ts`,
  `test/helpers/ai-fakes.ts`
- new tests: `lib/ai/providers/types.test.ts`, `lib/ai/providers/run-generation.test.ts`,
  `lib/ai/providers/registry.test.ts`, `lib/ai/providers/resolve.test.ts`, `lib/ai/provider-deps.test.ts`
- changed: `lib/ai/key-status.ts` (+`readApiKey`), `lib/ai/key-status.test.ts` (+KS-3..KS-5),
  `lib/ai/boundaries.test.ts` (LB-0, LB-2, LB-4 revised; LB-5..LB-7 new; LB-1/LB-3 verbatim)

Local gates green: `pnpm typecheck`, `pnpm lint` (0 errors, 3 pre-existing warnings), `pnpm test`
(1187/1187), `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY
-u MISTRAL_API_KEY pnpm build` (offline).

## US-024 — closed out this round (Awaiting QA)
Round 1: review PASS (`US-024-review.md`, N1/N2 non-blocking notes), tests PASS
(`US-024-tests.md`, 1129/1130 full-suite pass — 1 flaky unrelated timeout passes on retry — plus
238/238 targeted files). QA checklist written (`US-024-qa.md`). status.md →
`Awaiting QA — review PASS, tests PASS (round 1); Codex QA not yet run`.
Files changed for US-024 (final):
- `lib/ingestion/outcome.ts` (added `internal_error` to `INGEST_OUTCOME_CODES` and `IngestOutcome`)
- `lib/ingestion/ingest-etf.ts` (registry.get throw and outer ingestReport catch now `internal_error`)
- `lib/ingestion/run-daily.ts` (removed `InternalErrorOutcome`, `DailyEtfOutcome = IngestOutcome` alias)
- `lib/ingestion/job-run-summary.ts` (`RunStatus = FinalJobRunStatus` import from `job-runs.ts`)
- `lib/ingestion/outcome.test.ts` (OC-8a: 8 codes)
- `lib/ingestion/ingest-etf.test.ts` (IE-6c changed, IE-6d new)
- `lib/ingestion/ingest-etf.failures.test.ts` (IF-8a +internal_error, IF-8b registry.get thrower, IF-8c rewritten order-independent)
- `lib/ingestion/job-run-summary.test.ts` (JS-3c new)
- `lib/ingestion/run-daily.test.ts` (RD-T new type test)
- `lib/admin/run-log.ts`, `lib/admin/run-log.test.ts` (new — log parser)
- `lib/admin/operations.ts`, `lib/admin/operations.pglite.test.ts` (new — three read models)
- `lib/admin/operations-messages.test.ts`, `lib/admin/boundaries.test.ts` (new)
- `lib/format/datetime.ts`, `lib/format/datetime.test.ts` (new)
- `components/admin/OperationsDashboard.tsx`, `components/admin/OperationsDashboard.test.tsx` (new)
- `components/admin/sections.ts` (added `/admin/operations`)
- `app/admin/operations/page.tsx`, `page.test.tsx`, `page.pglite.test.tsx` (new)
- `app/admin/layout.test.tsx` (AL-5 added)
- `messages/en.json`, `messages/ro.json` (new `Admin.nav.operations`, `Admin.operations.*`)
- `dev_minions/verification/US-024-plan.md` (already existed, by story-planner), `US-024-review.md`, `US-024-tests.md`, `US-024-qa.md` (new)

Local gates green: `pnpm typecheck`, `pnpm lint` (0 errors, 3 pre-existing warnings), `pnpm test`
(1130/1130, 101 files), `env -u DATABASE_URL pnpm build` (offline, includes new `/admin/operations` route).

Denied or attempted commands: one `git status` I attempted mid-story out of habit before writing the
QA checklist — denied, not retried (DEC-015).

## US-023 — closed out this round (Awaiting QA)
Round 1: review PASS (`US-023-review.md`, W1/N1 non-blocking notes), tests PASS
(`US-023-tests.md`, 1078/1078). QA checklist written (`US-023-qa.md`). status.md →
`Awaiting QA — review PASS, tests PASS (round 1); Codex QA not yet run`.
Files changed for US-023 (final):
- `dev_minions/verification/US-023-plan.md` (new, by story-planner)
- `lib/config/cron.ts` (new — `parseDailySchedule`, `findDailySchedule`, `effectiveSchedule`, `formatHourWindow`, `suggestedScheduleLine`, `scheduleChangeNeeded`, `getCronHour`, `setCronHour`; static import of `vercel.json`)
- `lib/config/default-deps.ts` (added `createCronConfigDeps`)
- `lib/config/cron.test.ts`, `lib/config/cron.pglite.test.ts` (new)
- `lib/config/boundaries.test.ts` (BC-7, BC-8 added for cron.ts and the cron/ingestion boundary)
- `components/admin/CronAdmin.tsx` (new)
- `components/admin/sections.ts` (added `/admin/cron` section)
- `components/admin/ActionMessage.test.tsx` (AM-4 case added)
- `app/admin/cron/page.tsx`, `app/admin/cron/actions.ts`, `app/admin/cron/result-messages.ts` (new)
- `app/admin/cron/page.test.tsx`, `app/admin/cron/actions.test.ts`, `app/admin/cron/result-messages.test.ts` (new)
- `app/admin/layout.test.tsx` (AL-4 added for the cron nav link)
- `lib/cron/vercel-config.test.ts` (removed the value-pin test per Sprint 3 decision 3's "before US-023" wording; added RD-1 README test)
- `messages/en.json`, `messages/ro.json` (new `Admin.nav.cron`, `Admin.cron.*`, `Admin.messages.{cronSaved,cronCleared,invalidHour}`)
- `README.md` (cron section rewritten to point at `/admin/cron`; "Administration" section extended)
- `dev_minions/architecture/data-model.md` (`cron_hour_utc` note updated, no rule change)
- `dev_minions/backlog/stories/US-023.md` (drafted by story-planner)

Local gates green: `pnpm typecheck`, `pnpm lint` (0 errors, 3 pre-existing warnings), `pnpm test` (1078/1078, 93 files), `env -u DATABASE_URL pnpm build` (offline, includes new `/admin/cron` route). `vercel.json` itself was not edited.

## US-022 — closed out this round (Awaiting QA)
Round 1: review PASS (`US-022-review.md`, W1/N1 non-blocking notes), tests PASS
(`US-022-tests.md`, 1022/1022). QA checklist written (`US-022-qa.md`). status.md →
`Awaiting QA — review PASS, tests PASS (round 1); Codex QA not yet run`.
Files changed for US-022 (final):
- `dev_minions/verification/US-022-plan.md` (new, by story-planner)
- `lib/ai/provider-catalog.ts` (new — static `PROVIDER_CATALOG`, `PROVIDER_IDS`, `findProvider`)
- `lib/ai/key-status.ts` (new — `getKeyStatuses`, the only file reading a provider key env var)
- `lib/ai/settings-deps.ts` (new — `createAiSettingsDeps`, wiring; keeps `lib/config` free of `/ai/` imports per DEC-016 §1 / BC-1)
- `lib/config/ai-settings.ts` (new — `getAiSettings`, `setAiSettings`, `AI_MODEL_MAX_LENGTH`)
- `lib/ai/provider-catalog.test.ts`, `lib/ai/key-status.test.ts`, `lib/ai/boundaries.test.ts`, `lib/ai/env-example.test.ts` (new)
- `lib/config/ai-settings.test.ts`, `lib/config/ai-settings.pglite.test.ts` (new)
- `lib/config/boundaries.test.ts` (BC-6 added for ai-settings.ts)
- `components/admin/AiSettingsAdmin.tsx` (new)
- `components/admin/sections.ts` (added `/admin/ai` section)
- `components/admin/ActionMessage.test.tsx` (AM-3 case added)
- `app/admin/ai/page.tsx`, `app/admin/ai/actions.ts`, `app/admin/ai/result-messages.ts` (new)
- `app/admin/ai/page.test.tsx`, `app/admin/ai/actions.test.ts`, `app/admin/ai/result-messages.test.ts` (new)
- `app/admin/layout.test.tsx` (AL-3 added for the AI nav link)
- `messages/en.json`, `messages/ro.json` (new `Admin.nav.ai`, `Admin.ai.*`, `Admin.messages.{aiSaved,aiCleared,unknownProvider,invalidModel}`)
- `.env.example` (four provider API key variables, each commented)
- `README.md` (env var section + `/admin/ai` note in "Administration")
- `dev_minions/backlog/stories/US-022.md` (drafted by story-planner)

Local gates green: `pnpm typecheck`, `pnpm lint` (0 errors, 3 pre-existing warnings), `pnpm test` (1022/1022, 88 files), `env -u DATABASE_URL pnpm build` (offline, includes new `/admin/ai` route).

## US-020 / US-021 — earlier this sprint (Awaiting QA, Codex QA PASS for both)
Full "Files changed" lists are on the status.md Story board and in `US-020-qa.md`/`US-021-qa.md`;
trimmed here to keep this file short. US-021 also fixed 3 pre-existing TypeScript errors in
`lib/config/tracked-fields.pglite.test.ts` that had blocked US-020's Codex QA.

## Failing / open
- US-020, US-021, US-022: none — Awaiting QA (Codex QA already PASS for all three, see log).
- US-023, US-024, US-025, US-026: none — closed out, Awaiting QA.
- Sprint 5 audit FINDINGS (no Critical, no story reopened): W1-W4 process/test-citation notes, logged below.

## Exact next step
- US-029 done this round (Awaiting QA, see above). Next: pick US-030 (no-adapter degradation path,
  end to end) — Ready. US-031 (end-to-end verification on the real deployment) stays Blocked until
  both US-029 and US-030 reach Awaiting QA or Done.

## Waiting on the user
- Consolidated list (security, product decisions, acceptances, live checks, git): `status.md` → "Waiting on you". The PO keeps that list; add only **new** items below, one line each.
- Kit update (DEC-014, DEC-015): run `bash scripts/claude/install-kit.sh` before restarting the autopilot; start Codex with `automation/qa-goal.txt` right after.
- Sprint 5 decision #9 (US-022, API keys): default ships (provider/model selection in full; keys stay as Vercel env vars, page shows only set/unset). Confirm, or ask for in-app key entry (would need its own credentials DEC).
- Sprint 5 decision #11 (US-023, cron hour): default ships (admin stores the hour, shows the exact `vercel.json` line to change; takes effect after your commit + redeploy). Confirm, or ask for an automatic path (would need a Vercel token/credential).
- Sprint 5 audit N3 (US-020, AC7): re-detect currently clears a working adapter to NULL even on a transient network error, since that is the literal AC7 reading. Confirm this is wanted, or ask for the stored adapter to survive a transient failure (a behaviour change, not just a decision).
- Sprint 6 review, information item: once US-028 ships, anyone with the `/chat` URL can use up the free-tier AI quota (no login, per requirements §6). Not a decision, just something to know.
- Sprint 6 decision #5 (US-026, which two free providers): default ships — Google Gemini and Groq, confined to `provider-catalog.ts`/`default-registry.ts` (+ the two adapter files, `.env.example`, README). Confirm, or name a different pair (an OpenAI-compatible one is one factory entry to swap).
- Sprint 7 product items #4/#5/#9/#10/#12 (US-029/US-030, isolated defaults ship — see status.md P12–P15):
  symbol stays plain text with no direct PDF URL (recommendation: link to `bvb_url` instead); the
  no-adapter link is the newest report-discovery PDL; the ETF detail page shows "extraction unavailable"
  too; `/health`'s raw exception text stays as accepted in US-006 (recommendation: show it only for
  known-safe cases). Confirm each, or ask for the recommended alternative.
- US-029 plan decision D1 (isolated default ships): which ICBETNETF figures share the BRD ETFs'
  home-table columns. Default ships option (a) — the Class B (BVB-listed) NAV per unit and units
  reuse `nav_per_unit`/`units_in_circulation`; everything else (6 figures) gets its own key. Answer
  before tracking ICBETNETF fields live in `/admin/etfs` — stored history stays under whichever key
  was live at the time (`field_key` is not an FK, so a later change doesn't retag old rows).
- Note for the PO (not agent-editable, `dev_minions/requirements/`): US-029's live investigation found
  requirements §3 is stale for ICBETNETF — its report is a plain PDF link (not a "submit button"), and
  it prints both "VAN" and "VUAN" terms for the same figure. See `spikes/icbetnetf/FINDINGS.md`.

## Log (newest first, one line each)
- 2026-09-27 — US-029 (ICBETNETF report access) round 1: review PASS (no Critical, 2 non-blocking
  notes), tests PASS (1575/1575 full suite, all 10 acceptance criteria MET); QA checklist written;
  status.md → Awaiting QA. Verdict ADAPTER: the live report turned out to be a plain PDF link like
  the three BRD ETFs (Phase A spike correction to requirements §3), so no discovery/http/pdf/
  ingest-etf/detect-adapter change was needed — only a new `intercapital-nav` adapter, shared text
  helpers, a bounded BRD sub-search (closes Sprint 2 audit N3), 8 catalogue rows + a label-invariant
  test, and `MAX_REQUESTS_PER_ETF`. D1 (which figures share BRD's columns) ships its isolated
  default, logged under "Waiting on the user". Picking US-030 (no-adapter degradation path) next.
- 2026-09-27 — Sprint 7 (US-029..031, hardening) detailed (story-planner, `sprint-07.md` +
  `stories/US-029..031.md`) and reviewed (tech-lead, APPROVED, `SPRINT-07-review.md`). Fixed in
  review: US-029 wording (fixture "save" not "commit", FALLBACK-branch discovery caveat, form-post
  header/redirect/no-leak details, sub-search bound specifics), US-030 wording (form-vs-chat ignored
  columns, schema-test-count note, deadline clock source). DEC-018 recorded Decided (report-access
  form-post lives in discovery as an in-memory descriptor; shared field-key labels; new
  `etf_report_links` table; run deadline guard with `not_attempted`), binding beyond this sprint.
  Product items #4/#5/#9/#10/#12 all ship isolated defaults (status.md P12–P15). US-029, US-030 added
  to status.md as Ready; US-031 Blocked on both (depends on both per sprint file). Picking US-029
  (ICBETNETF investigation) next — most likely to reveal a live-access block early.
- 2026-09-27 — US-028 round 2 fix (reopened by the Sprint 6 tech-lead audit for C1, C2, W4, N4 —
  all test-only, no application code changed): review PASS, tests PASS (1478/1478 full suite);
  `US-028-qa.md` updated with the round-2 evidence; status.md → Awaiting QA. Every Sprint 6 story
  (US-025..028) is now Awaiting QA and the sprint's tech-lead audit's only finding is resolved.
  Detailing Sprint 7 (US-029..031, hardening) next.
- 2026-09-27 — US-027 (intent extraction: natural language → configuration action) round 1: review
  PASS (2 non-blocking notes), tests PASS (1330/1330, all 9 acceptance criteria MET); QA checklist
  written; status.md → Awaiting QA. Ships the capability system (`lib/ai/capabilities/`), the
  configuration prompt/parser/grounding pipeline, and the `interpretConfigurationRequest` entry
  point — executes nothing, writes nothing. Manual/live language-understanding QA deferred to
  US-028 (no chat UI yet to exercise it through). Picking US-028 next, the last Sprint 6 story.
- 2026-09-27 — US-026 (two concrete free providers behind the interface) round 1: review PASS (1
  non-blocking Note), tests PASS (129/129 story tests, 1246/1248 full suite — 2 pre-existing
  unrelated flaky timeouts); QA checklist written; status.md → Awaiting QA. Gemini and Groq now
  ship as the two catalogue/registry providers (Sprint 6 decision #5 isolated default). Picking
  US-027 (intent extraction) next.
- 2026-09-27 — US-025 (pluggable LLM provider adapter interface) round 1: plan and implementation
  already existed from an earlier interrupted session (`story-planner` re-plan check confirmed
  every planned file matches); review PASS (W1 non-blocking: LB-4 boundary test should widen to
  scan all of `lib/`, not just `lib/ai` — no live secrets leak found), tests PASS (66 story tests,
  1187/1187 full suite); QA checklist written; status.md → Awaiting QA. Picking US-026 (concrete
  free providers) next.
- 2026-09-26 — Sprint 6 detailed (story-planner, `sprint-06.md`, `stories/US-025..028.md`) and reviewed
  (tech-lead, APPROVED, `SPRINT-06-review.md`). Fixed in review: US-026's key-rejection detection
  (Gemini answers an invalid key with HTTP 400 `API_KEY_INVALID`, not 401/403) plus new `model_not_found`
  (404) and Groq's `bad_response` (400 `json_validate_failed`) codes; US-027 AC4's VUAN-tracking example
  (the seed already tracks it for BTBETRETF); five plan additions to US-028 (no-key provider view, reply
  wording for the new error codes, double-remove-inactive guard, quota note). DEC-017 (AI provider layer:
  interface shape/closed errors, key routing, one capability system) recorded Decided, binding beyond
  this sprint. Product decisions #4/#5/#9/#10/#11/#12 all ship isolated defaults. US-025..028 added to
  status.md as Ready. Picking US-025 (provider adapter interface) next.
- 2026-09-26 — Sprint 5 audit (`SPRINT-05-audit.md`): FINDINGS, no Critical, no story reopened. W1 (US-020
  test verdict cites test ids/line numbers that don't exist), W2 (no test proves Server Actions contain no
  SQL — add before/with the first Sprint 6 chat action), W3 (missing/mislabelled "deps factory throws" tests
  in US-020/022/023 — code itself is safe), W4 (US-024 test verdict misdescribes PG-1's coverage and reports
  "1129/1130" together with exit 0, self-contradictory — the full-suite pass is otherwise verified). N1: the
  audit's own log-scan for undisclosed git/secret commands was denied and not retried, so that check is
  incomplete this round. N3 (for the PO at the next demo): US-020's re-detect clears a working adapter to
  NULL on a transient network error too, as AC7 is drafted — confirm this is the wanted behaviour. Picking
  up Sprint 6 detailing next (US-025..028, AI configuration).
- 2026-09-26 — US-024 (operational dashboard) round 1: review PASS (N1/N2 non-blocking), tests PASS (1130/1130 full suite, plus 238/238 targeted); QA checklist written; status.md → Awaiting QA. Fixed Sprint 3 audit N4/N5 (new `internal_error` outcome code; `registry.get` throw and the `ingestReport` outer-catch defensive net now labelled correctly instead of `no_adapter`/`persist_error`; IF-8c made order-independent). New `lib/admin/{run-log,operations}.ts` (log parser + three read-only PGlite-tested statements) and `lib/format/datetime.ts` (Europe/Bucharest, DST-tested) plus `/admin/operations`. Every Sprint 5 story (US-020..024) is now Awaiting QA — running the tech-lead sprint-5 audit next, then detailing Sprint 6.
- 2026-09-26 — US-023 (cron hour setting) round 1: review PASS (W1/N1 non-blocking), tests PASS (1078/1078); QA checklist written; status.md → Awaiting QA. New `lib/config/cron.ts` (effective schedule read from a static `vercel.json` import, never `fs` at runtime; the cron route never reads `cron_hour_utc`, BC-8) plus `/admin/cron`; removed Sprint 3's fixed-schedule-value test per its own "before US-023" wording. Picking US-024 (operational dashboard) next, the last Sprint 5 story.
- 2026-09-26 — US-022 (AI provider/API key settings) round 1: review PASS (W1/N1 non-blocking), tests PASS (1022/1022); QA checklist written; status.md → Awaiting QA. New `lib/ai/` module (provider catalogue, key-status, settings-deps) plus `/admin/ai`; DEC-016 §1 respected (allowed provider ids injected, `lib/config/ai-settings.ts` never imports `lib/ai`). Picking US-023 (cron hour) next.
- 2026-09-26 — US-021 (tracked-field management) round 1: review PASS (W1/N1/N2 non-blocking), tests PASS (960/960); QA checklist written; status.md → Awaiting QA. Fixed 3 pre-existing typecheck errors in `lib/config/tracked-fields.pglite.test.ts` that had blocked US-020's Codex QA (`US-020-qa-run.md`) — US-020 unblocked for re-QA. Picking next Sprint 5 story (US-022/023/024).
- 2026-09-26 — US-020 (admin ETF management) round 1: review PASS, tests PASS (901/901); QA checklist written; status.md → Awaiting QA. Picked US-021 (tracked-field management) next, dependency (US-020) satisfied by Awaiting QA.
- 2026-09-25 — Technical Lead review of decisions, planning and code-review kit: DEC-014 (Codex QA loop runs only while the dev loop runs: `dev-loop.state` written by `autopilot.sh`, checked with `scripts/claude/dev-loop-status.sh`), DEC-015 (secrets beyond `.env*` + deny rules, disclose denied commands, verifiers cite only their own evidence, one verdict vocabulary, product questions ship isolated defaults, installer tidies backups and archived duplicates). Updated AGENTS.md, CLAUDE.md, roles/qa.md, roles/technical-lead.md, data-model.md, pending-kit; old DECs got amendment notes; `status.md` only in its Technical Lead section plus "Waiting on you" item 5. No code, story state, requirements or backlog touched.
- 2026-09-25 — PO docs cleanup: rewrote `status.md`, `process.md`, `README.md`, this file, `roles/`, `backlog/README.md`, `verification/README.md`; added `decisions/README.md` and roadmap carry-forward notes; old versions and the full per-story log moved to `_obsolete/`. No code touched.
- 2026-09-25 — Sprint 4 (US-016..019, monitoring UI) delivered; US-016 via the Copilot fallback. Audit: FINDINGS — C1 token printed into two local logs (user action), W1–W4 process/test notes; no story reopened.
- 2026-09-25 — Sprint 3 (US-012..015, cron + persistence) delivered. Audit reopened US-015 (AC4 test missing); fixed in round 2; US-015 accepted by the user after checking the Vercel cron logs.
- 2026-09-24 — DEC-013: QA and deploy-noticing moved to a separate Codex loop; this loop stops at Awaiting QA.
- 2026-09-24 — Sprint 2 (US-007..011, extraction core) delivered, audit PASS. `unpdf` pinned to 0.11.0 (1.8.1 breaks the flattened-text contract).
- 2026-09-23 — Sprint 1 (US-001..006, foundation) delivered, audit PASS; deployed to Vercel + Neon by the user.
- 2026-09-23 — Autopilot kit installed (DEC-009), made resilient to usage limits and network drops (DEC-011).
- Full per-story log before 2026-09-25 23:00: `_obsolete/HANDOVER-2026-09-25.md`.

## QA/Deploy log (Codex)
_Owned by the separate Codex QA/Deploy loop (DEC-013) — it appends here only, newest last, and
never edits anything above this line. The dev loop (Claude Code) never writes to this section.
Entries up to 2026-09-25 16:25 (US-008..US-018 QA PASS, pushes, `/health` check) are archived in
`_obsolete/HANDOVER-2026-09-25.md`; their results are on the `status.md` Story board._
- 2026-09-25 23:38 — dev loop not running (`WAITING-LIMIT`; resumes about 2026-09-26 01:31:30); QA loop stopped.
- 2026-09-26 12:12 — US-019 QA PASS: 66 focused chart/PGlite/component/boundary checks, frozen install, typecheck, lint, and an offline production build passed. One concurrent full-suite timeout in an existing home-page test passed on isolated retry; one concurrent build lock cleared on retry. Local RO/EN ETF pages returned HTTP 200 with translated safe no-database states; server stopped. Ready for the user to commit and push. Live chart visual/tooltip checks remain in `US-019-qa-run.md`.
- 2026-09-26 12:42 — dev loop not running (`WAITING-LIMIT`; resumes about 2026-09-26 13:51:30); QA loop stopped before starting US-020.
- 2026-09-26 12:53 — US-020 QA BLOCKED (user-requested exception to the dev-loop gate): 119 focused seed/config/detection/admin/bilingual tests and frozen install passed; lint had 0 errors. Project typecheck and local QA-server build are blocked by three TypeScript errors in in-progress US-021 test file `lib/config/tracked-fields.pglite.test.ts` (lines 149, 167, 288), so no US-020 failure was found. Re-run after US-021 resolves the shared typecheck blocker; details in `US-020-qa-run.md`.
- 2026-09-26 14:22 — US-020 QA PASS: the formerly blocked shared gates now pass: typecheck plus the full suite (960/960), lint (0 errors; 3 existing warnings), and production build. Local `/admin` plus `/admin/etfs` in RO and EN returned HTTP 200 with safe no-database states; server stopped. Awaiting user acceptance; live Neon/BVB checks remain in `US-020-qa-run.md`.
- 2026-09-26 14:26 — US-021 QA PASS: 77 focused tracked-field/admin/i18n tests, typecheck plus full suite (960/960), lint (0 errors; 3 existing warnings), and production build passed. Local Fields page in RO and EN returned HTTP 200 with translated safe no-database states; server stopped. Awaiting user acceptance; live Neon and next-cron checks remain in `US-021-qa-run.md`.
- 2026-09-26 15:25 — US-022 QA PASS: 93 focused AI-settings/privacy/i18n tests, typecheck plus full suite (1078/1078), lint (0 errors; 3 existing warnings), and production build passed. Local `/admin/ai` in RO and EN returned HTTP 200, displayed only key names and safe `not set` markers, and exposed no values; server stopped. Ready for the user to commit and push; live Neon/Vercel and product-decision checks remain in `US-022-qa-run.md`.
- 2026-09-26 15:34 — US-023 QA PASS: 92 focused cron/config/page/i18n tests, typecheck plus full suite (1078/1078), lint (0 errors; 3 existing warnings), and production build passed. Local `/admin/cron` in RO and EN returned HTTP 200 with the effective UTC window and translated safe no-database states; server stopped. Ready for the user to commit and push; live Neon/Vercel and product-decision checks remain in `US-023-qa-run.md`.
- 2026-09-26 15:35 — dev loop not running (`WAITING-LIMIT 2026-09-26 15:29:40 — Claude usage limit, resumes about 2026-09-26 18:51:30`); QA loop stopped.
- 2026-09-26 20:27 — dev loop not running (`WAITING-LIMIT 2026-09-26 20:27:01 — Claude usage limit, resumes about 2026-09-26 23:51:30`); QA loop stopped.
- 2026-09-26 21:07 — US-024 QA PASS (user-requested exception to the dev-loop gate): 172 focused ingestion/admin/dashboard/i18n tests, typecheck plus full suite (1187/1187), lint (0 errors; 3 existing warnings), and production build passed. Local `/admin/operations` in RO and EN returned HTTP 200 with translated safe no-database states; server stopped. Ready for the user to commit and push; live Neon and product-judgment checks remain in `US-024-qa-run.md`.
- 2026-09-27 06:15 — dev loop not running (`WAITING-LIMIT 2026-09-27 06:15:00 — Claude usage limit, resumes about 2026-09-27 09:51:30`); QA loop stopped.
- 2026-09-27 08:31 — US-025 QA PASS (user-requested exception to the dev-loop gate): 127 focused provider-layer/privacy/boundary tests, typecheck plus full suite (1478/1478), lint (0 errors; 5 existing warnings), and build with DB/provider variables unset passed. Local `/admin/ai` in RO and EN returned HTTP 200 with safe no-database/key-unset states; server stopped. Ready for the user to commit and push; live-provider check remains in `US-025-qa-run.md`.
- 2026-09-27 08:40 — US-026 QA FAIL (user-requested exception to the dev-loop gate): 152 focused provider/catalogue/admin/privacy tests and typecheck passed, but the full suite failed twice at 1477/1478 because `app/chat/page.safety.test.tsx` CPS-1 times out only in the parallel full run (it passes alone, 5/5). Reopened for the technical lead; details in `US-026-qa-run.md`. No lint/build/local smoke was claimed after the blocking gate failure.
- 2026-09-27 08:47 — US-027 QA PASS (user-requested exception to the dev-loop gate): 66 focused capability/context/parser/grounding tests, typecheck plus full suite (1478/1478), lint (0 errors; 5 existing warnings), and an offline production build passed. This is a capability-only story: it adds no UI or live request; the real RO/EN provider-language checks remain deferred to US-028’s chat QA. Ready for the user to commit and push; details in `US-027-qa-run.md`.
- 2026-09-27 08:50 — US-026 QA PASS after recheck (user-requested exception to the dev-loop gate): the subsequent full project gate passed at 1478/1478; lint had 0 errors (5 existing warnings), offline build passed, and local `/admin/ai` returned HTTP 200 showing only Gemini/Groq and key-unset markers. The prior two CPS-1 full-suite timeouts are retained in `US-026-qa-run.md` as an intermittent, unrelated timing note; its isolated safety test passed 5/5. Ready for the user to commit and push.
- 2026-09-27 10:49 — US-028 QA PASS: 236 focused chat/action/capability/boundary checks plus the isolated CPS-1 safety retry (5/5), typecheck plus full suite (1478/1478), lint (0 errors; 5 existing warnings), and offline build passed. Local `/chat` and `/admin/ai` in RO and EN returned HTTP 200 with translated safe no-database/key-unset states; server stopped. CPS-1 timed out in an earlier concurrent focused/full run but passed in isolation and on the successful full retry; documented in `US-028-qa-run.md`. Ready for the user to commit and push; live provider/Neon checks remain for the user.
- 2026-09-27 15:52 — dev loop not running (`WAITING-LIMIT 2026-09-27 15:52:02 — Claude usage limit, resumes about 2026-09-27 19:51:30`); QA loop stopped before starting US-029.
- 2026-09-27 16:39 — US-029 QA BLOCKED (user-requested override while the dev loop is paused): 232 focused ICBETNETF/discovery/adapter/fixture/ingestion/catalogue/request-bound tests passed. The shared full suite hit the recurring CPS-1 concurrent-load timeout (1574/1575); CPS-1 passed alone (5/5). A full-suite retry must pass before US-029 can be marked QA PASS; details in `US-029-qa-run.md`.
- 2026-09-27 22:17 — US-030 QA BLOCKED (user-requested override while the dev loop is paused): 277/278 focused no-adapter/report-link/migration/deadline/recovery/UI tests passed; `lib/cron/deadline.pglite.test.ts` timed out in concurrent setup but passed alone (1/1). A clean focused/full retry is required before QA PASS; details in `US-030-qa-run.md`.
