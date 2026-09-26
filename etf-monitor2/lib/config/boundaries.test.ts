import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractModuleSpecifiers } from "../../test/helpers/module-specifiers";

const CONFIG_DIR = path.join(__dirname);

describe("lib/config modules stay out of Next.js/UI/AI, no process.env (AC8)", () => {
  const files = readdirSync(CONFIG_DIR, { recursive: true })
    .filter((f): f is string => typeof f === "string")
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .sort();

  it("found at least 3 non-test .ts files (not a vacuous pass)", () => {
    expect(files.length).toBeGreaterThanOrEqual(3);
  });

  for (const file of files) {
    it(`${file}: no Next.js/React/app/components import, no AI import, no process.env`, () => {
      const filePath = path.join(CONFIG_DIR, file);
      const source = readFileSync(filePath, "utf8");
      const specifiers = extractModuleSpecifiers(source);

      for (const specifier of specifiers) {
        expect(specifier === "next" || specifier.startsWith("next/"), `"${specifier}" imports next`).toBe(false);
        expect(specifier === "react" || specifier.startsWith("react/"), `"${specifier}" imports react`).toBe(false);
        expect(
          specifier.startsWith("@/app") || specifier.startsWith("@/components"),
          `"${specifier}" reaches app/components`,
        ).toBe(false);
        expect(
          specifier.startsWith("../../app") ||
            specifier.startsWith("../../components") ||
            specifier.startsWith("../app") ||
            specifier.startsWith("../components"),
          `"${specifier}" reaches app/components`,
        ).toBe(false);
        expect(/\b(ai|openai|anthropic|@ai-sdk|llm)\b/i.test(specifier), `"${specifier}" looks AI-related`).toBe(
          false,
        );
        expect(specifier.includes("/ai/"), `"${specifier}" has an /ai/ path segment`).toBe(false);
      }

      expect(/\bprocess\.env\b/.test(source)).toBe(false);
    });
  }

  it("BC-2: etfs.ts and detect-adapter.ts stay away from concrete I/O", () => {
    for (const file of ["etfs.ts", "detect-adapter.ts"]) {
      const source = readFileSync(path.join(CONFIG_DIR, file), "utf8");
      const specifiers = extractModuleSpecifiers(source);
      expect(specifiers).not.toContain("unpdf");
      expect(specifiers).not.toContain("@neondatabase/serverless");
      expect(specifiers.some((s) => s.endsWith("/default-deps") || s === "./default-deps")).toBe(false);
    }

    const etfsSource = readFileSync(path.join(CONFIG_DIR, "etfs.ts"), "utf8");
    const etfsSpecifiers = extractModuleSpecifiers(etfsSource);
    expect(etfsSpecifiers.some((s) => s.includes("extraction/discovery") || s.includes("extraction/pdf"))).toBe(
      false,
    );
  });

  it("BC-3: detect-adapter.ts takes no store and writes nothing", () => {
    const source = readFileSync(path.join(CONFIG_DIR, "detect-adapter.ts"), "utf8");
    expect(source).not.toContain("ReportStore");
    expect(source).not.toMatch(/insert into/i);
    expect(source).not.toMatch(/update "/i);
    expect(source).not.toContain('"reports"');
  });

  it("BC-2b: detect-adapter.ts imports extraction/discovery and extraction/pdf only as `import type`", () => {
    const source = readFileSync(path.join(CONFIG_DIR, "detect-adapter.ts"), "utf8");
    const valueImportRe = /^import\s+(?!type\s)[\s\S]*?from\s+["']([^"']+)["']/gm;
    let match: RegExpExecArray | null;
    const valueSpecifiers: string[] = [];
    while ((match = valueImportRe.exec(source)) !== null) {
      valueSpecifiers.push(match[1]);
    }
    expect(valueSpecifiers.some((s) => s.includes("extraction/discovery") || s.includes("extraction/pdf"))).toBe(
      false,
    );
  });

  it("BC-5: tracked-fields.ts stays away from concrete I/O", () => {
    const source = readFileSync(path.join(CONFIG_DIR, "tracked-fields.ts"), "utf8");
    const specifiers = extractModuleSpecifiers(source);
    expect(specifiers).not.toContain("unpdf");
    expect(specifiers).not.toContain("@neondatabase/serverless");
    expect(specifiers.some((s) => s.endsWith("/default-deps") || s === "./default-deps")).toBe(false);
    expect(specifiers.some((s) => s.includes("extraction/discovery") || s.includes("extraction/pdf"))).toBe(false);
  });

  it("BC-4: default-deps.ts is the only lib/config file wiring the extraction adapter registry as a value import", () => {
    for (const file of files) {
      if (file === "default-deps.ts") continue;
      const source = readFileSync(path.join(CONFIG_DIR, file), "utf8");
      const valueImportRe = /^import\s+(?!type\s)[\s\S]*?from\s+["']([^"']+)["']/gm;
      let match: RegExpExecArray | null;
      const valueSpecifiers: string[] = [];
      while ((match = valueImportRe.exec(source)) !== null) {
        valueSpecifiers.push(match[1]);
      }
      expect(valueSpecifiers.some((s) => s.includes("extraction/adapters/default-registry"))).toBe(false);
    }
  });
});
