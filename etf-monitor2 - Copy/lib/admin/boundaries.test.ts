import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractModuleSpecifiers } from "../../test/helpers/module-specifiers";

const ADMIN_DIR = path.join(__dirname);

function nonTestFiles(): string[] {
  return readdirSync(ADMIN_DIR, { recursive: true })
    .filter((f): f is string => typeof f === "string")
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .sort();
}

describe("lib/admin stays read-only and out of Next.js/React (BA-1)", () => {
  const files = nonTestFiles();

  it("found at least 2 non-test .ts files (not a vacuous pass)", () => {
    expect(files.length).toBeGreaterThanOrEqual(2);
  });

  for (const file of files) {
    it(`${file}: no Next.js/React/app/components import, no writes`, () => {
      const filePath = path.join(ADMIN_DIR, file);
      const source = readFileSync(filePath, "utf8");
      const specifiers = extractModuleSpecifiers(source);

      for (const specifier of specifiers) {
        expect(specifier === "next" || specifier.startsWith("next/"), `"${specifier}" imports next`).toBe(false);
        expect(specifier === "react" || specifier.startsWith("react/"), `"${specifier}" imports react`).toBe(false);
        expect(
          specifier.includes("/app/") || specifier.includes("/components/") || specifier.startsWith("@/app") || specifier.startsWith("@/components"),
          `"${specifier}" reaches app/components`,
        ).toBe(false);
      }

      const lowered = source.toLowerCase();
      expect(lowered).not.toContain("insert into");
      expect(lowered).not.toContain('update "');
      expect(lowered).not.toContain("delete from");
      expect(source).not.toContain("process.env");
    });
  }
});
