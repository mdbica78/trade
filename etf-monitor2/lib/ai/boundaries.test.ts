import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractModuleSpecifiers } from "../../test/helpers/module-specifiers";

const AI_DIR = path.join(__dirname);
const REPO_ROOT = path.join(__dirname, "..", "..");

const ALLOWED_SPECIFIERS = new Set(["./provider-catalog", "../db/index", "../ingestion/store", "../config/ai-settings"]);

function nonTestFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true })
    .filter((f): f is string => typeof f === "string")
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .sort();
}

function collectFiles(dir: string, extensions: readonly string[]): string[] {
  return readdirSync(dir, { recursive: true })
    .filter((f): f is string => typeof f === "string")
    .filter((f) => extensions.some((ext) => f.endsWith(ext)) && !f.endsWith(".test.ts") && !f.endsWith(".test.tsx"))
    .sort();
}

describe("lib/ai stays free of network code and SDKs (AC5)", () => {
  const files = nonTestFiles(AI_DIR);

  it("found at least 3 non-test .ts files (not a vacuous pass)", () => {
    expect(files.length).toBeGreaterThanOrEqual(3);
  });

  it("LB-1: provider-catalog.ts has zero imports, no process.env, no fetch", () => {
    const source = readFileSync(path.join(AI_DIR, "provider-catalog.ts"), "utf8");
    expect(extractModuleSpecifiers(source)).toEqual([]);
    expect(source).not.toContain("process.env");
    expect(source).not.toContain("fetch(");
  });

  for (const file of files) {
    it(`LB-2: ${file} imports only the allowed specifiers, no SDK, no fetch`, () => {
      const source = readFileSync(path.join(AI_DIR, file), "utf8");
      const specifiers = extractModuleSpecifiers(source);
      for (const specifier of specifiers) {
        expect(ALLOWED_SPECIFIERS.has(specifier), `"${specifier}" in ${file} is not in the allowlist`).toBe(true);
      }
      expect(source).not.toContain("fetch(");
    });
  }

  it("LB-3: process.env appears in lib/ai only in key-status.ts", () => {
    for (const file of files) {
      const source = readFileSync(path.join(AI_DIR, file), "utf8");
      if (file === "key-status.ts") {
        expect(source).toContain("process.env");
      } else {
        expect(source).not.toContain("process.env");
      }
    }
  });

  it("LB-4: only app/admin/ai/page.tsx imports lib/ai/key-status, and no client component does", () => {
    const candidateDirs = [path.join(REPO_ROOT, "app"), path.join(REPO_ROOT, "components")];
    const importers: string[] = [];
    for (const dir of candidateDirs) {
      for (const file of collectFiles(dir, [".ts", ".tsx"])) {
        const filePath = path.join(dir, file);
        const source = readFileSync(filePath, "utf8");
        const specifiers = extractModuleSpecifiers(source);
        if (specifiers.some((s) => s.endsWith("ai/key-status") || s.endsWith("/key-status"))) {
          importers.push(path.relative(REPO_ROOT, filePath));
        }
        if (source.startsWith('"use client"') || source.startsWith("'use client'")) {
          expect(
            specifiers.some((s) => s.endsWith("ai/key-status") || s.endsWith("/key-status")),
            `${filePath} is a client component and must not import key-status`,
          ).toBe(false);
        }
      }
    }
    expect(importers).toEqual(["app/admin/ai/page.tsx"]);
  });
});
