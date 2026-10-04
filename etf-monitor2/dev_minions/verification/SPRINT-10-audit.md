# Sprint 10 audit

**Date:** 2026-10-03  
**Verdict: PASS — no cross-story Critical findings.**

## Scope and method

Reviewed `AGENTS.md`, `dev_minions/HANDOVER.md`, `.checkpoint.md`,
`status.md`, Sprint 10 and US-040..042 criteria, the binding
`SPRINT-10-review.md` and DEC-021, and each story's available plan,
independent review/test verdicts, and QA handoff. Inspected the shared
provider-key storage/wiring path, admin settings composition, fixed provider
catalogue/model picker, and chat refusal/reply/transcript path.

This was a source and handoff audit, not a test rerun. Gate results below are
reported by the cited independent verdicts; no tests, build, git command,
live call, migration, environment secret, credential file, or `ai_provider_keys`
row was accessed. Only this audit file was written.

## Cross-story audit

| Integration | Audit result | Evidence |
|---|---|---|
| US-040 key storage → provider resolution | **No material finding.** Key encryption and row access are isolated in `lib/ai/key-store.ts`; `loadActiveProvider` awaits stored-key loading before the unchanged synchronous resolver, with the stored-key-then-environment fallback. The PGlite wiring test exercises decryption, key-free status projection, and missing-table fallback. | `lib/ai/key-store.ts` (`encryptProviderKeyWithMaterial`, `readStoredProviderKey`); `lib/ai/provider-deps.ts` (`loadStoredProviderKeys`, `loadActiveProvider`); `lib/ai/provider-deps.pglite.test.ts` PD-P1..PD-P3; US-040 review/tests. |
| US-040 key controls ↔ US-041 provider/model settings | **No material finding.** Provider IDs are sourced from the same catalogue for settings validation and stored-key config. `AiSettingsAdmin` composes the provider/model form separately from per-provider write-only key forms; US-041 delegates only provider/model fields to its picker. The save-settings action reads only `provider` and `model`, while key save/clear actions are separate. Injected `baseUrl` is covered at both form and adapter request boundaries. | `lib/ai/settings-deps.ts` (`createAiSettingsDeps`, `createProviderKeyConfigDeps`); `app/admin/ai/actions.ts`; `components/admin/AiSettingsAdmin.tsx`; `components/admin/AiProviderModelFields.tsx`; `app/admin/ai/actions.test.ts` AA-2; `lib/ai/providers/gemini.test.ts` GM-7 and `groq.test.ts` GQ-6; US-041 review/tests. |
| US-040 provider runtime ↔ US-042 chat refusal | **No material finding.** `handleChatMessage` recognizes key-setting requests before invoking its dependency factory, so the request bypasses stored-key loading, provider resolution and generation. The fixed outcome maps to a key-free reply with the `/admin/ai` link; the client transcript substitutes a localized hidden label for the submitted message. Focused tests cover refusal before provider/context/execution calls and transcript redaction. | `lib/ai/chat.ts` (`isProviderKeyRequest`, pre-`depsFactory` branch); `app/chat/reply-messages.ts` (`key_request`); `components/chat/ChatPanel.tsx`; `components/chat/transcript.ts`; `lib/ai/chat.test.ts`; `components/chat/transcript.test.ts`; US-042 review rounds 2–3 and QA checklist. |
| US-040 migration and existing settings reads | **No material finding.** The encrypted-key table is a separate additive migration, registered after the existing migrations. Missing-table reads are treated as no stored key, and the shared provider-deps tests verify environment fallback rather than a settings failure. The full journal and schema shape are covered by the reported PGlite migration tests. | `drizzle/0003_ai_provider_keys.sql`; `drizzle/meta/_journal.json`; `lib/ai/provider-deps.ts` (`isMissingProviderKeyTable`); `lib/ai/provider-deps.pglite.test.ts` PD-P3; `US-040-tests.md` AC1/AC6. |

The isolated Gemini/Groq default remains consistent across the story and
sprint files. D-1 is still **PROPOSED / NEEDS USER**; no custom endpoint or
unnamed provider was added. US-042's fixed reply/refusal closes the earlier
AC3 findings recorded in its review; its QA handoff explicitly distinguishes
the initial tester evidence from the later AC3 fix and review.

## Story disposition

| Story | Audit result | Handoff |
|---|---|---|
| US-040 | No cross-story finding; no reopen recommended. | Review and test verdicts report PASS. Codex QA run 1 is **BLOCKED** only by missing local modules/executables (`@vitest/utils`, Next, and `@parcel/watcher`); no product failure was established. |
| US-041 | No cross-story finding; no reopen recommended. | Independent review and tests report PASS. The review's stale test-fixture IDs and absent provider-switch interaction assertion are non-blocking coverage notes; production catalogue IDs remain Gemini/Groq. |
| US-042 | No cross-story finding; no reopen recommended. | Round-3 AC3 re-review and round-1 test verdict report PASS. The QA checklist calls out that its original AC3 evidence predates the fix and directs verification of the final refusal/redaction path. |

## Notes

- Codex QA is not complete for Sprint 10: US-040's current QA attempt is
  blocked by the local dependency tree; US-041 and US-042 QA runs are pending.
  This is an environment/QA handoff, not a cross-story implementation
  Critical, and does not change this audit verdict.
- `status.md`'s Sprint 10 roadmap row still says “Not detailed,” although
  Sprint 10 and all three story files are detailed and reviewed, and the
  Story board records the stories as Awaiting QA. This is stale bookkeeping;
  no board edit was made within this audit's scope.
- The audit did not independently rerun any automated gates; all test and
  build claims remain those of the respective test verdicts and HANDOVER.

**Denied or attempted commands:** none. No git command, secret/credential
file, secret value, live resource, migration, or `ai_provider_keys` row was
accessed.
