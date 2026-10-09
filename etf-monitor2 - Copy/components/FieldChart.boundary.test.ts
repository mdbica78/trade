import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const FORBIDDEN = ["@/lib/db", "lib/db/", "drizzle-orm", "@neondatabase/serverless", "lib/ingestion", "next-intl/server"];

function read(relPath: string): string {
  return readFileSync(path.resolve(__dirname, "..", relPath), "utf8");
}

describe("FieldChart client boundary (US-019 AC7)", () => {
  it("starts with the client directive", () => {
    const source = read("components/FieldChart.tsx");
    expect(source.trimStart().startsWith('"use client";')).toBe(true);
  });

  it("never imports a database module, directly or via its value-imported modules", () => {
    const modules = ["components/FieldChart.tsx", "lib/format/chart.ts", "lib/format/number.ts", "lib/format/date.ts"];
    for (const modulePath of modules) {
      const source = read(modulePath);
      for (const forbidden of FORBIDDEN) {
        expect(source, `${modulePath} must not reference ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it("only imports lib/monitoring/history and lib/monitoring/chart-series as types", () => {
    const source = read("components/FieldChart.tsx");
    const nonTypeImport = /^import\s+(?!type\s)[^;]*from\s+["'][^"']*lib\/monitoring\/(history|chart-series)["']/m;
    expect(source).not.toMatch(nonTypeImport);
  });
});
