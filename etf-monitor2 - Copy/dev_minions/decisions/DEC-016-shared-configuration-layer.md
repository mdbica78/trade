# DEC-016 — One shared configuration-write layer for the admin forms and the chat

- Status: **Decided**
- Validated by tech-lead subagent (in-loop, DEC-009), 2026-09-26: FR9 requires chat and form to "operate on the
  same configuration model"; plain functions over `Db` + `BatchRunner` reuse the Sprint 3/4 pattern that PGlite
  already tests, and respect DEC-010 (no interactive transactions on neon-http).
- Source: Sprint 5 review (`backlog/sprints/sprint-05.md` → "Decisions needed" #2 and #3, US-020). Binds Sprint 6
  (US-027, US-028) and any later writer of configuration.

## Context
Sprint 5 builds the first writes to user configuration (`etfs`, `tracked_fields`, `settings`). Sprint 6 adds a
natural-language chat that must change the same data (FR1, FR2, FR5, FR9). If each path wrote its own SQL, the
validation rules (symbol format, soft removal, which fields are trackable, single `settings` row) would diverge.

## Decision
1. Every configuration write lives in `lib/config/*` as a plain function: it takes a `Db` and a `BatchRunner`
   (plus injected network/registry functions where it needs them), validates its input, and returns a typed result
   (`ok` or a closed error code). It never throws for invalid input and imports nothing from `next/*`, React,
   `app/` or AI code. A multi-statement change is one `BatchRunner` call.
2. Next.js Server Actions (admin forms) and the Sprint 6 chat capability are thin callers: they parse their input,
   call `lib/config/*`, and map the result to a translated message. They contain no SQL and never return exception
   text.
3. Adding an ETF runs adapter detection once (`registry.detect` over the latest report's text, one discovery
   request, at most one download, no retry, nothing stored from that report, FR4.1/FR4.2). Exactly one match sets
   `adapter_key`; anything else leaves it NULL. A duplicate or a reactivation makes no network request. A manual
   override accepts only a registered key or NULL.
4. Every function is tested on PGlite with the statements it ships, and the loaders it affects
   (`lib/monitoring/home.ts`, `lib/ingestion/load-etfs.ts`) are re-run in those tests.

## Consequences
- The chat (Sprint 6) maps intents onto `addEtf`, `setEtfActive`, the tracked-field functions and the settings
  functions; a chat story that needs a new rule adds it to `lib/config/`, not to the capability.
- Boundary tests in each `lib/config/*` story enforce point 1's import rule.
- Not decided here (product, `NEEDS USER`): how the chat obtains an ETF name when the user gives only a symbol
  (sprint-05.md, Sprint 6 notes).
