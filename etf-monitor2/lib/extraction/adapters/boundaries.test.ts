import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ADAPTERS_DIR = path.join(__dirname);

/** Extracts every static/side-effect import, multi-line import, dynamic import() and require() specifier. */
function extractModuleSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const importRe = /import\s+(?:type\s+)?(?:[\s\S]*?from\s+)?["']([^"']+)["']/g;
  const dynamicImportRe = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
  const requireRe = /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;
  for (const re of [importRe, dynamicImportRe, requireRe]) {
    let match: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((match = re.exec(source)) !== null) {
      specifiers.push(match[1]);
    }
  }
  return specifiers;
}

describe("specifier extractor positive control", () => {
  it("finds all four specifier forms in a sample", () => {
    const sample = `
      import { x } from "unpdf";
      import {
        a,
        b
      } from "../../db";
      await import("node:fs");
      require("drizzle-orm");
    `;
    const specifiers = extractModuleSpecifiers(sample);
    expect(specifiers).toEqual(expect.arrayContaining(["unpdf", "../../db", "node:fs", "drizzle-orm"]));
    expect(specifiers).toHaveLength(4);
  });
});

describe("adapter modules are text-only (AC6)", () => {
  const files = readdirSync(ADAPTERS_DIR, { recursive: true })
    .filter((f): f is string => typeof f === "string")
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .sort();

  it("found at least 4 non-test .ts files (not a vacuous pass)", () => {
    expect(files.length).toBeGreaterThanOrEqual(4);
  });

  for (const file of files) {
    it(`${file}: only relative imports inside lib/extraction/, no http/pdf/discovery, no fetch/process.env`, () => {
      const source = readFileSync(path.join(ADAPTERS_DIR, file), "utf8");
      const specifiers = extractModuleSpecifiers(source);

      for (const specifier of specifiers) {
        expect(specifier.startsWith("./") || specifier.startsWith("../"), `"${specifier}" is not relative`).toBe(
          true,
        );
        expect(specifier.startsWith("../../"), `"${specifier}" leaves lib/extraction/`).toBe(false);
        const normalized = specifier.replace(/\.ts$/, "");
        expect(["../http", "../pdf", "../discovery"].includes(normalized), `"${specifier}" reaches a forbidden module`).toBe(
          false,
        );
      }

      expect(/\bfetch\s*\(/.test(source)).toBe(false);
      expect(/\bprocess\.env\b/.test(source)).toBe(false);
    });
  }
});
