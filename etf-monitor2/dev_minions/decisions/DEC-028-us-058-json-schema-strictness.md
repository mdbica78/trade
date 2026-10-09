# DEC-028 — US-058 JSON-schema strictness

Status: **Decided** — option 1 (`strict: false`, envelope-only schema). Scope: the OpenAI-compatible `json_schema`
request built for US-058; amends the literal `strict: true` in DEC-027 §2 (DEC-027 itself is not edited).

Validated by tech-lead subagent (in-loop, DEC-009), 2026-10-08: DEC-027 §2's envelope-only schema leaves action items
open (`ACTION_ITEM_SCHEMA` in `lib/ai/capabilities/action-list.ts` has no `required` and no `additionalProperties: false`),
which OpenAI strict mode rejects — so `strict: true` would 400 → `unsupported_format` → downgrade on every first call,
spending the cap and losing schema guidance; `strict: false` keeps both DEC-027 intents (envelope schema + server as the gate).

## Context

DEC-027 §2 specifies OpenAI-compatible `json_schema` output with `strict: true`, and also says the schema covers only
the response envelope while inner action objects remain open for server-side validation. Provider strict modes generally
require every object in the schema to enumerate all properties and disallow additional properties. The US-058 plan
therefore selects `strict: false` with the envelope schema, retaining server-side parsing and validation as the
authoritative safety boundary.

The current US-058 implementation and tests use `strict: false`. This conflicts with the literal `strict: true` value
in DEC-027 and needs a Technical Lead decision before US-058 can pass independent review and return to Awaiting QA.

## Question

How should US-058 reconcile the provider strict-mode setting with DEC-027's envelope-only schema?

## Options

1. **Keep `strict: false` and the envelope-only schema (recommended).** Treat the schema as structured-output guidance;
   rely on the existing closed parser, normaliser, and server validation for correctness. Update DEC-027's literal if
   approved. This matches the current implementation and avoids a downgrade on every OpenAI-compatible call.
2. **Keep `strict: true` and make the complete schema provider-strict-compatible.** Constrain action objects and nested
   definitions, represent optional values as required nullable fields, and disallow additional properties at every
   object level. Update the implementation and add request/schema compatibility coverage for the supported providers.
   This more closely follows DEC-027's literal but may increase schema complexity or encounter provider-specific limits.

## Recommendation

Choose option 1. The server remains the final validator, and `strict: false` avoids sending a schema that fails
provider strict-mode requirements. The Technical Lead should amend DEC-027 or explicitly record the bounded US-058
exception before this story proceeds to independent review.

## Scope and impact

This decision affects only the OpenAI-compatible `json_schema` request's `strict` value and its documentation/tests.
It does not change the provider-family output modes, schema envelope, Gemini `responseSchema`, validation pipeline,
correction policy, or confirmation-token behavior.

## Tech-lead validation 2026-10-08

Checked against DEC-027 §2–§3 and the code:
- `lib/ai/providers/openai-compatible.ts:22` sends `json_schema: { name: "chat_answer", strict: false, schema }`;
  `lib/ai/providers/openai-compatible.test.ts:99` (test "OC-S1 (US-058)") asserts that exact body. Keep it.
- `ANSWER_JSON_SCHEMA` (`lib/ai/capabilities/action-list.ts`) closes only the envelope (`required` all three keys,
  `additionalProperties: false`); action items and `WIDGET_DEFINITION_SCHEMA` stay open, exactly as DEC-027 §2 says.
  With `strict: true` that schema is not strict-compatible, so option 2 would have to rewrite the item schema into a
  closed, all-required shape — the "one strict union schema" DEC-027 §2 explicitly rejected.
- The downgrade (DEC-027 §2) and the call cap (§3) are unaffected: a provider that still rejects `json_schema` returns
  400/422 → `unsupported_format` → one `json_object` retry (`OC-S2`, `lib/ai/model-call.test.ts`).
- Server validation (`parseActionListOutput`, `stripSchemaNulls`, normalisation, per-capability strict validators)
  remains the only correctness gate, as before.

Binding rule from now on: OpenAI-compatible `json_schema` requests use `strict: false` while the schema is envelope-only.
Switching to `strict: true` needs a new DEC that also makes the whole schema strict-compatible and adds per-provider
request tests. No requirement text, product choice or ADR changes. Index row in `decisions/README.md` updated.
