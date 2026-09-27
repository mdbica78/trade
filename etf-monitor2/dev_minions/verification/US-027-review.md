# US-027 — Independent review

## Round 1 — 2026-09-27
Verdict: PASS

Acceptance criteria:
- AC1: MET — `lib/ai/capabilities/types.ts:6-10` (`Capability<Input, Output>` contract), `lib/ai/capabilities/registry.ts:4-14`
  (`CAPABILITY_REGISTRY` with exactly one entry, `configuration`). Boundary rules proven by
  `lib/ai/capabilities/boundaries.test.ts` — `CB-1`/`CB-1b` (no capability file imports a concrete adapter or the
  wiring module; the checker itself is proven to flag `providers/gemini`, `providers/groq`, `provider-deps`,
  `key-status`, `default-registry`, `config/default-deps`, `lib/db/index`), `CB-2` (no file under `lib/ai/providers/`
  imports `lib/ai/capabilities`). `lib/config/boundaries.test.ts` (unchanged, still scans every `lib/config` file for
  an AI import) proves `lib/config/` still imports nothing from `lib/ai/`. Registry behaviour proven by
  `lib/ai/capabilities/registry.test.ts` `CR-1`, `CR-2`, `CR-3`. All ran green in this round (see Gates below).
- AC2: MET — `lib/ai/capabilities/configuration/context.ts:19-38` (`loadConfigurationContext`, built only from
  `listEtfs`/`listFieldsForEtf`, no `db.execute`/`sql` of its own). Proving test
  `lib/ai/capabilities/configuration/context.pglite.test.ts` `CC-1`..`CC-5`: seeds two active ETFs (BTBETRETF,
  TVBETETF) plus PTENGETF set inactive, `NOADPETF` with `adapter_key` NULL and `GHOSTETF` with an unregistered
  adapter (`CC-1` isActive map, `CC-2` both no-adapter/unregistered-adapter ETFs have `available: []`), tracks
  `net_asset` for TVBETETF (`CC-3`, both labels present), cross-checks against `listFieldsForEtf` directly (`CC-4`),
  and confirms the read is side-effect-free (`CC-5`). `CB-3` (`lib/ai/capabilities/boundaries.test.ts`) confirms no
  `sql\`` / `db.execute` / `drizzle-orm` specifier anywhere under `lib/ai/`. Ran green.
- AC3: MET — `lib/ai/capabilities/configuration/prompt.ts:25-73` (`buildConfigurationSystemPrompt`,
  `buildConfigurationRequest`): `json: true`, the four action names + exact schema lines, context symbols and every
  field's key + both labels, and the message goes only into `request.user`. Proving tests
  `lib/ai/capabilities/configuration/prompt.test.ts` `CP-1`..`CP-4` (schema/labels present verbatim, data block
  round-trips, injection-safe escaping of `<`) and `CX-1`/`CX-2` (`json`/`maxOutputTokens`/trimmed `user` correct;
  a sentinel token in the message is proven absent from `system`, and `buildConfigurationSystemPrompt.length === 1`
  so the message cannot reach it by construction). Ran green.
- AC4: MET — the full pipeline (`interpret.ts` → `prompt.ts` → `intent.ts` → `grounding.ts`) is exercised end-to-end,
  never a parser-only shortcut, by `lib/ai/capabilities/configuration/interpret.test.ts` `CX-4a`..`CX-4i` for every
  example message in the acceptance criterion (add/remove in both languages, VUAN/`nav_per_unit`, "activul net"/
  `net_asset`, untrack in both languages, a kept name). `CX-4e` correctly returns an intent against the plan's
  BTBETRETF-does-not-track-`nav_per_unit`-yet test context, and `interpret.pglite.test.ts` `CXP-2` confirms the same
  case against the real seeded context is `already_tracked` (matching the tech-lead's fix to the AC4 draft). Ran
  green.
- AC5: MET — `lib/ai/capabilities/configuration/intent.ts:95-116` (`parseConfigurationOutput`, wrapped in
  `try`/`catch`, never throws). Proving tests `intent.test.ts` `CI-1`..`CI-6` (prose → malformed, unknown action →
  unsupported, arrays/multi-object/`actions`-array/`{"action":"multiple"}` → multiple, missing/mistyped required
  properties → malformed, one fence tagged or untagged parses normally while two fences or leading prose do not) and
  `interpret.test.ts` `CX-5` (same rule through the full entry function). Ran green.
- AC6: MET — `lib/ai/capabilities/configuration/grounding.ts:13-57` (`groundAction`). Proving tests
  `grounding.test.ts` `CGd-1`..`CGd-10` cover every named reason (`symbol_not_in_message`, `unknown_field`,
  `already_tracked`, `not_tracked`, `unknown_etf`), the invented-name-becomes-null / verbatim-name-kept rule, symbol/
  field normalisation, and the token rule (`messageTokens`, confirming `XBTBETRETF` does not match `BTBETRETF`); plus
  `interpret.test.ts` `CX-6` through the full pipeline. Ran green.
- AC7: MET — `interpret.test.ts` `CX-7`: `{"action":"unsupported"}` for out-of-scope questions, and three concrete
  out-of-scope action names (`set_cron_hour`, `set_ai_provider`, `move_field`) each give `unsupported` (via
  `intent.ts`'s `CONFIGURATION_ACTION_SET` check, `intent.ts:68-73`); `{"action":"unclear"}` gives
  `unclear/model_unclear`. Ran green.
- AC8: MET — `interpret.ts:21-47`: exactly one `generate` call, wrapped so a throw/reject/malformed result all become
  `provider_error`, and the raw model text never enters the outcome. Proving tests `interpret.test.ts` `CX-8a`
  (all 7 `ProviderErrorCode`s pass through with their code — confirmed `PROVIDER_ERROR_CODES` is exactly 7 in
  `lib/ai/providers/types.ts:1-9`), `CX-8b` (throwing/rejecting/`undefined`-returning `generate` all become
  `provider_error`, sentinel message absent via `JSON.stringify`), `CX-8c` (exactly one call per outcome kind); and
  `interpret.pglite.test.ts` `CXP-1` (snapshots `etfs`, `tracked_fields`, `settings`, `field_catalog` before/after an
  `add_etf` and a `track_field` interpretation — unchanged). Ran green.
- AC9: MET — no test reaches the network: every fake provider (`test/helpers/ai-fakes.ts` `createFakeProvider`)
  never calls `fetch` at all in its `generate`, and every new/changed test file additionally stubs global `fetch` to
  throw in `beforeEach` as a second layer. `lib/ai/boundaries.test.ts` `LB-7` (unchanged) confirms no new
  dependency was added; git status (visible in this session's environment banner, not run by me) shows
  `package.json`/`pnpm-lock.yaml` untouched, consistent with that. I ran `pnpm typecheck` (clean), `pnpm lint`
  (0 errors, 5 pre-existing warnings, none in `lib/ai/capabilities`), `pnpm test` (1330/1330, 122 files — matches
  HANDOVER's own count), and `env -u DATABASE_URL -u GEMINI_API_KEY -u GROQ_API_KEY pnpm build` (offline, succeeds,
  same route list as before plus no new route) myself in this round.

Findings (ordered by severity):
1. (Note, non-blocking) `US-027-plan.md` §2 promises that every new test file "asserts in afterEach that it was
   never called" for the stubbed `fetch`. None of the seven new non-PGlite test files (`generate.test.ts`,
   `registry.test.ts`, `prompt.test.ts`, `intent.test.ts`, `grounding.test.ts`, `interpret.test.ts`) actually import
   or call `afterEach`/assert a call count — the only guard is the `beforeEach` stub that throws if reached. This
   still fully protects AC9 in practice (the fake provider's `generate` in `test/helpers/ai-fakes.ts:22-37` never
   references `fetch` at all, and a real call to the stub would surface as a wrong `provider_error` outcome that
   fails the test's own assertion), but the plan's stated technique and the shipped test code do not match. Cosmetic
   — does not change any test's actual guarantee.
2. (Note) `dev_minions/HANDOVER.md`'s in-flight note says "0 errors, 6 pre-existing warnings"; I measured 5 warnings
   this round (`pnpm lint` output: `timeout.test.ts` ×2, `default-deps.test.ts`, `types.test.ts`, `load-etfs.test.ts`
   ×1 each). Off-by-one in the log, not a code defect — flagging so the count gets corrected before hand-off.

Scope deviations:
- None found. `lib/ai/capabilities/**` and `test/helpers/ai-config-context.ts` are new; the only existing files
  touched are `lib/ai/boundaries.test.ts` (LB-0 list/count, LB-2 `ALLOWED_TARGETS`, exactly as the plan's §6
  describes). Grepped the whole repo (excluding `node_modules` and `dev_minions`) for `capabilities` — the only
  hits outside `lib/ai/capabilities/` itself are `test/helpers/ai-config-context.ts` and `lib/ai/boundaries.test.ts`,
  i.e. nothing in `app/`, `components/`, `messages/*.json`, `lib/config/**`, `lib/db/**` or `package.json` was
  touched, matching the plan's "not touched" list. No new runtime dependency (confirmed by `LB-7` passing and by the
  package manifests not appearing in the changed-files list).

Denied or attempted commands:
- One `git diff --stat -- package.json pnpm-lock.yaml` I attempted mid-review, out of habit, to double check no new
  dependency was added — denied, not retried. (The same fact was independently confirmed without git: `LB-7`
  passing plus the package manifests being absent from HANDOVER.md's "Files changed" and this session's git-status
  banner.)
