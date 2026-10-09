import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("package.json build script (US-048 AC4)", () => {
  it("MDB-1: build runs migrate-on-deploy.ts before next build", () => {
    const pkg = JSON.parse(readFileSync(path.join(__dirname, "..", "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.build).toBe("tsx scripts/migrate-on-deploy.ts && next build --webpack");
  });
});
