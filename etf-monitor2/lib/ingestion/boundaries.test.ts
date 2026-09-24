import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const INGESTION_DIR = path.join(__dirname);

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
      import { x } from "next/server";
      import {
        a,
        b
      } from "../../app/foo";
      await import("node:fs");
      require("@ai-sdk/openai");
    `;
    const specifiers = extractModuleSpecifiers(sample);
    expect(specifiers).toEqual(
      expect.arrayContaining(["next/server", "../../app/foo", "node:fs", "@ai-sdk/openai"]),
    );
    expect(specifiers).toHaveLength(4);
  });
});

describe("ingestion modules stay out of Next.js/UI/AI (AC8)", () => {
  const files = readdirSync(INGESTION_DIR, { recursive: true })
    .filter((f): f is string => typeof f === "string")
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .sort();

  it("found at least 4 non-test .ts files (not a vacuous pass)", () => {
    expect(files.length).toBeGreaterThanOrEqual(4);
  });

  for (const file of files) {
    it(`${file}: no Next.js/UI import, no AI import, no process.env`, () => {
      const filePath = path.join(INGESTION_DIR, file);
      const source = readFileSync(filePath, "utf8");
      const specifiers = extractModuleSpecifiers(source);

      for (const specifier of specifiers) {
        expect(
          specifier === "next" || specifier.startsWith("next/"),
          `"${specifier}" imports next`,
        ).toBe(false);
        expect(specifier === "react" || specifier.startsWith("react/"), `"${specifier}" imports react`).toBe(
          false,
        );
        expect(specifier.startsWith("@/app") || specifier.startsWith("@/components"), `"${specifier}" reaches app/components`).toBe(
          false,
        );
        expect(
          specifier.startsWith("../../app") || specifier.startsWith("../../components"),
          `"${specifier}" reaches app/components`,
        ).toBe(false);
        expect(/\b(ai|openai|anthropic|@ai-sdk|llm)\b/i.test(specifier), `"${specifier}" looks AI-related`).toBe(
          false,
        );
        expect(specifier.includes("/ai/"), `"${specifier}" has an /ai/ path segment`).toBe(false);
      }

      expect(/\bprocess\.env\b/.test(source)).toBe(false);

      if (file === "ingest-etf.ts" || file === "select-values.ts") {
        for (const specifier of specifiers) {
          expect(specifier).not.toBe("unpdf");
          expect(specifier).not.toBe("@neondatabase/serverless");
          expect(specifier).not.toBe("../db/index");
          expect(specifier).not.toBe("../db");
        }
      }
    });
  }
});
