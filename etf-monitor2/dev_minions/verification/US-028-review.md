# US-028 — Independent review

## Round 1 — 2026-09-27
Verdict: PASS

Acceptance criteria:
- AC1: MET — `app/chat/page.tsx:7-8` (`dynamic = "force-dynamic"`, `maxDuration = 60`), `components/chat/ChatView.tsx`
  (heading, intro, composer), `components/chat/ChatPanel.tsx:43` (`<textarea name="message">`, submit button).
  `app/chat/page.test.tsx` `CPG-1` (heading, `<textarea name="message"` with `maxLength="500"` — verified this is the
  real rendered attribute name by an ad hoc `renderToStaticMarkup` check in this round, not a typo), `CPG-4`
  (`mod.dynamic === "force-dynamic"`, `mod.maxDuration === 60`). `components/AppHeader.tsx:13`
  (`<Link href="/chat">{t("Nav.chat")}</Link>` between Home and Administration); `components/AppHeader.test.tsx`
  `AH-1` asserts the href, the translated label and its position between `/` and `/admin` in both locales. Ran green
  in this round (`npx vitest run app/chat/page.test.tsx components/AppHeader.test.tsx`).
- AC2: MET — `lib/ai/capabilities/configuration/execute.ts` calls exactly one of `addEtf` / `setEtfActive` /
  `trackField` / `untrackField` per intent (switch with no default branch, so a new `ConfigurationAction` variant is
  a compile error), never touches SQL directly. Proven end to end with the fake provider and the real `lib/config/`
  functions by `lib/ai/chat.pglite.test.ts`: `CEP-1` (add ETF XYZ inserts one row, `createHomeTableLoader`-equivalent
  column proven via direct row read), `CEP-2` (remove sets `is_active = false`, `reports`/`report_values`/
  `tracked_fields` snapshots unchanged), `CEP-3` (track adds `net_asset`), `CEP-4` (untrack removes `nav_per_unit`,
  `report_values` unchanged). `app/chat/actions.pglite.test.ts` `CAP-1` proves the same through the real Server Action
  with default wiring, plus `revalidatePath` called for `/`, `/admin/etfs`, `/admin/etfs/XYZ/fields`, `/etf/XYZ`. No
  SQL in the execute step or the action, proven by `lib/ai/capabilities/boundaries.test.ts` `CB-3` (scans all of
  `lib/ai/` for `sql\``/`db.execute`/`drizzle-orm`) and `app/actions.boundary.test.ts` `AB-1`/`AB-2`. Ran green.
- AC3: MET — `execute.ts:66` (`name: intent.name ?? intent.symbol`, product #10 default). `lib/ai/chat.pglite.test.ts`
  `CEP-1` (name = symbol), `CEP-5` (verbatim name kept), `CEP-6` (reactivating PTENGETF keeps its name, adapter and
  `is_active` and calls `detect` zero times). Unit-level `lib/ai/capabilities/configuration/execute.test.ts` `EX-1`
  double-checks the exact `addEtf` call arguments for both the null-name and named cases. Ran green.
- AC4: MET — `app/chat/reply-messages.ts` maps every outcome through typed `Record<Code, ChatReplyKey>` tables (a
  missing case is a compile error), never a string built from model output. `app/chat/reply-messages.test.ts`
  `CRM-0`/`CRM-1` builds every `ChatOutcome` from the shipped runtime lists (`CHAT_INVALID_REASONS`,
  `CHAT_UNAVAILABLE_REASONS`, `PROVIDER_ERROR_CODES`, `UNCLEAR_REASONS`, `EXECUTION_CODES`, plus `unsupported`/
  `multiple`/`error`) — 32 outcomes total (verified `> 20`, not vacuous) — and renders each through `createTranslator`
  in both `en` and `ro` with no leftover `{placeholder}` and non-empty text; `CRM-3` checks identical placeholder sets
  between locales. Sentinel-leak proof: `lib/ai/chat.test.ts` `CE-8` (a model answer carrying
  `"ZQ-SENTINEL-5531"` in `name`/an extra `note` property never reaches `JSON.stringify(outcome)` or the mapped
  reply) and `components/chat/ChatReply.test.tsx` `CV-2` (rendered HTML of that reply contains no sentinel). Field
  labels render in the UI locale only: `ChatReply.test.tsx` `CV-1`. Ran green.
- AC5: MET, with one plan/test-naming gap noted below (Findings N1). Every `ExecutionCode` is produced by
  `execute.test.ts` `EX-3` (`new Set(EXECUTION_CODES)` equality, not vacuous) and mapped to a reply key by `CRM-1`.
  End-to-end proof for the cases the chat can actually reach unmediated by grounding: added-no-adapter (`CEP-1`),
  reactivated (`CEP-6`), already_monitored (`CEP-8`), tracked (`CEP-3`), untracked (`CEP-4`), already_inactive
  (`CEP-11`, tech-lead point 4 — reply stays "is not monitored", row stays inactive). The four grounding-pre-empted
  cases (`not_found`, `already_tracked`, `not_tracked`, `field_not_available`) are proven directly at the execute
  step against a real seeded database by `execute.pglite.test.ts` `EXP-1..4`, and `reply-messages.test.ts` `CRM-2`
  proves the grounding reason and the matching config result render to the identical `messageKey` (tech-lead point
  2's "one answer for one situation"). "Added with an adapter" (a fresh add where detection finds one) is proven only
  at the unit level (`execute.test.ts`, `addEtf` mocked to return `adapterKey: "brd-depositary"`) — the plan's named
  end-to-end case `CEP-7` and its stale-context case `CEP-10` are not present under those names in
  `lib/ai/chat.pglite.test.ts` (see Findings N1). The mapping logic itself and the reply text are still proven; only
  the full real-detection-through-chat wiring for that one case is not exercised at PGlite level.
- AC6: MET — `lib/ai/chat.ts:78-86` resolves the provider and returns before any context load or `generate` call on
  a "not usable" reason. `app/chat/page.test.tsx` `CPG-2` (loops `CHAT_UNAVAILABLE_REASONS`, no `<textarea`, link to
  `/admin/ai` present, in `en`); `lib/ai/chat.pglite.test.ts` `CEP-12` (real settings + `resolveActiveProvider`,
  `not_configured`, zero calls to the fake provider, the global `fetch` spy and `detect`, database snapshot
  unchanged) plus `lib/ai/chat.test.ts`'s `not_configured`/`no_api_key` cases with `loadConfigurationContext` proven
  uncalled. `app/chat/actions.pglite.test.ts` `CAP-3` (unset `GEMINI_API_KEY` via real wiring → `unavailableNoApiKey`,
  zero fetch calls, database unchanged). `reply-messages.test.ts` `CRM-4` proves the page notice and the submitted-
  message reply use the identical key and `adminLink`. Ran green.
- AC7: MET — every `catch` in `lib/ai/chat.ts` is bare (`catch { return { kind: "error" } }`), the caught value is
  never read or stored. `lib/ai/chat.test.ts` `CE-3` (throwing deps factory with a sentinel containing a fake
  connection string), `CE-4` (rejecting `loadSettings`), `CE-6` (rejecting `loadConfigurationContext`, zero
  `generate` calls), `CE-7` (rejecting `executeConfigurationIntent`) — all assert `JSON.stringify(outcome)` excludes
  the sentinel text. `app/chat/actions.test.ts` `CA-4` (rejecting `handleChatMessage` → `genericError`, no sentinel,
  no revalidation). `app/chat/actions.pglite.test.ts` `CAP-2` (a real fake provider records the stubbed API key in
  its own call context, proving the key does reach the adapter, while the action's JSON result contains no
  `ZQ-KEY`). `app/chat/page.safety.test.tsx` `CPS-2`/`CPS-3a`/`CPS-3b` (a throwing `getDb()`, a throwing
  `createAiSettingsDeps()`, a rejecting `getAiSettings()` all render `Chat.loadError` with no composer and no
  sentinel/connection-string text, with both API-key env vars stubbed to sentinels throughout). Provider error codes:
  `lib/ai/chat.test.ts` `CE-5` (`it.each(PROVIDER_ERROR_CODES)`, execute never called) and `reply-messages.test.ts`
  `CRM-5` (tech-lead point 3: `model_not_found` → `providerModelNotFound` + `adminLink`, `auth_failed` →
  `providerAuthFailed`, `bad_response` → `providerBadResponse`, none showing provider text — spot-checked the
  message bodies myself in `messages/en.json`/`ro.json`, none echoes provider prose). Ran green except one isolated
  timeout noted in Findings N4 (not a code defect — passed cleanly on an isolated re-run I did myself).
- AC8: MET — `lib/ai/chat.ts:63-69` rejects before the deps factory runs. `lib/ai/chat.test.ts` `CE-1` (empty,
  whitespace, 501 chars, padded 501 chars → `invalid_message`, deps factory and fetch spy both uncalled), `CE-2`
  (500 chars accepted, one fake call), `CE-9` (exactly one `generate` call and one `executeConfigurationIntent` call
  for an intent). `app/chat/actions.test.ts` `CA-1` (the action reads only `message` from `FormData`, extra fields
  `symbol`/`apiKey`/`GEMINI_API_KEY` ignored — `handleChatMessage` called with exactly the one string argument),
  `CA-2` (missing field or a `File` value → `""`). `components/chat/ChatPanel.test.tsx` pins the `maxLength="500"`
  UX attribute (verified this is the real rendered HTML attribute name, see AC1). Ran green.
- AC9: MET — `app/actions.boundary.test.ts` `AB-0` (finds `admin/etfs/actions.ts`, `admin/etfs/[symbol]/fields/
  actions.ts`, `admin/ai/actions.ts`, `admin/cron/actions.ts`, `chat/actions.ts` — 5 files, not vacuous), `AB-1`/
  `AB-2`/`AB-3` (per-file: no `drizzle-orm` specifier, no `sql\`` / `insert into` / `update "` / `delete from` text,
  every `lib/`-resolving specifier inside `lib/config/*`, `lib/db`, `lib/ai/settings-deps` or `lib/ai/chat`), `AB-4`
  (self-check: each forbidden pattern — including a synthetic import of
  `lib/ai/capabilities/configuration/execute`, which is correctly disallowed for `app/**/actions.ts` even though it
  is allowed for the chat entry module — is flagged, and a clean synthetic source is not). Passes on the current
  tree, ran green myself.
- AC10: MET — `components/admin/AiSettingsAdmin.tsx:85-87` (`chatUnavailableNote` replaced by a `<Link href="/chat">`
  with `chatLink`). `app/admin/ai/page.test.tsx` `PA-10` (`ro`/`en` HTML contains `href="/chat"` with the translated
  `chatLink` text; `"chatUnavailableNote" in en.Admin.ai` and `in ro.Admin.ai` both `false`) and `PA-5`/`PA-5b`
  (existing note assertions updated, not weakened). Confirmed by my own grep that `chatUnavailableNote` no longer
  appears anywhere in the repo outside that one negative test assertion. Ran green.
- AC11: MET — `messages/en.json`/`ro.json` key parity confirmed myself (`Chat.replies` — 32 keys in each, identical
  key sets; `Nav.chat`, `Admin.ai.chatLink` present in both). No test reaches a provider, Neon or bvb.ro: every new
  test stubs global `fetch` to throw and asserts it uncalled where relevant; detection is always a `vi.fn`. No
  schema change (`lib/db/schema.ts`/`drizzle/` untouched — not in "Files changed", confirmed by their absence and by
  the PGlite tests using the existing seed/migrations unmodified). No new dependency: `lib/ai/boundaries.test.ts`
  `LB-7` (package.json has no denylisted SDK) passed in this round, and `package.json`/the lockfile are absent from
  HANDOVER's "Files changed" list. I ran `pnpm typecheck` (clean) and `pnpm lint` (0 errors, 5 pre-existing warnings
  — matches HANDOVER's own corrected count) myself in this round. `pnpm build` was not re-run by me: a concurrent
  `next build` lock ("Another next build process is already running") was present in the shared working tree during
  this round, most likely from the parallel tester/implementer session — not re-run; HANDOVER's own build claim
  (including the offline `-u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY` variant) stands uncontradicted by
  anything I found in the source. `pnpm test`: I ran the story's own test files plus the changed boundary/AppHeader/
  admin-ai files together (18 files, 230 tests) — 229 passed, one (`CPS-1`) timed out at the default 5000ms; see
  Findings N4. I did not re-run the full 1475-file suite HANDOVER cites.

Findings (ordered by severity, none Critical):
1. (Note) The plan (`US-028-plan.md` §2, AC5 table and §"Notes for verification") names two PGlite end-to-end test
   cases, `CEP-7` ("added with an adapter", detect returns `brd-depositary`) and `CEP-10` (an inline fake provider
   that mutates the database mid-`generate`, to prove the stale-context race gives the same reply as grounding).
   Neither exists under those names, or in substance, in the shipped `lib/ai/chat.pglite.test.ts` (verified by
   grepping the whole test tree for `CEP-7`, `CEP-10` and for a `pg.query` call inside a fake provider's `generate`).
   The properties they were meant to prove are still covered, just less directly: `execute.test.ts`'s unit test for
   "added with an adapter" proves `execute.ts`'s mapping is correct with `addEtf` mocked, and `reply-messages.test.ts`
   `CRM-2` proves the grounding/config-result reply-key identity statically instead of through a live race. No AC
   failure results, but the plan and the delivered tests disagree on what was proven and how — worth tightening
   before/with the next story that touches this pipeline.
2. (Note) The plan (§2, AC4) says "type tests pin the enumerated kinds to the unions (`expectTypeOf<Kinds>()
   .toEqualTypeOf<...>()`...), so a new variant fails typecheck" for `ChatOutcome["kind"]`, `InterpretedOutcome
   ["kind"]` and `ChatUnavailableReason` vs `ActiveProviderFailureReason`. No `expectTypeOf` appears anywhere in the
   new test files (grepped). `lib/ai/chat.ts:24`'s `as const satisfies readonly ActiveProviderFailureReason[]` gives
   one-directional protection (every listed reason really is one) but not the reverse (a new
   `ActiveProviderFailureReason` member would not force a compile error here); today the two unions happen to be
   identical (checked `lib/ai/providers/resolve.ts:6` — exactly the same 5 literals), so there is no live gap, only
   a missing regression guard for later.
3. (Note) The plan (§0, §6) says README.md gets "one line: the chat at `/chat` and that it needs the AI provider,
   model and key from `/admin/ai`". README.md is not in HANDOVER's "Files changed (US-028, in flight)" list, and I
   found no explicit mention of the `/chat` URL in `README.md` — the two "chat" references there (env-var section,
   Administration section) read as pre-existing sprint-6 scaffolding text from earlier stories, not a new line about
   the shipped route. No AC requires this; purely a documentation completeness gap against the plan's own promise.
4. (Note, test-run observation, not a code defect) `app/chat/page.safety.test.tsx`'s `CPS-1` timed out at the
   default 5000ms when I ran it together with the other 17 changed/new test files in one `vitest run` invocation in
   this session; run alone, it passed in ~2s. This matches the "isolated flaky timeout under concurrent PGlite load"
   pattern already logged for several earlier stories in this repo (e.g. HANDOVER's US-024/US-026 notes) and is not
   evidence of a real bug in the page or its mocks.

Scope deviations: none found. Reviewed every file in HANDOVER's "Files changed (US-028, in flight)" list plus the
messages catalogues; grepped the repo for the story's new symbols (`handleChatMessage`, `executeConfigurationIntent`,
`ChatOutcome`, `sendChatMessageAction`) and found no hits outside the listed files, their tests, and the two
`lib/ai/*.test.ts` / `lib/ai/capabilities/boundaries.test.ts` boundary files already on the list. `lib/config/**`,
`lib/db/**`, `drizzle/**`, `lib/ai/providers/**`, `lib/ai/provider-deps.ts`, `lib/ai/key-status.ts`, US-027's
capability files, `package.json` and the lockfile are all untouched, matching the plan's "untouched" list.

Denied or attempted commands: none. I ran no git command in this round (identified the story's files from
HANDOVER.md's file list, as instructed) and read no secret or `.env*` file.

## Round 2 — 2026-09-27
Verdict: PASS

Fix-round scope: the Sprint 6 tech-lead audit (`SPRINT-06-audit.md`) reopened US-028 for two
Critical findings (C1, C2) plus non-blocking W4 and N4. This round verifies only those fixes, plus
that nothing else regressed.

**C1 — closed.** AC2 required the shipped `createHomeTableLoader` (`lib/monitoring/home.ts`) and
`createDrizzleEtfLoader` (`lib/ingestion/load-etfs.ts`) to be re-run and checked after each chat
command; the round-1 tests only read rows directly. `lib/ai/chat.pglite.test.ts:42-48` now defines
`homeTable()`/`dailyEtfs()` helpers that call both loaders with the exact same
`(db.mockDb, defaultAdapterRegistry, db.runner)` / `(db.mockDb, db.runner)` signatures used
elsewhere in the repo (`lib/config/etfs.pglite.test.ts:235`, `lib/config/tracked-fields.pglite.test.ts:450`,
`lib/monitoring/home.pglite.test.ts:39` — grepped to confirm the signature match, not a fabricated
call). Each of CEP-1..4 now asserts on the loader output, matching the audit's own fix list:
- CEP-1 (`:68-69`): `home.rows.some((r) => r.symbol === "XYZ")` is `true`.
- CEP-2 (`:93-96`): `home.rows.some(...)` and `daily.some(...)` for `BTBETRETF` are both `false`.
- CEP-3 (`:113-114`): `home.columns.map((c) => c.fieldKey)` contains `net_asset`.
- CEP-4 (`:131-132`): `daily.find((e) => e.symbol === "BTBETRETF")!.trackedFieldKeys` excludes
  `nav_per_unit`.
I ran `npx vitest run lib/ai/chat.pglite.test.ts` myself: 10/10 pass, including CEP-1..4 with the
new loader assertions (57.7s total, PGlite is slow but green).

**C2 — closed.** The audit found that `app/actions.boundary.test.ts:76` passed a path relative to
`app/` (e.g. `chat/actions.ts`) into `checkActionFile`, so `resolveSpecifier` joined a real action
file's relative `../../lib/...` import against the wrong base and it resolved outside `lib/`,
silently unflagged. I reproduced the audit's `node -e` check myself:
```
pre-fix (bug):    resolveSpecifier("chat/actions.ts", "../../lib/ai/provider-deps")     -> "../lib/ai/provider-deps"   (not flagged: doesn't start with "lib/")
post-fix (fixed): resolveSpecifier("app/chat/actions.ts", "../../lib/ai/provider-deps") -> "lib/ai/provider-deps"     (flagged: outside the allowlist)
```
Line 76 now reads `` checkActionFile(`app/${file}`, source) ``, and a new case in AB-4 (`:97-101`)
runs the checker directly against `"app/chat/actions.ts"` with a relative
`../../lib/ai/provider-deps` import and asserts it is flagged. I additionally reverted line 76 to
the pre-fix bare `file` locally and re-ran `app/actions.boundary.test.ts`: it still passed, because
the new AB-4 case exercises `checkActionFile` directly with the correct `fromFile` regardless of
line 76 — so AB-4 is a real, self-contained regression guard for the resolution bug, independent of
whether line 76 itself is later reverted by accident. I restored the file immediately after
(`diff` confirmed clean). AB-0..4 pass together (7/7), and the guard now genuinely closes the gap:
no action file uses a relative `lib/` import today, but if one did, it would now be caught in both
relative and `@/lib/…` form, per sprint decision 14.

**W4 — closed.** `lib/ai/chat.test.ts:94-106` replaced the two-reason coverage with
`it.each(CHAT_UNAVAILABLE_REASONS)`, with a `UNAVAILABLE_OVERRIDES` map (`:82-91`) that drives each
of the five reasons through the real `resolveActiveProvider` path (unset provider, unknown provider
id, an unimplemented-but-registered provider, no key, no model) and asserts zero `generate` calls,
zero `fetch` calls, `loadConfigurationContext` and `executeConfigurationIntent` both uncalled, for
every reason. `app/chat/page.test.tsx:66-72` (`CPG-2`) now also asserts
`html.toContain(en.Chat.replies[UNAVAILABLE_MESSAGE_KEY[reason]])` per reason, not just "no textarea
+ admin link" — a real text check against the message catalogue, not a hand-typed string. Ran green
in my own `npx vitest run app/chat/page.test.tsx` (10/10) and `lib/ai/chat.test.ts` (22/22).

**N4 — closed.** `README.md:77-81` no longer says the AI key variables are "Optional until the
configuration chat ships"; it now describes the current `/chat` behaviour (link to `/admin/ai` when
unset). `README.md:135-141` adds a new paragraph in "Administration" describing `/chat` itself
(open, no login, example commands, FR1/FR2/FR5/FR9 citations, points to `/admin/ai` for
provider/model, states the 500-character limit). Confirmed by reading the file myself.

**Other acceptance criteria (AC1, AC3-AC5, AC7-AC11) — still intact.** Per
`dev_minions/.files-touched.log`, only `lib/ai/chat.pglite.test.ts`, `app/actions.boundary.test.ts`,
`lib/ai/chat.test.ts`, `app/chat/page.test.tsx` and `README.md` were modified this round (all
timestamped 05:59-06:01); no source file (`lib/ai/chat.ts`, `app/chat/actions.ts`,
`app/chat/page.tsx`, `execute.ts`, the reply-messages map, the components) was touched, matching
the audit's "the code under test does not change" note. I ran every other story-specific test file
myself: `execute.test.ts`, `execute.pglite.test.ts`, `reply-messages.test.ts`,
`app/chat/actions.test.ts`, `app/chat/actions.pglite.test.ts`, `app/chat/page.safety.test.tsx`,
`ChatReply.test.tsx`, `ChatPanel.test.tsx`, `ChatView.test.tsx`, `transcript.test.ts`,
`AppHeader.test.tsx`, `app/admin/ai/page.test.tsx`, `lib/ai/boundaries.test.ts`,
`lib/ai/capabilities/boundaries.test.ts` — 14 files, 184/184 pass. `pnpm typecheck` is clean;
`pnpm lint` is 0 errors, 5 pre-existing warnings (matches HANDOVER's corrected count). A full
`pnpm test` run gives 1477/1478 (135/136 files): the sole failure is
`app/chat/page.safety.test.tsx` `CPS-1` timing out at the default 5000ms under concurrent PGlite
load — a file untouched this round, and the same recurring pattern already logged in round 1's own
Findings N4 and elsewhere in HANDOVER (US-024, US-026). I reran that file alone: 5/5 pass in
2.5s. Not a regression from this round's fix.

No scope creep: the only files that differ from round 1's "Files changed" list are exactly the five
named in the delegation prompt (`lib/ai/chat.test.ts`, `lib/ai/chat.pglite.test.ts`,
`app/actions.boundary.test.ts`, `app/chat/page.test.tsx`, `README.md`), all test-only or
documentation-only. No production code changed, no new dependency, no schema change.

Verdict: PASS. C1 and C2 are genuinely closed — both are real, reproducible regression guards
(confirmed by reproducing the pre-fix resolution bug myself and by reverting-and-re-running the
boundary test), not restatements of the same evidence under new names. W4 and N4 are also closed.
No new Critical or Warning findings this round.

Denied or attempted commands: none. I ran no git command in this round and read no secret or
`.env*` file.
