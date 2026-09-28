# US-034 plan — Test stability under load and the pre-deploy gate

Simple story, planned inline (config change, one guard test, one command run three times).

## AC → tests/files
- **AC1** (named 30s limits) → `vitest.config.ts`: `TEST_TIMEOUT_MS`/`HOOK_TIMEOUT_MS` consts = 30_000, wired to
  `test.testTimeout`/`test.hookTimeout`. New `vitest.config.test.ts`: source-scan asserts both constants are
  literal `30_000` (fails if lowered) by reading the file with `fs`.
- **AC2** (no test weakened) → nothing else touched; reviewer/tester cross-check `.files-touched.log` against
  "Files changed" and grep for `it.skip`/`it.todo`/`.retry(` added this story (none expected).
- **AC3** (stable) → run `pnpm test` three times, quote each summary in this file's implementation log and in
  HANDOVER.
- **AC4** (pre-deploy gate) → run `bash scripts/claude/predeploy-check.sh`, quote output. New assertions inside
  `vitest.config.test.ts`'s sibling `scripts/claude/predeploy-check.test.ts`: source-scan the script for the
  absence of `git`, `curl`, `wget`, and any `echo $` / variable-printing pattern.
- **AC5** (docs) → `README.md`: one short "Before you push" paragraph naming
  `bash scripts/claude/predeploy-check.sh`, placed near "Deployment". `process.md` untouched (verified by
  reading it, not editing).

## Files
- changed: `vitest.config.ts`
- new: `vitest.config.test.ts`, `scripts/claude/predeploy-check.test.ts`
- changed: `README.md`

No schema/migration/dependency change. No decision needed (DEC-019 §4-§5 already Decided).
