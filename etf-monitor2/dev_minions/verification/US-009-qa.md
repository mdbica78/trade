# US-009 QA checklist — Adapter interface and registry

Round 1: review PASS, tests PASS (235/235 incl. 92 new). No fix loop needed.

Acceptance criteria AC1-AC7 are the story's own (not agent-drafted — `backlog/stories/US-009.md`
already had them at detail time), so no PO confirmation of criteria wording is needed here.

## Manual checks

None. This story is pure TypeScript with no DB, network, UI or PDF-library code — everything is
tested offline. The sprint's live check (US-011 AC7) exercises the registry end to end once
US-010 registers `brd-depositary`.

## Non-blocking notes

- `types.test.ts:10` has one cosmetic ESLint warning (`_text` unused param) — `eslint.config.mjs`
  has no `argsIgnorePattern`; lint still exits 0. Not worth a config change for one test file.

## Files changed

- `lib/extraction/adapters/types.ts` (new)
- `lib/extraction/adapters/validate.ts` (new)
- `lib/extraction/adapters/registry.ts` (new)
- `lib/extraction/adapters/default-registry.ts` (new)
- `lib/extraction/adapters/types.test.ts`, `validate.test.ts`, `registry.test.ts`, `boundaries.test.ts` (new)
