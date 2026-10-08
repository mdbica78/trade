import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractModuleSpecifiers } from "../../test/helpers/module-specifiers";

const REPO_ROOT = path.join(__dirname, "..", "..");

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

function collectFiles(dir: string, extensions: readonly string[]): string[] {
  return readdirSync(dir, { recursive: true })
    .filter((f): f is string => typeof f === "string")
    .map(toPosix)
    .filter((f) => extensions.some((ext) => f.endsWith(ext)) && !f.endsWith(".test.ts") && !f.endsWith(".test.tsx"))
    .sort();
}

describe("custom-providers boundary (CPB)", () => {
  it("CPB-1: only lib/config/custom-providers.ts and lib/db/schema.ts mention ai_custom_providers", () => {
    const candidateDirs = [
      { dir: path.join(REPO_ROOT, "app"), rel: "app" },
      { dir: path.join(REPO_ROOT, "components"), rel: "components" },
      { dir: path.join(REPO_ROOT, "lib"), rel: "lib" },
    ];
    const references: string[] = [];
    for (const { dir, rel } of candidateDirs) {
      for (const file of collectFiles(dir, [".ts", ".tsx"])) {
        const source = readFileSync(path.join(dir, file), "utf8");
        if (/ai_custom_providers/.test(source)) references.push(`${rel}/${file}`);
      }
    }
    expect(references.sort()).toEqual(["lib/config/custom-providers.ts", "lib/db/schema.ts"]);
  });

  it("CPB-2: custom-providers.ts imports no lib/ai module and no next/react", () => {
    const source = readFileSync(path.join(REPO_ROOT, "lib/config/custom-providers.ts"), "utf8");
    const specifiers = extractModuleSpecifiers(source);
    for (const specifier of specifiers) {
      expect(specifier.includes("/ai/")).toBe(false);
      expect(specifier.startsWith("next")).toBe(false);
      expect(specifier.startsWith("react")).toBe(false);
    }
  });
});
