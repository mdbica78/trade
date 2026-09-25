import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "../package.json"), "utf8"));
const workspaceYaml = readFileSync(path.resolve(__dirname, "../pnpm-workspace.yaml"), "utf8");

describe("package-config (US-019 AC6)", () => {
  it("pins recharts to an exact version", () => {
    expect(pkg.dependencies.recharts).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("pins react-is to the same version as react, if present", () => {
    if (pkg.dependencies["react-is"] !== undefined) {
      expect(pkg.dependencies["react-is"]).toBe(pkg.dependencies.react);
    }
  });

  it("leaves no unresolved build-approval entry in pnpm-workspace.yaml", () => {
    const allowBuildsBlock = workspaceYaml.split(/\nminimumReleaseAgeExclude:/)[0];
    const entryLines = allowBuildsBlock
      .split("\n")
      .slice(1)
      .filter((line) => line.trim().length > 0);
    expect(entryLines.length).toBeGreaterThan(0);
    for (const line of entryLines) {
      expect(line).toMatch(/:\s*(true|false)\s*$/);
    }
  });
});
