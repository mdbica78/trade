# US-051 test verdict

## Round 1 — 2026-10-05

Verdict: PASS

### Gate results (all exit 0)

| Command | Exit | Summary |
|---------|------|---------|
| `pnpm install --frozen-lockfile` | 0 | Frozen lockfile, up to date |
| `pnpm typecheck` | 0 | 0 errors |
| `pnpm lint` | 0 | 0 errors, 11 pre-existing warnings |
| `pnpm test` | 0 | **222 files / 2285 tests** (up from 220/2232 after US-050: 2 new golden test files + new cases in existing files) |
| `pnpm build` | 0 | Offline, `migrate-on-deploy: skipped`, all 12 dynamic routes |

All gates with `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `AI_KEY_MASTER_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY` unset.

### Acceptance criteria coverage

| AC | Test evidence | Status |
|---|---|---|
| AC1: no behaviour change beyond C10 | `pnpm typecheck`, `pnpm lint`, offline `pnpm build`, full `pnpm test` all green with DB/key/provider variables unset; HANDOVER C1-C14 record complete with deliberate test changes in §3 | MET |
| AC2: multi-action behaviour (DEC-022 §7) | `lib/ai/chat.test.ts` CE-7 (preflight, mixed orders, runtime failures, returned config failures, no-ops); new CE-G1:2285 (list with returned widget failure stops at done/failed/not_run); CE-G2 (rejecting executeConfigurationIntent stops before widget execute); CE-W1:2285 (configuration-only does not fail on widget read error, allowed change); CE-W2 (list with widget still fails on widget read error); `lib/ai/capabilities/action-list.test.ts` max-5; `interpret.test.ts` five-pass/six-refuse; `app/chat/actions*.test.ts`; `app/chat/add-paths.pglite.test.ts` | MET |
| AC3: key boundary unchanged | `lib/ai/boundaries.test.ts` LB-0..11 PASS; `lib/ai/capabilities/boundaries.test.ts` CB-0..CB-4-execute PASS; `lib/config/boundaries.test.ts` incl. BC-11 PASS; `app/actions.boundary.test.ts` PASS; `lib/ai/providers/resolve.test.ts` AR-9 PASS; `provider-deps.test.ts` PD-1..10 PASS; `provider-deps.pglite.test.ts` PASS; `provider-deps.interchange.test.ts` PASS; `key-status.test.ts` PASS; `key-store*.test.ts` PASS; `components/chat/ChatPanel.test.tsx` CV-4 PASS. No boundaries.test.ts file edited. | MET |
| AC4: chat replies identical (C13 refactor) | New golden tests written and run **before any C13 edit** (recorded in HANDOVER: golden test files at 11:00, first source edit at 11:02:31): G-R1 `app/chat/reply-messages.golden.test.ts` (37 cases, every execution code single/widget/thrown/list/interpreted/invalid/key_request/unavailable/error); G-R2 changedActions; G-C1 `components/chat/chat-markup.golden.test.tsx` (RO/EN markup snapshots). After refactor, both snapshots matched with **no `-u`** flag, proving identical reply/markup across the new component boundary. Unchanged and green: `app/chat/reply-messages.test.ts`, `components/chat/ChatReply.test.tsx`, `ChatView.test.tsx`, `ChatPanel.test.tsx`, `transcript.test.ts`, `app/chat/page*.test.tsx` | MET |
| AC5: one registry, lookup used by `validateAction` | `lib/ai/capabilities/registry.test.ts` CR-1 (registry keys exactly `["configuration","widgets"]`, actions equal the two closed sets); new CE-V1 (invalid/unsupported/prototype-key actions give exact rejection reasons); `chat.ts` `validateAction` calls `isCapabilityId` + `getCapability(id).actions` once (code review, no test assertion needed — structure enforced by types) | MET |
| AC6: HANDOVER record | One line per C1-C14 (`done`, `done (partial): …` or `skipped: <reason>`, using §0's exact lines for C6/C7/C8/C11/C12). `wc -l` before/after recorded for every source file. Before counts taken **before first edit**. See HANDOVER active-story section. | MET |

Additional new small tests passed (added before code changes, passing on old and new code):
- **IN-1** (`interpret.test.ts:77`): malformed generate result (`null`, `{ ok: true, text: 5 }`, `{ ok: false, error: "weird_code" }`) gives `provider_error/provider_error` (C6)
- **WI-1** (`widgets/intent.test.ts:57-64`): `widget_update` and `widget_clear` with invalid slots give malformed (C9 `validSlot`)
- **KS-6** (`key-status.test.ts:59`): encryption key material prefers master key over cron, falls back correctly (C8)

### Files changed verification

Source files touched (from HANDOVER "Files changed" §2):
- `lib/ai/chat.ts` ✓ (677 tokens, 277→207 lines)
- `lib/ai/capabilities/registry.ts` ✓ (18 tokens, 16→18 lines)
- `lib/ai/capabilities/types.ts` ✓ (10→9 lines)
- `lib/ai/capabilities/configuration/capability.ts` ✓ (7→6 lines)
- `lib/ai/capabilities/widgets/capability.ts` ✓ (9→8 lines)
- `lib/ai/capabilities/action-list.ts` ✓ (53→50 lines)
- `lib/ai/capabilities/configuration/intent.ts` ✓ (94→64 lines)
- `lib/ai/capabilities/configuration/grounding.ts` ✓ (56→55 lines)
- `lib/ai/capabilities/configuration/interpret.ts` ✓ (45→25 lines)
- `lib/ai/capabilities/widgets/intent.ts` ✓ (142→113 lines)
- `lib/ai/capabilities/widgets/execute.ts` ✓ (63→48 lines)
- `lib/ai/capabilities/widgets/context.ts` ✓ (27→29 lines, Promise.all rewritten)
- `lib/ai/providers/run-generation.ts` ✓ (62 lines, `normaliseResult` exported)
- `lib/ai/providers/resolve.ts` ✓ (70→77 lines, `ACTIVE_PROVIDER_FAILURE_REASONS` added)
- `lib/ai/provider-deps.ts` ✓ (150→141 lines, `resolveFromDeps` private)
- `lib/ai/key-status.ts` ✓ (91→88 lines, `getEncryptionKeyMaterial` rewritten)
- `lib/ai/key-store.ts` ✓ (155→149 lines, `encryptProviderKey` deleted)
- `lib/config/widgets.ts` ✓ (225→237 lines, C9 helpers added)
- `lib/config/ai-settings.ts` ✓ (91→74 lines, `normaliseOptionalText` private)
- `app/chat/reply-messages.ts` ✓ (145→144 lines, `isSuccess` rewritten)
- `components/chat/chat-state.ts` ✓ (30→31 lines, `ChatReplyContent`/`ChatActionReplyState` types added)
- `components/chat/ChatReply.tsx` ✓ (61→56 lines, `textOf` helper added)
- `components/admin/AiSettingsAdmin.tsx` ✓ (132→122 lines, local type aliases removed)

New test files (golden, written before source edits):
- `app/chat/reply-messages.golden.test.ts` ✓ (37 test cases)
- `app/chat/__snapshots__/reply-messages.golden.test.ts.snap` ✓
- `components/chat/chat-markup.golden.test.tsx` ✓ (RO/EN snapshots)
- `components/chat/__snapshots__/chat-markup.golden.test.tsx.snap` ✓

Deliberate test changes (§3 of plan):
- `lib/ai/capabilities/configuration/intent.test.ts` CI-4: calls `parseConfigurationAction` directly instead of wrapped `parseConfigurationOutput` (C3)
- `lib/ai/capabilities/registry.test.ts` CR-1: expects `Object.keys(CAPABILITY_REGISTRY)` instead of `CAPABILITY_IDS` (C11)
- `lib/ai/capabilities/registry.test.ts` CR-2: **deleted** entirely (C11)

Not touched (as planned):
- `lib/config/ai-keys.ts` (§0.2: test seam kept)
- `lib/monitoring/widget-engine.ts` (no C finding)
- `components/admin/ProviderKeySaveForm.tsx` (no C finding)
- `app/admin/ai/*` (no C finding)
- `lib/ai/capabilities/configuration/prompt.ts` (§0.5: CX-1 pins trim)
- `lib/ai/capabilities/configuration/execute.ts` (§0.13: kept exports)
- Every `boundaries.test.ts` (AC3: unchanged)
- `messages/*.json`, `drizzle/`, `lib/db/schema.ts`, `package.json`, lockfile

### No failures

All 222 test files passed. No test output suggests any breaking change. All acceptance criteria are MET.

Denied or attempted commands: none

