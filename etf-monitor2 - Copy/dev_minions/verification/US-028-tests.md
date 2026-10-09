# US-028 — Tests: chat surface wired to the configuration actions (RO and EN)

_Tested by story-tester (haiku), 2026-09-27. Round 1._

## Round 1 — 2026-09-27

Verdict: PASS

### Test run summary
- `pnpm install --frozen-lockfile`: exit 0
- `pnpm typecheck`: exit 0 (no output = no errors)
- `pnpm lint`: exit 0 (0 errors; 5 pre-existing warnings)
- `pnpm test`: exit 0 (136 test files, 1475 tests passed)
- `pnpm build`: exit 0 (`/chat` listed as dynamic route)
- `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY pnpm build`: exit 0 (`/chat` listed)

### Acceptance criteria — test mapping

**AC1 — Chat page in the user area** (Req §5; FR5; FR8.1; decisions 6, 12)
- `/chat` renders with translated heading, textarea, send button in RO and EN: `app/chat/page.test.tsx:35` (CPG-1)
- Page exports `dynamic = "force-dynamic"` and `maxDuration = 60`: `app/chat/page.test.tsx:52` (CPG-4)
- Header shows `/chat` nav link in RO and EN between Home and Admin: `components/AppHeader.test.tsx:45` (AH-1)
- Build output shows `/chat` as dynamic route: verified in build output (reviewed above)
**Status: MET**

**AC2 — Commands change configuration only through `lib/config/`** (FR1, FR2, FR9; DEC-016 §§1, 2, 4)
- "add ETF XYZ" inserts one active row through `addEtf`: `lib/ai/chat.pglite.test.ts:50` (CEP-1)
- "stop tracking ETF BTBETRETF" sets `is_active = false` via `setEtfActive`: `lib/ai/chat.pglite.test.ts:68` (CEP-2)
- "also track net asset for BTBETRETF" adds tracked field via `trackField`: `lib/ai/chat.pglite.test.ts:83` (CEP-3)
- "stop tracking VUAN for BTBETRETF" removes tracked field via `untrackField`: `lib/ai/chat.pglite.test.ts:99` (CEP-4)
- Action calls `handleChatMessage` exactly once with only the message field: `app/chat/actions.test.ts:15` (CA-1)
- Action reads no other fields: `app/chat/actions.test.ts:30` (CA-2)
- Execute step and action contain no SQL: `app/actions.boundary.test.ts:74` (AB-1..3 scan all action files), `lib/ai/capabilities/boundaries.test.ts` CB-3 scans `lib/ai/` for SQL
**Status: MET**

**AC3 — ETF name** (FR1; `etfs.name` NOT NULL; sprint-05 decision 4; decision 10)
- "add ETF XYZ" stores `name = 'XYZ'` (symbol): `lib/ai/chat.pglite.test.ts:50` (CEP-1, line 57 assertion)
- "add ETF XYZ named Fond Test" stores given name: `lib/ai/chat.pglite.test.ts:60` (CEP-5)
- Reactivating inactive ETF keeps stored name and adapter: `lib/ai/chat.pglite.test.ts:115` (CEP-6)
- Execute's `add_etf` uses `name: intent.name ?? intent.symbol`: `lib/ai/capabilities/configuration/execute.test.ts:22` (EX-1)
**Status: MET**

**AC4 — Replies are translated templates, never model prose** (FR8.1; decision 7)
- Every outcome maps to a key present in both `en.Chat.replies` and `ro.Chat.replies`, and all placeholders are filled: `app/chat/reply-messages.test.ts:57` (CRM-1, parametrized over `allOutcomes()`)
- The four grounding/execution pairs share one reply key: `app/chat/reply-messages.test.ts:77` (CRM-2)
- Every key has same `{placeholder}` set in both locales: `app/chat/reply-messages.test.ts:101` (CRM-3)
- Field label from context; locale-specific in render: `components/chat/ChatReply.test.tsx:19` (CV-1)
- Sentinel text from model never appears in outcome or HTML: `lib/ai/chat.test.ts:140` (CE-8), `components/chat/ChatReply.test.tsx:58` (CV-2)
**Status: MET**

**AC5 — Every config result is reported** (FR1, FR2, FR9; section 3)
| Case | Test | Line |
|---|---|---|
| added with adapter | Execute test unit (mockResolvedValue): `lib/ai/capabilities/configuration/execute.test.ts:32` | 32–36 |
| added without adapter | CEP-1: `lib/ai/chat.pglite.test.ts:50` | 50–58 |
| reactivated | CEP-6: `lib/ai/chat.pglite.test.ts:115` | 115–125 |
| already_monitored | CEP-8: `lib/ai/chat.pglite.test.ts:127` | 127–135 |
| not_found (remove unknown) | EXP-1 constructed intent: `lib/ai/capabilities/configuration/execute.pglite.test.ts:24` | 24–28 |
| tracked | CEP-3: `lib/ai/chat.pglite.test.ts:83` | 83–97 |
| already_tracked | CEP-9 interpreted (grounding), EXP-2 execute: `lib/ai/chat.pglite.test.ts:137`, `lib/ai/capabilities/configuration/execute.pglite.test.ts:30` | 137–147, 30–41 |
| untracked | CEP-4: `lib/ai/chat.pglite.test.ts:99` | 99–113 |
| not_tracked | EXP-3: `lib/ai/capabilities/configuration/execute.pglite.test.ts:43` | 43–51 |
| field_not_available | EXP-4: `lib/ai/capabilities/configuration/execute.pglite.test.ts:53` | 53–65 |
| already_inactive | CEP-11: `lib/ai/chat.pglite.test.ts:149` | 149–158 |
- Full result mapping unit test: `lib/ai/capabilities/configuration/execute.test.ts:123` (EX-3, covers all codes)
- Reply keys built via `Record` type (compile error if new code): `app/chat/reply-messages.test.ts:57` (CRM-1)
**Status: MET**

**AC6 — Not-configured states make no request** (FR6, FR11; sprint-05 decision 10; decision 4)
- Page shows unavailable state with no textarea for each reason in RO and EN, link to `/admin/ai`: `app/chat/page.test.tsx:58` (CPG-2)
- ChatView renders unavailable state: `components/chat/ChatView.test.tsx:33` (CPG-2, parametrized over `CHAT_UNAVAILABLE_REASONS`)
- Action returns unavailable reply and no fetch call when provider not usable: `app/chat/actions.pglite.test.ts:69` (CAP-3)
- Chat entry returns unavailable and makes no generate call: `lib/ai/chat.pglite.test.ts:160` (CEP-12)
- Reply key and availability reason match: `app/chat/reply-messages.test.ts:108` (CRM-4)
**Status: MET**

**AC7 — Failures never leak** (AGENTS.md Secrets; DEC-015 point 1; Sprint 5 audit W3)
- Each provider error code maps to its reply key with no exception text: `lib/ai/chat.test.ts:101` (CE-5), `app/chat/reply-messages.test.ts:116` (CRM-5)
- Throwing deps factory gives `{ kind: "error" }`, no secrets in JSON: `lib/ai/chat.test.ts:108` (CE-3)
- Rejecting `loadSettings` gives error: `lib/ai/chat.test.ts:118` (CE-4)
- Rejecting context load gives error, no generate call: `lib/ai/chat.test.ts:125` (CE-6)
- Rejecting execute gives error: `lib/ai/chat.test.ts:133` (CE-7)
- Sentinel in model JSON never reaches outcome: `lib/ai/chat.test.ts:140` (CE-8)
- Action handleChatMessage rejection gives generic error, no secrets: `app/chat/actions.test.ts:71` (CA-4)
- Action with PGlite: key reaches adapter but not reply: `app/chat/actions.pglite.test.ts:84` (CAP-2)
- Page rendering with key environment variables: no key in HTML in any state: `app/chat/page.safety.test.tsx:44` (CPS-1), `app/chat/page.safety.test.tsx:50` (CPS-2), `app/chat/page.safety.test.tsx:62` (CPS-3a), `app/chat/page.safety.test.tsx:72` (CPS-3b)
- No fetch call while rendering page: `app/chat/page.safety.test.tsx:81` (CPG-6)
**Status: MET**

**AC8 — Input limits, one call** (decision 13; Req §6; decision 6)
- Empty/whitespace/501-char messages rejected before any deps or provider call: `lib/ai/chat.test.ts:50` (CE-1)
- 500-char message accepted and makes exactly one generate call: `lib/ai/chat.test.ts:60` (CE-2)
- One generate call and at most one execute per message: `lib/ai/chat.test.ts:67` (CE-9)
- Action reads only message field, ignores others: `app/chat/actions.test.ts:15` (CA-1)
- Missing/File message becomes empty string: `app/chat/actions.test.ts:30` (CA-2)
- Textarea element has `maxlength="500"`: `components/chat/ChatPanel.test.tsx:25` (CV-3)
**Status: MET**

**AC9 — Action-boundary test** (Sprint 5 audit W2; decision 14)
- Finds at least 5 action files including chat/actions.ts: `app/actions.boundary.test.ts:60` (AB-0)
- All action files pass: no drizzle-orm, no SQL, only allowed lib/ imports: `app/actions.boundary.test.ts:74` (AB-1..3)
- Self-check flags each forbidden pattern and passes clean files: `app/actions.boundary.test.ts:81` (AB-4)
- Passes on current tree (gate run): verified, no violations reported
**Status: MET**

**AC10 — `/admin/ai` points to the chat** (FR11; FR5)
- Link to `/chat` with `Admin.ai.chatLink` text appears in RO and EN: `app/admin/ai/page.test.tsx:123` (PA-10)
- Old "chat not available yet" note is gone from both catalogues: `app/admin/ai/page.test.tsx:123` (PA-10, asserts `"chatUnavailableNote" in ... === false`)
- Old note assertion removed/replaced: `app/admin/ai/page.test.tsx:109` (PA-5, updated per HANDOVER)
**Status: MET**

**AC11 — Bilingual and gates** (FR8.1; AGENTS.md; Commands)
- Key parity test passes (all new Chat.* and Nav.chat keys in both locales): `i18n/messages.test.ts` (existing test, verified in full suite pass)
- Placeholder parity: `app/chat/reply-messages.test.ts:101` (CRM-3)
- No test reaches live provider, Neon or bvb.ro: all fetch mocked/stubbed, detection mocked in PGlite tests; full suite verified
- No schema change: `lib/db/schema.ts`, `drizzle/` untouched (not in "Files changed" list)
- No new dependency: `package.json` and lockfile untouched (verified in HANDOVER "Files changed")
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`: all pass (shown above)
- `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY pnpm build`: pass (shown above)
**Status: MET**

### Summary
- All 11 acceptance criteria are MET
- All test gates pass (typecheck, lint, test suite, build)
- Test counts: 136 files, 1475 tests passed (exit 0)
- Criteria-to-test mapping complete, all evidence from own runs

Denied or attempted commands: none

## Round 2 — 2026-09-27

Verdict: PASS

### Test run summary (Sprint 6 audit fixes applied)
- `pnpm install --frozen-lockfile`: exit 0
- `pnpm typecheck`: exit 0 (no output = no errors)
- `pnpm lint`: exit 0 (0 errors; 5 pre-existing warnings)
- `pnpm test`: exit 0 (136 test files, 1478 tests passed)
- `pnpm build`: exit 0 (`/chat` listed as dynamic route)
- `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY pnpm build`: exit 0 (`/chat` listed)

### Changes from round 1 (C1, C2, W4, N4 fixes)

**C1 Fixed: AC2 loader clauses now tested**
- `lib/ai/chat.pglite.test.ts:43-48` defines `homeTable()` and `dailyEtfs()` helper functions
- CEP-1 (`lib/ai/chat.pglite.test.ts:68-69`): after adding XYZ, asserts `homeTable().rows.some(r => r.symbol === "XYZ") === true`
- CEP-2 (`lib/ai/chat.pglite.test.ts:93-96`): after deactivating BTBETRETF, asserts both `homeTable()` and `dailyEtfs()` omit it
- CEP-3 (`lib/ai/chat.pglite.test.ts:113-114`): after tracking net_asset, asserts `homeTable().columns` includes the field
- CEP-4 (`lib/ai/chat.pglite.test.ts:131-132`): after untracking nav_per_unit, asserts `dailyEtfs()` does not include it in trackedFieldKeys
**Status: MET**

**C2 Fixed: Action-boundary test catches relative lib/ imports in real action files**
- `app/actions.boundary.test.ts:76` now passes `` `app/${file}` `` to `checkActionFile` (file with `app/` prefix)
- `app/actions.boundary.test.ts:97-101` (AB-4 new case): tests a real action path `app/chat/actions.ts` with relative import `../../lib/ai/provider-deps`, asserts it is flagged as a violation
**Status: MET**

**W4 Fixed: AC6 tested for all 5 unavailable reasons**
- `lib/ai/chat.test.ts:82-91` defines `UNAVAILABLE_OVERRIDES` mapping all 5 `CHAT_UNAVAILABLE_REASONS` to configs that trigger each
- `lib/ai/chat.test.ts:94-106` uses `it.each(CHAT_UNAVAILABLE_REASONS)` to test all five reasons with identical expectations (unavailable outcome, zero generate calls, zero context load, database unchanged)
- `app/chat/page.test.tsx:66-72` uses `it.each(CHAT_UNAVAILABLE_REASONS)` and asserts the translated reply text from `en.Chat.replies` for each reason
**Status: MET**

**N4 Fixed: README.md documents `/chat`**
- `README.md:80` explains that `/chat` shows a reason with a link to `/admin/ai` when unconfigured
- `README.md:137` describes `/chat` as open natural-language configuration requiring the AI provider settings from `/admin/ai`
**Status: MET**

### Acceptance criteria — test mapping (round 2 verification)

All 11 acceptance criteria remain MET with enhanced test coverage:

**AC1**: CPG-1, CPG-4, AH-1 all pass; build confirms `/chat` dynamic route.
**AC2**: CEP-1..4 now additionally verify the shipped loaders (homeTable and dailyEtfs) follow configuration changes; AB-4 enhanced to catch relative `lib/` imports in real action paths.
**AC3**: EX-1 and CEP-1/CEP-5 unchanged; name handling verified.
**AC4**: CRM-1..3, CV-1..2 unchanged; reply templates and field labels verified.
**AC5**: All config results remain covered; AC5 table unchanged.
**AC6**: Now fully tested with `it.each` for all 5 reasons across two test files; every reason verified to produce unavailable outcome, make no requests, leave database unchanged, and render translated reply.
**AC7**: CE-3..8, CA-4, CAP-2, CPS-1..3, CPG-6 unchanged; failures never leak secrets.
**AC8**: CE-1..2, CE-9, CA-1..2, CV-3 unchanged; input limits and one-call guarantee verified.
**AC9**: AB-0..4 enhanced; AB-4 now catches relative `lib/` imports from real action files like `app/chat/actions.ts`.
**AC10**: PA-10, PA-5 unchanged; `/admin/ai` link to `/chat` verified.
**AC11**: All gates pass; README updated for `/chat` documentation.

### Summary
- All 11 acceptance criteria are MET
- All test gates pass: typecheck, lint, test suite (1478 tests, 3 new due to it.each expansion), build
- Audit fixes verified: C1 (loaders), C2 (relative imports), W4 (5 unavailable reasons), N4 (README)
- All evidence from own test runs; no git or secret commands used

Denied or attempted commands: none
