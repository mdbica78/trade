# Sprint 6 audit: AI natural-language configuration

Auditor: tech-lead subagent (in-loop, DEC-009), 2026-09-27.

Scope: US-025 to US-028. All four are Awaiting QA, none is in progress, none is Blocked, and there is no escalation. For each story I read:
- the story (including its tech-lead review) and the review and test verdicts;
- `sprint-06.md` (the decisions table and the Definition of Done);
- the changed code: `lib/ai/providers/{http,gemini,groq,openai-compatible}.ts`, `lib/ai/capabilities/configuration/{intent,grounding,execute}.ts`, `lib/ai/chat.ts`, `app/chat/{page.tsx,actions.ts,reply-messages.ts}`, `components/chat/*.tsx`, and both message catalogues (`Chat.*`);
- the key tests: `lib/ai/chat.pglite.test.ts`, `lib/ai/chat.test.ts`, `app/chat/page.test.tsx`, `app/actions.boundary.test.ts`, `lib/ai/boundaries.test.ts` (LB-4), `lib/ai/providers/resolve.test.ts`, `lib/ai/provider-deps.test.ts`, `lib/config/boundaries.test.ts`.

I grepped every test id the eight verdict files cite.

Commands I ran (with `NODE_EXTRA_CA_CERTS` exported):
- `pnpm test` (once): **136 files, 1475/1475 passed**, exit 0.
- A `node -e` replica of `resolveSpecifier` from `app/actions.boundary.test.ts` (see C2). Output: `chat/actions.ts` + `../../lib/ai/provider-deps` resolves to `../lib/ai/provider-deps`; `app/fake/actions.ts` + `../../lib/ingestion/store` resolves to `lib/ingestion/store`.

Independent checks, beyond reading the verdicts:
- **Adapters (US-026).** `lib/ai/providers/http.ts` builds every result as a fresh literal. A caught value, the status text or the body never reaches a result. `redirect: "error"` is set. `gemini.ts` puts the key only in `x-goog-api-key` and runs the model through `encodeURIComponent`. The 400 `API_KEY_INVALID` rule reads only `details[].reason`.
- **Key boundary (US-025, US-026).** LB-4 now walks `app/`, `components/` and all of `lib/` (`lib/ai/boundaries.test.ts:180-184`). US-025 review W1 is closed.
- **Grounding (US-027).** `grounding.ts` uses the `[\p{L}\p{N}]+` token rule. `add_etf` keeps a name only if the message contains it verbatim. `track_field` requires an *available* field. `parseConfigurationOutput` never throws.
- **Chat (US-028).** `lib/ai/chat.ts:63-69` validates the length before the deps factory runs. It returns on any `!active.ok` before the context load (`:84-86`). Every `catch` is bare. `execute.ts:66` maps `name ?? symbol`. `app/chat/actions.ts` reads only `message`. Every reply is a `Chat.replies` key, and the `en` and `ro` key sets match.

Verdict: FINDINGS

## Critical

**C1 (US-028): AC2's loader clauses are untested, and both verdicts mark AC2 MET.**
- AC2 (`backlog/stories/US-028.md:78-83`) is written as a PGlite test specification:
  - "the shipped home-table loader then lists `XYZ`";
  - "the home-table and daily-job loaders omit it";
  - "the home-table columns include it".
- Task 9 repeats it: "After each action, the shipped home-table and daily-job loaders are re-run (DEC-016 §4)". So does the sprint Definition of Done: "The home-table and daily-job loaders follow (PGlite, shipped statements)".
- `lib/ai/chat.pglite.test.ts` CEP-1 to CEP-4 (`:50-113`) only read `etfs` and `tracked_fields` directly with `db.pg.query`. No file under `lib/ai/`, `app/chat/` or `components/chat/` references `createHomeTableLoader`, `lib/monitoring/home` or `createDrizzleEtfLoader` (grep: no match).
- The reviewer (`US-028-review.md:15-24`) says the column is proven "`createHomeTableLoader`-equivalent … via direct row read" and still marks MET. The tester (`US-028-tests.md:26-34`) marks MET without mentioning the loader clauses.
- The behaviour is very likely right. The chat calls the same `lib/config/` functions whose own PGlite tests re-run the loaders (CE-R1/CE-R2 in `lib/config/etfs.pglite.test.ts`, HF-1/DJ-1 in `lib/config/tracked-fields.pglite.test.ts`). But the criterion as written is not met. That is the same situation as Sprint 3's C1 (US-015), which reopened that story.
- **Fix (test-only):** in `lib/ai/chat.pglite.test.ts`, after each of CEP-1 to CEP-4, run the shipped `createHomeTableLoader` (`lib/monitoring/home.ts`) and `createDrizzleEtfLoader` (`lib/ingestion/load-etfs.ts`) against the same PGlite database. Assert that:
  - CEP-1: the home table lists `XYZ`;
  - CEP-2: both loaders omit `BTBETRETF`;
  - CEP-3: the home-table columns include `net_asset`;
  - CEP-4: `nav_per_unit` is gone from BTBETRETF's daily-job fields.
  This matches how `lib/config/etfs.pglite.test.ts` CE-R1/CE-R2 do it.

**C2 (US-028): the action-boundary test cannot catch a relative `lib/` import in a real action file.**
- `app/actions.boundary.test.ts:76` calls `checkActionFile(file, source)`. Here `file` is relative to `app/` (e.g. `chat/actions.ts`). `resolveSpecifier` joins relative specifiers against that path. So a real relative import from `app/chat/actions.ts`, such as `../../lib/ai/provider-deps`, resolves to `../lib/ai/provider-deps`. That does not start with `lib/`, so it is **not flagged**. My `node -e` replica above shows this.
- The AB-4 self-check (`:93`, `:102`) passes `"app/fake/actions.ts"`, which carries the `app/` prefix. So the self-check passes while the real scan is blind to the relative form.
- Sprint decision 14 (Decided, tech-lead 2026-09-26) requires "`lib/` specifiers are matched in both `@/lib/…` and relative form". AC9 requires the test to fail on "a `lib/` import outside the allowlist". This is a test that passes against a broken implementation, and both verifiers marked AC9 MET.
- No action file uses a relative `lib/` import today (all use `@/lib/…`), so nothing is violated now. The guard itself is defective.
- **Fix (test-only):** pass `` `app/${file}` `` to `checkActionFile` on line 76. Add one AB-4 case that runs the checker with a real action path, e.g. `app/chat/actions.ts` + `../../lib/ai/provider-deps`, and asserts it is flagged.

Both fixes are one small test-only round for US-028. The code under test does not change.

## Warning

**W1 (US-025 tests): cited tests that do not exist.**
- `US-025-tests.md:64` cites "PD-6 `lib/ai/provider-deps.test.ts` — AiAvailability, GenerateResult never carry apiKey/secret/token". The file has PD-1 to PD-5 and PD-7, and no PD-6. The property is covered elsewhere: PT-3 (`lib/ai/providers/types.test.ts:29`, type-level keys of `GenerateResult`) and AR-9 (`lib/ai/providers/resolve.test.ts:91`, runtime keys of the availability view).
- `:96` lists "ARB", which is not a test id.
- `:78` cites "BC-1" in `lib/config/boundaries.test.ts`. That file has no BC-1 label. The rule is enforced by the unnamed per-file test at `:19`.
- The criteria still hold. This is the tester-citation pattern of Sprint 4 W4 and Sprint 5 W1/W4, again.

**W2 (US-026 tests): PASS reported with a failing gate, plus an unsupported check.**
- `US-026-tests.md:12` records `pnpm test` exit 1 (1246/1248). The retry is 1247/1248 (`:17`). Yet `:161` says "Typecheck, lint, test, and two build commands all exit 0", and AC9 (`:101`) is MET. The tester never saw a green full suite for this story. The suite is green now: US-027's tester got 1330/1330, and my own run gives 1475/1475. But the verdict contradicts itself, the same pattern as Sprint 5 W4.
- `:141-143` says "`/admin/ai` served locally in `ro` and `en` … ✓" with no command, exit code or output. The dev loop must never run `scripts/claude/qa-serve.sh` (CLAUDE.md). So this is either an unsupported claim or a forbidden action. I could not tell which, because the log scan was denied (N1).

**W3 (US-027 tests and review): the fetch-guard evidence is overstated.**
- `US-027-tests.md:120` marks AC9 MET on "`beforeEach { vi.stubGlobal("fetch", ...); afterEach fetch assertion }` (every test file in capabilities/)". No test file under `lib/ai/capabilities/` asserts on `fetch` in an `afterEach`. Only 5 of the 12 files stub `fetch` at all: `generate`, `registry`, `prompt`, `interpret` and `interpret.pglite`.
- The reviewer's AC9 line ("every new/changed test file additionally stubs global `fetch`") overstates it too, although its N1 correctly notes that the `afterEach` assertion is missing.
- No test reaches the network: the other files test pure functions or PGlite with `detect` mocked. So AC9 holds. The cited proof does not exist as described.

**W4 (US-028): AC6 "for each resolution reason" is proven at the chat level for only two of five reasons.**
- `lib/ai/chat.test.ts:83,92` and `lib/ai/chat.pglite.test.ts` CEP-12 cover `not_configured`. `app/chat/actions.pglite.test.ts` CAP-3 covers `no_api_key`. None of them covers `unknown_provider`, `not_implemented` or `no_model` for "a submitted message gets the same reply, zero fetch calls, database unchanged".
- CPG-2 (`app/chat/page.test.tsx:58`) loops over all five reasons, but it asserts only "no textarea" and "a link to /admin/ai". Its title says "shows its translated reply", yet it checks no text. The key mapping is proven separately by CRM-4.
- The code handles every `!active.ok` in one branch (`chat.ts:84-86`), so the risk is low. Both verdicts still claim "for each".
- **Fix:** do it in US-028's C1/C2 round: make the `chat.test.ts` availability cases an `it.each(CHAT_UNAVAILABLE_REASONS)`, and have CPG-2 assert the translated text.

## Note

- **N1 — Process check incomplete, again.** The permission system denied my scan of this sprint's logs for git, secret-file and printed-variable commands. I did not retry it in any form. The logs I could not check are `autopilot-20260926-185133-a3`, `-235132-a4`, `autopilot-20260927-004201-a5`, `-045130-a6` and `-054226-a7`. What I could check:
  - Disclosed and denied, not retried: three reviewer git attempts. US-025 (`git show` inside a `diff`, `US-025-review.md:154-157`), US-026 (`git diff --stat`, `US-026-review.md:127-129`) and US-027 (`git diff --stat`, `US-027-review.md:89-93`; also in the HANDOVER US-027 section). Every one is disclosed, so these are Notes. `story-reviewer` has now tried git "out of habit" in three consecutive stories.
  - Sprint 5 audit N1 asked the Technical Lead chat for a scan the permission rules allow. That is still open.
- **N2 — No Codex QA run yet** for US-025 to US-028. This is normal under DEC-013. All four `US-XXX-qa.md` checklists exist. US-025's "Files changed" section (`US-025-qa.md:44-45`) only points to HANDOVER instead of listing the files.
- **N3 — US-028 plan and delivered tests disagree** (reviewer N1 and N2). CEP-7 ("added with an adapter", end to end) and CEP-10 (the stale-context race) do not exist. The planned `expectTypeOf` guards on the outcome unions do not exist either. AC5 is still covered, by the execute unit test for "added with an adapter" and by EXP-1 to EXP-4 plus CRM-2 for the pre-empted results.
- **N4 — README is stale.** `README.md:79` still says the key variables are "Optional until the configuration chat ships (Sprint 6)". The planned one line about `/chat` was not added (reviewer N3). Fix it in the C1/C2 round.
- **N5 — Test-harness timeouts under load keep recurring.** They have hit FP-1/FP-2, RT-7a, `default-deps.cron`, and CPS-1 (US-028 review N4). Each passes alone, and my full run had none. The Technical Lead chat should consider a higher `testTimeout` for the PGlite and page suites.
- **N6 — Information for the PO (already listed):** `/chat` is open to anyone with the URL and can use up the free-tier quota (sprint review). Product decisions #4, #5, #9, #10, #11 and #12 all shipped their isolated defaults in the files the sprint named. I found no code outside those files that depends on them.

## Per story

| Story | Criteria | Result |
|---|---|---|
| US-025 | AC1-AC7 hold. Closed error set, `runGeneration` never throws, registry, five-branch resolution, key only from `key-status.ts`, LB-2/LB-4 revised stricter (LB-4 now whole-tree after US-026) | OK. W1 (tester citations) |
| US-026 | AC1-AC9 hold. Key only in a header, model URL-encoded, 400 `API_KEY_INVALID` → `auth_failed`, one request, catalogue equals registry, PA-6b/AA-7b close Sprint 5 W3 | OK. W2 (tester gate claim, unsupported serve claim) |
| US-027 | AC1-AC9 hold. Capability registry holds one entry, JSON prompt keeps the message only in `user`, strict parser, grounding per decision 8, interpretation writes nothing (CXP-1) | OK. W3 (fetch-guard evidence) |
| US-028 | AC1, AC3-AC5, AC7, AC8, AC10, AC11 hold. AC2 is not met as written (loader clauses untested). AC9's guard is blind to relative imports. AC6 is proven for only 2 of 5 reasons at chat level | **Re-open**: C1, C2 (test-only), with W4, N3, N4 in the same round |

US-028 is reopened for one test-only round (C1, C2; W4 and N4 fit in the same round). W1-W3 go to the Technical Lead chat as the tester-brief change already recommended in Sprint 5 W1: the tester must paste `grep -n` output for every cited test, and must not report PASS while a gate exits non-zero.

Denied or attempted commands: one. My scan of the Sprint 6 autopilot logs was denied by the permission system: a `grep -o '"command":…'` pipeline whose filter pattern named git, `.env` and credential paths. I did not retry it in any form (N1). I ran no git command and read no `.env*` or credential file.
