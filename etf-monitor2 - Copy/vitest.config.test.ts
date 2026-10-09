import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CONFIG_PATH = path.join(__dirname, "vitest.config.ts");

describe("vitest.config.ts test/hook timeouts (US-034 AC1, DEC-019 §5)", () => {
  const source = readFileSync(CONFIG_PATH, "utf8");

  it("VC-1: TEST_TIMEOUT_MS and HOOK_TIMEOUT_MS are named constants of at least 30 seconds", () => {
    const testMatch = /const TEST_TIMEOUT_MS = (\d+(?:_\d+)*);/.exec(source);
    const hookMatch = /const HOOK_TIMEOUT_MS = (\d+(?:_\d+)*);/.exec(source);
    expect(testMatch, "TEST_TIMEOUT_MS constant not found").not.toBeNull();
    expect(hookMatch, "HOOK_TIMEOUT_MS constant not found").not.toBeNull();

    const testValue = Number(testMatch![1].replace(/_/g, ""));
    const hookValue = Number(hookMatch![1].replace(/_/g, ""));
    expect(testValue).toBeGreaterThanOrEqual(30_000);
    expect(hookValue).toBeGreaterThanOrEqual(30_000);
  });

  it("VC-2: both constants are wired into the test config, not left unused", () => {
    expect(source).toContain("testTimeout: TEST_TIMEOUT_MS");
    expect(source).toContain("hookTimeout: HOOK_TIMEOUT_MS");
  });
});
