# US-033 review — Diagnosable load failures and schema-drift visibility

## Round 1 — 2026-09-28
Verdict: PASS

Method: HANDOVER.md's "Files changed (US-033, in flight)" section says "(none yet — see plan §6 ...
for the full target list)" even though the implementation is complete, so I used the plan's §6
"Files changed (expected)" list as the file scope for this review and read every file in it myself
(source and tests). This is itself flagged below as a process finding.

Acceptance criteria:
- AC1: MET — `lib/log/load-error.ts` implements `describeLoadError`/`logLoadError` exactly per
  DEC-019 §1: `NAME_RE`/`CODE_RE`/`RELATION_RE`/`RELATION_IN_MESSAGE_RE` (lines 7-10), a 4-level
  (`error` + 3 `cause`) walk with cycle guard (lines 37-57), never reading `message`/`stack` into
  the result. Proven by `lib/log/load-error.test.ts` LE-1 (Drizzle-wrapper shape, `toEqual` +
  `Object.keys` exactness, line 16-17), LE-2 (exact line string + forbidden-fragment scan, line
  130-146), LE-3/LE-4 (invalid code/relation dropped, line 20-43), LE-9 (env-stub does not leak,
  line 148-153).
- AC2: MET — all 8 in-scope pages (`app/page.tsx:6-15`, `app/etf/[symbol]/page.tsx:9-18`,
  `app/admin/etfs/page.tsx:11-32`, `app/admin/etfs/[symbol]/fields/page.tsx:13-22`,
  `app/admin/ai/page.tsx:12-21`, `app/admin/cron/page.tsx:16-25`,
  `app/admin/operations/page.tsx:8-17`, plus `lib/ai/chat.ts:119-128` for `/chat`, whose page has
  no catch of its own) call `logLoadError("<scope>", error)` in their catch block and keep the
  unchanged generic return. Proven by one `LE-Pn` case per page (grepped and confirmed present:
  `app/page.test.tsx:83` LE-P1, `app/etf/[symbol]/page.test.tsx:162` LE-P2 +`:181` LE-P2n,
  `app/admin/etfs/page.test.tsx:93` LE-P6, `app/admin/etfs/[symbol]/fields/page.test.tsx:110` LE-P7
  +`:134` LE-P7n, `app/admin/ai/page.test.tsx:176` LE-P8, `app/admin/cron/page.test.tsx:119` LE-P9,
  `app/admin/operations/page.test.tsx:65` LE-P10, `app/chat/page.load-error.test.tsx:32` LE-P5,
  `lib/ai/chat.test.ts:50` LE-C1, `lib/health.test.ts:160` HC-6, `app/health/page.failure.test.tsx:92`
  HP-F4). Each asserts byte-identical HTML to a generic-error control case (`toBe`) plus exactly
  one sanitised `[load-error]` line; the two not-found cases (LE-P2n/LE-P7n) assert zero lines.
- AC3: MET — `lib/health.ts` adds `schemaTableNames` (derived from `is(v, PgTable)` over the
  schema module, line 27-32) and `buildSchemaProbeStatement` (one parameterised `to_regclass`
  statement, never naming a table literally, line 38-43), run sequentially after the counts inside
  the same 8s race (line 49-57, 65). `app/health/page.tsx:54-65` renders `t("schemaStale")` plus a
  `data-missing-table` list only when `missingTables.length > 0`, both RO/EN via `Health.schemaStale`
  (`messages/en.json:247`, `messages/ro.json:247`). Proven on real PGlite by
  `lib/health.pglite.test.ts` HS-1 (fully migrated → empty), HS-2 (dropped
  `etf_report_links` → named), HS-3 (synthetic table added to the schema module → reported, proving
  the list is derived); `app/health/page.schema.pglite.test.tsx` HP-S1 (ro/en, dropped table shows
  the line + `data-missing-table` matching `^[a-z_][a-z0-9_]*$`) and HP-S2 (ro/en, migrated shows
  neither). `lib/health.test.ts` HC-5 (counts resolve, probe never settles → still times out at
  `HEALTH_QUERY_TIMEOUT_MS`) and the unchanged HP-F2 (its fake db has no `execute`, so the probe is
  never reached and the original timeout path is untouched) keep the 8s guard proven.
- AC4: MET — `lib/monitoring/home.ts` gates the fallback on both SQLSTATE `42P01` and the derived
  `etf_report_links` table name (`isMissingReportLinksTable`, line 155-158) and only retries the
  reports-only statement (`buildReportOnlyLinksStatement`, line 144-151) once, logging through
  `logLoadError("home/report-links", ...)` (line 356-388). Proven by
  `lib/monitoring/home-fallback.pglite.test.ts`: HF-1 (dropped table → identical result, 2 runner
  calls, exactly one correctly-shaped log line), HF-2 (dropped `reports` → rejects, 1 call, 0 log
  lines — proves the fallback is not entered for other failures), HF-3 (`42703` on the same
  relation text → rejects, proving the code gate), HF-4 (`42P01` on `reports` → rejects, proving the
  relation gate), HF-5 (retry itself throwing → propagates the second error, still 1 log line), HF-6
  (normal path unaffected), HF-7 (`buildReportOnlyLinksStatement` rows equal
  `buildLatestReportLinksStatement` rows when no link row exists, including an inactive ETF and a
  NULL `source_url` report). `home-links.pglite.test.ts`/`home.pglite.test.ts`/`home-delta.pglite.test.ts`
  are unchanged (read, not re-run by me — the tester's gate covers they still pass).
- AC5: MET — `app/load-error.boundary.test.ts` LB-E0 (exactly the 8 expected `page.tsx` files
  contain a `catch`, not vacuous), LB-E1 (every catch binds a variable and calls
  `logLoadError("<scope>", ...)`, no `console.` anywhere in `app/**/page.tsx`), LB-E2 (any
  `@/lib/db`-importing page must call `logLoadError(`), LB-E3 (`chat.ts`/`health.ts`/`home.ts` log
  through their documented scope), LB-E4 (`lib/log/load-error.ts` has no `process.env`, no
  `.stack`, exactly one `console.error(`, no import at all — confirmed independently by reading the
  file), LB-E5 (`console.` in non-test `lib/` sources confined to `load-error.ts` and the
  pre-existing `lib/cron/daily-handler.ts`; none in non-test `app/**`). `lib/ai/boundaries.test.ts`
  line 44 adds `lib/log/load-error` to `ALLOWED_TARGETS`.
- AC6: MET — `messages/en.json:247`/`messages/ro.json:247` add `Health.schemaStale` as a
  placeholder-free string in both locales. I ran `env -u DATABASE_URL -u CRON_SECRET
  -u GEMINI_API_KEY -u GROQ_API_KEY pnpm typecheck` (exit 0, no output) and `pnpm lint` myself this
  round (0 errors, 9 warnings — one new: `'_messages' is defined but never used` in
  `app/health/page.failure.test.tsx:92`, the rest pre-existing across unrelated files). `pnpm build`
  and `pnpm test` are the story-tester's gate — not re-run by me.
- AC7: MET — `README.md`'s "Deployment" section contains the bold sentence
  `**Migrate first, then deploy.**` (line 95) before the numbered "Deploy" step (line 106), and the
  exact `select to_regclass('public.etf_report_links');` check (line 101) with `null` and
  `pnpm db:migrate` in the same paragraph (line 104); "Health check" mentions `pnpm db:migrate` and
  `[load-error]` (lines 120-123). Proven by `test/readme-deployment.test.ts` RD-D1/RD-D2 (grepped
  and read in full). The MANUAL-QA step (open `/health` after a live redeploy; check Vercel logs for
  one `[load-error] ...` line) is written down in the story's "Manual QA (user)" section and in
  `test/readme-deployment.test.ts`'s own comment.

Findings (ordered by severity):
1. `dev_minions/HANDOVER.md` "Files changed (US-033, in flight)" — still reads "(none yet — see
   plan §6 ... for the full target list)" even though the implementation matches the plan's
   expected file list almost exactly (verified by reading every file myself; no file outside that
   list was touched). This violates the Handover protocol's "keep 'Files changed' accurate" and
   AGENTS.md step 4. Not a code defect and does not change any AC verdict above, but it should be
   fixed before the story moves to Awaiting QA — the story-tester and any later auditor rely on
   this list, and DEC-011/DEC-015 assume it is kept current. **Warning, not Critical** (evidence for
   every AC was independently locatable without it).
2. `app/health/page.failure.test.tsx:92` — the new HP-F4 case's unused `_messages` destructure
   parameter produces a new ESLint warning (`no-unused-vars`). Cosmetic only (0 errors); consistent
   with the same pattern already present elsewhere in the codebase (e.g.
   `lib/ai/providers/timeout.test.ts`). Note, not a defect.

Scope deviations:
- None found. Every changed/new file corresponds to the plan's §6 "Files changed (expected)" list;
  no file outside that list showed the story's new symbols (`logLoadError`, `describeLoadError`,
  `schemaTableNames`, `buildSchemaProbeStatement`, `buildReportOnlyLinksStatement`) when grepped.

Denied or attempted commands: none.
