# US-003 review — Database schema and Drizzle/Neon setup

## Round 1 — 2026-09-23

Verdict: PASS

Reviewer: `story-reviewer` subagent (independent context; did not write the code). No git
commands were run — file inspection only, per AGENTS.md.

Sources read: `AGENTS.md`, story `dev_minions/backlog/stories/US-003.md`,
`dev_minions/verification/US-003-plan.md`, `dev_minions/architecture/data-model.md`,
`dev_minions/decisions/DEC-010-us003-schema-and-driver.md`, `dev_minions/HANDOVER.md`
"Files changed", and every file it lists.

### Acceptance criteria

- **AC1 (tables/columns)** — MET. `lib/db/schema.ts:15-116` defines all seven tables
  (`etfs`, `field_catalog`, `tracked_fields`, `reports`, `report_values`, `job_runs`,
  `settings`) with column names, SQL types, nullability and defaults matching
  `data-model.md` exactly (including DEC-010's NOT NULL amendment to the three FK
  columns). Proven by `lib/db/schema.test.ts` "tables and columns" describe block
  (7 table-name assertions + one `expectColumns` check per table, 8 tests) — ran green:
  `pnpm test` → `lib/db/schema.test.ts (14 tests)` all pass.
- **AC1 (FKs)** — MET. `schema.ts:46-48,61-63,82-84` declare exactly the three FKs
  (`tracked_fields.etf_id → etfs.id`, `reports.etf_id → etfs.id`,
  `report_values.report_id → reports.id`), all `onDelete: "cascade"`; `field_key` is not
  an FK anywhere (matches data-model.md "Notes"). Proven by `schema.test.ts:168-219`
  ("foreign keys" describe block), which also asserts NOT NULL on the three FK columns
  per DEC-010. Passing.
- **AC2** — MET. `UNIQUE (etf_id, report_date)` on `reports` (`schema.ts:74`) and
  `UNIQUE (report_id, field_key)` on `report_values` (`schema.ts:90`). Proven by
  `schema.test.ts:222-234` "duplicate-ingestion guards", and independently by the
  committed SQL (`drizzle/0000_init.sql:49,38`). Passing.
- **AC3** — MET. `pnpm db:generate` produces migration SQL
  (`drizzle/0000_init.sql`, `drizzle/meta/_journal.json`, `drizzle/meta/0000_snapshot.json`,
  all present on disk and listed in HANDOVER's "Files changed", none gitignored — verified
  `.gitignore` has no `drizzle/` exclusion). Proven by `schema.test.ts:236-272` "committed
  migration" (reads the journal + SQL from disk, checks all 7 `CREATE TABLE`, both unique
  guards, 3 `ON DELETE cascade`, and the `settings` CHECK). I independently re-ran
  `env -u DATABASE_URL pnpm db:generate`: output was "No schema changes, nothing to
  migrate", and no new file appeared under `drizzle/` (diffed directory listing
  before/after) — confirms no drift between `schema.ts` and the committed SQL.
- **AC4** — MET. `lib/db/index.ts:5-13` defines `MissingDatabaseUrlError extends Error`
  with `.name` set and a message naming `DATABASE_URL`, `.env.local`, and Vercel project
  env. `createDb` (`index.ts:17-22`) treats undefined/empty/whitespace-only as missing.
  `getDb` (`index.ts:26-31`) is a lazy module-level singleton. Proven by
  `lib/db/index.test.ts`: throws-on-missing (undefined/""/"   "), `instanceof` +
  `.name` + message check, `getDb()` throws when `DATABASE_URL` is stubbed empty,
  and the singleton/neon-call-count test, all with `@neondatabase/serverless` mocked
  (`vi.mock` at the top of the file) — no network possible. All 4 tests pass.
- **AC5** — MET. Independently ran `env -u DATABASE_URL pnpm test`: 3 files, 19/19 tests
  pass, no `DATABASE_URL` in the environment. Every DB-touching test is offline by
  construction (schema tests read `schema.ts` and local files only; the client test mocks
  the Neon driver).
- **AC6** — MET. Independently ran `env -u DATABASE_URL pnpm build`: compiles, typechecks,
  and generates static pages successfully with no `DATABASE_URL` set. No page imports
  `lib/db` yet (confirmed via grep — no `lib/db` reference under `app/`), so the lazy
  client's design isn't even exercised at build time yet, but nothing regressed.
- **Notes (report_date wording)** — MET. `schema.ts:64` has a JSDoc comment on
  `reportDate`: "Date the report is FOR, not published/fetched — see US-001 FINDINGS
  (footer date vs filing stamp)." Matches the story's verification note.

Also independently ran `pnpm typecheck` and `pnpm lint`: both clean, no errors/warnings.

### AGENTS.md non-negotiables — check

- Deterministic extraction / adapter-per-format / AI scope: not touched by this story, N/A.
- Missing daily report → empty day: not implemented yet (later story); schema supports it
  correctly — `reports` has no default `status`, and FR4.1 is satisfied by absence of an
  `ok` row per data-model.md's own note (`architecture/data-model.md:50`). No conflict.
- next-intl ro+en: no UI strings introduced by this story (backend/schema only). N/A.
- DEC-007 number display: no display code in this story. N/A.
- Secrets: `.env.example` only documents `DATABASE_URL`/`CRON_SECRET` as empty placeholders,
  no secret values in code or logs. `drizzle.config.ts` reads credentials from
  `process.env.DATABASE_URL` only when set, never hardcoded, never loads a `.env` file
  itself. Clean.
- No weakened/skipped tests: none found; tests assert real structural facts (SQL types,
  notNull, defaults, FK cascade, unique columns, generated-SQL content) rather than "the
  code runs".
- No scope creep: `find . -newer package.json` (excluding node_modules/.next/.git) turns
  up exactly the files HANDOVER.md lists as changed, plus `next-env.d.ts` and
  `tsconfig.tsbuildinfo` (both gitignored build artifacts, not real changes). No app code
  under `app/` consumes `lib/db` yet — correctly deferred, per the story's "Out of scope"
  section, to later stories. The two TECHNICAL decisions (D1 FK nullability, D2 Neon
  driver mode) went through DEC-010, validated by `tech-lead`, not self-approved by the
  implementer — process followed correctly.
- Version-control rule: I ran no git commands, read-only or otherwise, during this review.

### Findings

None — no Critical, Warning, or Note-level findings. Implementation matches the plan
exactly, including the two DEC-010 amendments (NOT NULL FKs, neon-http driver), and every
acceptance criterion has a real, currently-green, offline test.

### Scope deviations

None.

### Not independently verifiable here

- The plan's optional (non-AC) offline smoke check for `drizzle-kit migrate` driver
  resolution (localhost URL) — HANDOVER.md records the sandbox denied running it during
  implementation; it does not gate any AC (AC3/AC5/AC6 do not depend on it) and the real
  Neon migration is explicitly out of scope for this story (deferred to US-006 as
  MANUAL-QA). Not re-attempted in review since it needs a permission this environment
  denies and isn't required for a PASS verdict.
