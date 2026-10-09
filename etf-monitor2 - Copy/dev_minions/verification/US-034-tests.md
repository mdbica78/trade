# US-034 tests — Test stability under load and the pre-deploy gate

Verdict: PASS

## Summary
All five acceptance criteria are met with comprehensive test coverage. The test suite is stable across three consecutive runs, the timeout configuration is properly named and wired, and the pre-deploy gate script is safe and complete.

## Test runs
Three runs of `pnpm test` for AC3 stability:
- **Run 1**: 164 test files, 1749 tests passed (146.42s)
- **Run 2**: 164 test files, 1749 tests passed (149.37s)
- **Run 3**: 164 test files, 1749 tests passed (174.37s)

All three runs passed with identical counts — **stable**.

## Gate results
Exported `NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt` for all commands.

- `pnpm install --frozen-lockfile`: exit code 0
- `pnpm typecheck`: exit code 0
- `pnpm lint`: exit code 0 (0 errors, 9 pre-existing warnings)
- `pnpm build`: exit code 0
- `pnpm test`: exit code 0 (1749/1749 tests)
- `bash scripts/claude/predeploy-check.sh`: exit code 0 (ran all four steps, reported "PREDEPLOY: PASS")

## Acceptance criteria mapping

**AC1: Named 30s limits** — MET
- `vitest.config.ts` defines `const TEST_TIMEOUT_MS = 30_000;` and `const HOOK_TIMEOUT_MS = 30_000;`
- Both constants are wired into the config: `testTimeout: TEST_TIMEOUT_MS`, `hookTimeout: HOOK_TIMEOUT_MS`
- Tests: `vitest.config.test.ts:10` (VC-1: constants are at least 30 seconds) ✓
- Tests: `vitest.config.test.ts:22` (VC-2: constants are wired into config) ✓

**AC2: No test weakened** — MET
- Grep across all 164 test files found zero occurrences of `it.skip`, `it.todo`, or `.retry(` patterns
- No tests were disabled or marked for retry this story

**AC3: Stable under load** — MET
- Three consecutive full test suite runs completed with identical results
- 1749 tests passed on each run (no flakiness detected)
- Pre-deploy check script completed successfully on the third run (final validation)

**AC4: Pre-deploy gate safe** — MET
- `scripts/claude/predeploy-check.test.ts:10` (PDC-1: runs typecheck, lint, build, test) ✓
- `scripts/claude/predeploy-check.test.ts:16` (PDC-2: never runs git, curl, or wget) ✓
- `scripts/claude/predeploy-check.test.ts:22` (PDC-3: never prints variable values) ✓
- `scripts/claude/predeploy-check.test.ts:27` (PDC-4: unsets four secret env vars before each step) ✓
- All four PDC tests passed
- Script output confirmed "PREDEPLOY: PASS" after running all four gates

**AC5: Documentation** — MET
- `README.md` contains "Before you push" paragraph near the Deployment section
- Paragraph names `bash scripts/claude/predeploy-check.sh` as the pre-deploy check command
- Explains that it mirrors Vercel's build (typecheck, build, lint, test suite), offline, stopping at first failure

## Test citations
All test names found via grep in source:
- `vitest.config.test.ts:10` — VC-1
- `vitest.config.test.ts:22` — VC-2
- `scripts/claude/predeploy-check.test.ts:10` — PDC-1
- `scripts/claude/predeploy-check.test.ts:16` — PDC-2
- `scripts/claude/predeploy-check.test.ts:22` — PDC-3
- `scripts/claude/predeploy-check.test.ts:27` — PDC-4

No acceptance criterion is UNCOVERED.

## Denied or attempted commands
none
