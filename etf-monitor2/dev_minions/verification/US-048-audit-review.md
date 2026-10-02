# US-048 — Independent audit review

## Round 2 — Sprint 9 audit C1 / AC5 only

**Verdict: FAIL**

### Finding

**Critical — AC5 remains bypassable when an unrelated `DEFAULT` appears in the same migration block.**

`guardMigrationStatements` now scans each statement-breakpoint block without exempting blocks
beginning with `CREATE TABLE`, so the added MD-G11 case catches a later `DROP TABLE`, and MD-G12
catches a later `ADD COLUMN ... NOT NULL` when no default appears anywhere in the block.
However, `DEFAULT_RE` is tested against the entire block alongside `ADD_COLUMN_RE` and
`NOT_NULL_RE` (`lib/deploy/migrate.ts:74,98`). For example, a block containing
`CREATE TABLE new_table (id integer DEFAULT 0); ALTER TABLE existing_table ADD COLUMN x integer
NOT NULL;` has all three matches; the final `!DEFAULT_RE.test(statement)` is false, so the
unsafe added column is not reported. This recreates the same class of expand-only guard bypass
that C1 identified, although through a different condition.

The existing `CREATE TABLE` non-null-column behavior is preserved: the check requires
`ADD_COLUMN_RE`, so a table's own `NOT NULL` columns do not trigger this rule. The DROP, RENAME,
ALTER COLUMN TYPE, unsafe ADD COLUMN, defaulted ADD COLUMN, and allow-marker cases remain in the
focused tests. `MD-G10` also verifies that the current migration files pass the guard.

**Required follow-up:** scope the `DEFAULT` check to the `ADD COLUMN` operation rather than the
whole breakpoint block, and add a regression case with a defaulted `CREATE TABLE` followed by
an `ADD COLUMN ... NOT NULL` without its own default in that same block. Re-run the focused
migration tests after the fix.

### Evidence produced

- Read `AGENTS.md`, the current `HANDOVER.md`, `.checkpoint.md`, `status.md`, Sprint 9 audit,
  US-048 story, and the migration guard and its tests.
- Ran `corepack pnpm exec vitest run lib/deploy/migrate.test.ts` after removing
  `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `AI_KEY_MASTER_KEY`, and provider-key variables
  from the test process environment: **exit 0; 1 file, 22 tests passed**.
- Initial `pnpm exec vitest ...` attempt could not run because `pnpm` was not on PATH; the
  Corepack invocation above succeeded. No database or live migration was run. No git command
  was run.

### Scope

This is an independent review of Sprint 9 audit C1 / US-048 AC5 only. No implementation,
tests, status board, or HANDOVER files were edited. The audit-review filename is separate
because ownership of the existing `US-048-review.md` is unclear.

## Round 3 — Sprint 9 audit C1 / AC5 only

**Verdict: FAIL**

### Finding

**Critical — a comment between `ALTER` and `COLUMN` bypasses the AC5 `ALTER COLUMN ... TYPE` check when the column identifier is quoted.**

The strategy normalizes comments to spaces and quoted identifiers to `""`. The resulting
`ALTER_TYPE_RE` requires a word character for the column name. The raw-text check does not
match a comment between the two keywords, while the normalized check sees an empty quoted
identifier and also does not match. This valid SQL is therefore accepted:

```sql
ALTER TABLE x ALTER/*comment*/COLUMN "y" TYPE integer;
```

Independent probe output: `guardMigrationStatements("probe.sql", sql)` returned `[]`.
This is in the explicitly required AC5 destructive-operation set (`ALTER COLUMN ... TYPE`),
so the guard does not yet preserve the stated safety boundary.

**Required follow-up:** preserve a recognizable identifier placeholder during normalization,
or otherwise allow the normalized form of a quoted identifier in the ALTER TYPE detector, and
add a regression test for the exact comment-separated, quoted-identifier form.

### Evidence produced

- Read `US-048-fix-strategy-round3.md`, current `lib/deploy/migrate.ts` and
  `lib/deploy/migrate.test.ts`, plus the prior independent finding above.
- Ran `corepack pnpm exec vitest run lib/deploy/migrate.test.ts` with
  `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `AI_KEY_MASTER_KEY`, and provider-key variables
  removed from the test process environment: **exit 0; 1 file, 36 tests passed**.
- Probed three additional SQL forms through a direct import of the pure guard function:
  - `ALTER TABLE x ALTER/*comment*/COLUMN "y" TYPE integer;` → **no violations** (the
    bypass above).
  - `ALTER TABLE x DROP/*comment*/COLUMN "y";` → `DROP` (caught).
  - `ALTER TABLE x ADD COLUMN "z" integer NOT NULL, ALTER COLUMN "y" SET DEFAULT 0;` →
    `NOT-NULL-NO-DEFAULT` (caught).
- No git command, secret read, or live migration was run.

### Scope

This round remains limited to Sprint 9 audit C1 / US-048 AC5. No implementation, test,
status-board, or HANDOVER file was edited; this round was appended only to this independent
audit-review file.

## Round 4 — Sprint 9 audit C1 / AC5 only

**Verdict: PASS**

### Finding closure

The Round 3 bypass is closed. `withoutCommentsAndLiterals` now replaces double-quoted
identifiers with the nonempty placeholder `"identifier"` while continuing to replace
single-quoted literals with `''`. After the comment is normalized to whitespace, the
comment-separated form reaches the existing ALTER TYPE detector with a recognizable quoted
identifier:

```sql
ALTER TABLE x ALTER/*comment*/COLUMN "y" TYPE integer;
```

My independent call to `guardMigrationStatements("probe.sql", sql)` returned
`[{"file":"probe.sql","rule":"ALTER-COLUMN-TYPE"}]`. This matches the new MD-G5a regression
assertion. I found no remaining bypass in the narrowly reviewed prior finding: the comment
between `ALTER` and `COLUMN` no longer defeats detection, while the normalization still
distinguishes quoted identifiers from single-quoted literal contents.

### Evidence produced

- Re-read the updated `lib/deploy/migrate.ts` normalization and ALTER TYPE detection, and the
  MD-G5a test in `lib/deploy/migrate.test.ts`.
- Ran `corepack pnpm exec vitest run lib/deploy/migrate.test.ts` after removing
  `DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `AI_KEY_MASTER_KEY`, and provider-key variables
  from the test process environment: **exit 0; 1 file, 37 tests passed**.
- Independently probed the exact Round 3 SQL input through a direct import of the pure guard
  function: **`ALTER-COLUMN-TYPE` violation returned**.
- No git command, secret read, or live migration was run.

### Scope

This review is limited to the previously failing Sprint 9 audit C1 / US-048 AC5 finding. No
implementation, test, status-board, or HANDOVER file was edited; this round was appended only
to this independent audit-review file.
