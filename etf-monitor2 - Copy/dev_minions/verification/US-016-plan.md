# US-016 — Plan
Planned by GitHub Copilot (fallback, no `story-planner` subagent available). The sprint detail
in `backlog/stories/US-016.md` already fully specifies files, task order and decisions; this
plan turns it into a criteria→tests table and a concrete file list.

## Decisions (no new stop needed)
- #3 (columns = union) and #4 (timeZone) — already Decided by tech-lead sprint review.
- #1 ("today's value" = newest `ok` report), #2 (ignore `parse_error` values), #5 (date format
  ro=dd.MM.yyyy, en=ISO) — non-blocking PRODUCT decisions; the story explicitly says "This story
  implements" the recommended option (A in each case), deferring only PO confirmation to the
  demo. Implementing as written; no user stop required.

## Files to touch
- New: `lib/format/number.ts`, `lib/format/number.test.ts`
- New: `lib/format/date.ts`, `lib/format/date.test.ts`
- New: `lib/monitoring/home.ts`, `lib/monitoring/home.pglite.test.ts`
- New: `components/HomeTable.tsx`, `components/HomeTable.test.tsx`
- Edit: `app/page.tsx` (async Server Component using the read model + HomeTable)
- Edit: `app/page.test.tsx` (drop `Home.intro` assertions, test the new table incl. DB-error path)
- Edit: `i18n/request.ts` (add `timeZone: "Europe/Bucharest"`)
- Edit: `messages/ro.json`, `messages/en.json` (new `Home.*` keys, remove `Home.intro`)
- Delete: `lib/format.ts`, `lib/format.test.ts` (replaced by `lib/format/number.ts`)

## Criteria → tests
- AC1 (rows/is_active/ordering) → `home.pglite.test.ts`: active-only, ordered by symbol, no-report row, null-adapter row
- AC2 (columns from config) → `home.pglite.test.ts`: insert/delete a `tracked_fields` row, column appears/disappears at `display_order`; untracked cell `{tracked:false}`; header labels from `field_catalog`
- AC3 (values from newest `ok`) → `home.pglite.test.ts`: no value on newest ok → empty cell, never older report; no ok report → empty + no date; newer `parse_error` (with values) changes nothing
- AC4 (PDF link) → `home.pglite.test.ts`: link = newest report row `source_url` regardless of status; no such row → no link
- AC5 (adapter unavailable) → `home.pglite.test.ts` (NULL key) + registry-based case (unregistered key); `HomeTable.test.tsx` renders marker
- AC6 (formatNumber) → `lib/format/number.test.ts`: exact cases from the story (trailing zeros, no grouping char ever, `-0.006`, etc.)
- AC7 (formatReportDate) → `lib/format/date.test.ts`: boundary dates, timezone-independent, ro/en formats
- AC8 (bilingual) → `HomeTable.test.tsx` renders ro/en, `i18n/messages.test.ts` stays green with new keys
- AC9 (empty/error state) → `app/page.test.tsx`: no active ETFs → empty message; loader throws → generic translated error, no exception text/env leak
- AC10 (offline/build-safe) → PGlite only in tests; run `pnpm build` with `DATABASE_URL` unset locally as a manual check (documented in QA file, not a unit test — matches AGENTS.md "tests never call live Neon" and AC10's own wording about `pnpm build` passing)
- AC11 → `pnpm typecheck && pnpm lint && pnpm test && pnpm build`

## Sketch (from the story's Task section, condensed)
1. `lib/monitoring/home.ts`: `loadHomeTableViewModel(db, run?)` — mirrors `load-etfs.ts`'s shape:
   one SQL statement (or minimal set) run through an injected `BatchRunner`, joins
   etfs(active) × tracked_fields × field_catalog × newest `ok` report+values × newest
   any-status report (for link). Returns `{ columns, rows }` per the story's shapes.
2. `lib/format/number.ts` — string-based, no `Intl.NumberFormat` (rounding/grouping traps
   documented in the story's Notes). `lib/format/date.ts` — pure string slicing of the ISO
   date, no `Date` parsing (avoids TZ/rollover bugs).
3. `app/page.tsx` — async Server Component, `getDb()` + `loadHomeTableViewModel`, catches errors
   into a translated message, passes the view model to `components/HomeTable.tsx`.
4. Messages + `i18n/request.ts` timeZone.
5. Delete the placeholder `lib/format.ts`/test; ensure no other file imports it.

## Manual QA (deferred to US-016-qa.md, live steps only)
- `pnpm build` with `DATABASE_URL` unset (AC10) — can run locally, not live-resource dependent,
  do during implementation as a proof, not deferred.
- sprint-04.md steps 1, 2, 4, 5 (live app behaviour against seeded/real Neon data) — user's
  manual step, listed in the QA checklist.
