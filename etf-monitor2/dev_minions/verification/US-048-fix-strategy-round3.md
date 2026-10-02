# US-048 — Fix strategy, round 3 (Sprint 9 audit C1 / AC5)

_Author: story-planner role (Copilot, fix-strategy mode). Read-only on code. No git, no secrets,
no live migration, no nested agents. Inputs: `AGENTS.md`, `SPRINT-09-audit.md` C1,
`US-048-audit-review.md` round 2 (FAIL), `lib/deploy/migrate.ts` and `lib/deploy/migrate.test.ts`
as currently in the working tree (MD-G13/MD-G14 already applied)._

## 1. Finding being closed

Round 2 FAIL: `DEFAULT_RE` was tested against the whole breakpoint block, so an unrelated
`DEFAULT` (e.g. inside a preceding `CREATE TABLE`) hid an unsafe
`ADD COLUMN ... NOT NULL` in the same block. Required: scope the `DEFAULT` check to the
`ADD COLUMN` itself, add the defaulted-`CREATE TABLE` + unsafe-`ADD COLUMN` regression, re-run the
focused tests. C1's original requirement (no `CREATE TABLE` block exemption; `DROP` after
`CREATE TABLE` in one block is flagged) must stay closed.

## 2. Evaluation of what is already applied

`migrate.ts` now:
- scans every block (no `CREATE TABLE` skip) → C1 `DROP` bypass closed (MD-G11);
- extracts each clause with `ADD_COLUMN_CLAUSE_RE = /\bADD\s+COLUMN\b(?:(?!\bADD\s+COLUMN\b)[^;])*/gi`
  and tests `NOT NULL` / `DEFAULT` per clause → the round-2 reproducer is flagged (MD-G13), and a
  default on one added column no longer covers a sibling (MD-G14);
- a new table's own `NOT NULL` columns are never examined (MD-G1), because only `ADD COLUMN`
  clauses are checked.

**Verdict: the applied approach closes the exact round-2 reproducer and is the right shape.** It
is accepted as the base; round 3 only tightens the clause boundary and adds oracle cases. No
rewrite into a SQL parser and no new dependency.

## 3. Residual bypasses in the applied code (must fix in round 3)

The clause ends only at `;` or the next `ADD COLUMN`. Anything else in the same statement still
leaks into the clause:

| # | Input (one block) | Today | Why |
|---|---|---|---|
| R1 | `ALTER TABLE "x" ADD COLUMN "a" integer NOT NULL, ALTER COLUMN "b" SET DEFAULT 0;` | not flagged | sibling action's `DEFAULT` is inside the `a` clause — same bug class as round 2 |
| R2 | `ALTER TABLE "x" ADD COLUMN "a" integer NOT NULL -- DEFAULT later` (comment) | not flagged | a comment word counts as a default |
| R3 | `ALTER TABLE "x" ADD COLUMN "default" integer NOT NULL;` | not flagged | quoted identifier text matches `\bDEFAULT\b` |
| R4 | `ALTER TABLE "x" DROP "y";` (`COLUMN` is optional in Postgres) | not flagged | `DROP_RE` requires `TABLE|COLUMN` |
| R5 | `DROP/**/TABLE "x";` or `DROP -- c\nTABLE "x";` | not flagged | comment between keywords defeats `\s+` |

R1–R3 are the reviewer's finding in another form (a `DEFAULT` that does not belong to the added
column). R4–R5 are `DROP` bypasses the task explicitly asks to rule out.

## 4. Strategy (bounded, `lib/deploy/migrate.ts` only)

1. **Allow marker first, on raw text** — unchanged (`ALLOW_DESTRUCTIVE_RE` over the whole file).
2. **Normalise each block once** with a small hand-written scanner (no regex lookbehind tricks):
   - `--…EOL` and `/*…*/` comments → one space;
   - `'…'` string literals (with `''` escape) → `''`; `"…"` quoted identifiers (with `""`) → `""`;
   - leave dollar-quoted bodies (`$tag$…$tag$`) untouched (see §5 R-D).
   Structure (parens, commas, `;`) is preserved, so keyword tests stay meaningful.
3. **Destructive rules run on raw ∪ normalised text** (a match in either flags): raw keeps a
   `DROP` inside a string/dollar body visible (false positive is safe); normalised defeats R5.
   Widen `DROP_RE` to also catch `ALTER TABLE … DROP <identifier>` without `COLUMN` (R4), e.g.
   add `/\bALTER\s+TABLE\b[^;]*\bDROP\s+(?!CONSTRAINT\b|DEFAULT\b|NOT\s+NULL\b|IDENTITY\b|EXPRESSION\b)("|\w)/i`
   — wording is the implementer's; the oracle in §6 is binding. `DROP CONSTRAINT/DEFAULT/NOT NULL`
   stay unflagged (they relax, not destroy, data — not part of AC5's list).
4. **Per-column clause on normalised text, depth-aware:** an `ADD COLUMN` clause starts at
   `ADD [COLUMN]`… (keep `COLUMN` required as today — Drizzle always emits it) and ends at the
   first `;` **or the first comma at paren depth 0** after it. Commas inside `CHECK (a IN (1,2))`,
   `DEFAULT f(1,2)`, `numeric(10,2)` do not end the clause. Then flag
   `NOT NULL && !DEFAULT` within that clause only (also treat `GENERATED … AS` /
   `GENERATED … IDENTITY` as having a value — optional, note-only if skipped). This fixes R1, R2, R3
   and keeps MD-G13/MD-G14.
5. Keep the public signature and `MigrationGuardViolation` rule set unchanged; one violation per
   offending clause/statement is fine (tests use `toContainEqual`).

Do **not**: edit any `drizzle/*.sql`, weaken or delete MD-G1..G14, broaden the allow marker, or
touch `runMigrateOnDeploy` / `sanitizeMigrationOutput` / `scripts/migrate-on-deploy.ts`.

## 5. Risks

- **R-A False positives on future Drizzle output.** Mitigated by MD-G10 (all real
  `drizzle/*.sql`, currently 0000–0003, must still return `[]`). Current files contain `DEFAULT 'ro'`
  inside `CREATE TABLE` and `ADD CONSTRAINT … FOREIGN KEY` statements only; neither is an
  `ADD COLUMN` nor a `DROP`.
- **R-B Scanner bugs (unterminated quote/comment).** Treat an unterminated literal/comment as
  running to block end; never throw. Add one unit case (oracle G-N4).
- **R-C Over-blocking a legitimate relaxation** (`ALTER COLUMN … DROP NOT NULL/DEFAULT`). Explicitly
  excluded by the R4 pattern; oracle G-N3 pins it.
- **R-D Out of scope, record as Note for tech-lead, not a round-3 blocker:** dynamic SQL in
  `DO $$ … EXECUTE … $$` built by concatenation, `TRUNCATE`, `DELETE`, `DROP INDEX/VIEW/TYPE/SCHEMA`.
  AC5 lists only DROP TABLE/COLUMN, RENAME, ALTER TYPE, unsafe NOT NULL. A literal `DROP TABLE`
  inside a dollar body is still caught by the raw-text pass.
- **R-E Test-title drift.** MD-G10's title says "0000 and 0001" but it scans every file; retitle
  only (no assertion change) to avoid misleading verdicts.

## 6. Test oracle (add to `lib/deploy/migrate.test.ts`; all existing MD-G1..G14 stay verbatim)

Flagged (`toContainEqual`):
| Id | SQL (single block, no breakpoint) | Rule |
|---|---|---|
| G-P1 | `ALTER TABLE "x" ADD COLUMN "a" integer NOT NULL, ALTER COLUMN "b" SET DEFAULT 0;` | NOT-NULL-NO-DEFAULT |
| G-P2 | `ALTER TABLE "x" ADD COLUMN "a" integer NOT NULL -- DEFAULT 0\n;` | NOT-NULL-NO-DEFAULT |
| G-P3 | `ALTER TABLE "x" ADD COLUMN "default" integer NOT NULL;` | NOT-NULL-NO-DEFAULT |
| G-P4 | `ALTER TABLE "x" ADD COLUMN "a" integer CHECK ("a" IN (1,2)) NOT NULL;` | NOT-NULL-NO-DEFAULT |
| G-P5 | `ALTER TABLE "x" DROP "y";` | DROP |
| G-P6 | `DROP/**/TABLE "x";` | DROP |
| G-P7 | `CREATE TABLE "n" ("id" integer DEFAULT 0, "s" text DEFAULT 'DROP');\nALTER TABLE "x" DROP COLUMN "y";` | DROP |
| G-P8 | `CREATE TABLE "n" ("id" integer DEFAULT 0);\nALTER TABLE "e" ADD COLUMN "x" integer NOT NULL;` | = MD-G13, keep |

Not flagged (`toEqual([])`):
| Id | SQL | Pins |
|---|---|---|
| G-N1 | `ALTER TABLE "x" ADD COLUMN "a" numeric(10,2) DEFAULT 0 NOT NULL;` | depth-0 comma rule; own default |
| G-N2 | `ALTER TABLE "x" ADD COLUMN "a" text DEFAULT 'a,b' NOT NULL, ADD COLUMN "b" text;` | literal comma + sibling safe |
| G-N3 | `ALTER TABLE "x" ALTER COLUMN "y" DROP NOT NULL;` and `… ALTER COLUMN "y" DROP DEFAULT;` | relaxations not DROP |
| G-N4 | `ALTER TABLE "x" ADD COLUMN "a" text DEFAULT 'unterminated` | scanner never throws (assert no throw; result any) |
| G-N5 | MD-G1 (`CREATE TABLE` with own `NOT NULL` columns) | own columns exempt |
| G-N6 | MD-G10 over real `drizzle/` | no false positive today |

Pass condition for round 3: `pnpm exec vitest run lib/deploy/migrate.test.ts` exit 0 with every
G-P/G-N and MD-1..MD-G14 green, then `pnpm typecheck` and `pnpm lint` 0 errors, all with
`DATABASE_URL`, `CRON_SECRET`, `VERCEL_ENV`, `AI_KEY_MASTER_KEY` and provider keys removed from
the process environment. Re-run only the review gate (C1/AC5 scope) plus the focused test file;
no live database, no `db:migrate`.

## 7. Files expected to change in round 3

- `lib/deploy/migrate.ts` (normaliser, depth-aware clause end, widened DROP)
- `lib/deploy/migrate.test.ts` (G-P1..G-P7, G-N1..G-N4 added; MD-G10 retitle only)
- `dev_minions/HANDOVER.md` "Files changed" (implementer, not this file)
