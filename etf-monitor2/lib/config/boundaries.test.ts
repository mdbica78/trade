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
        const approvedKeyStoreException = file === "ai-keys.ts" && specifier === "../ai/key-store";
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
        expect(approvedKeyStoreException || !/\b(ai|openai|anthropic|@ai-sdk|llm)\b/i.test(specifier), `"${specifier}" looks AI-related`).toBe(true);
        expect(approvedKeyStoreException || !specifier.includes("/ai/"), `"${specifier}" has an /ai/ path segment`).toBe(true);
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

  it("BC-6: ai-settings.ts stays away from concrete I/O and AI adapter code", () => {
    const source = readFileSync(path.join(CONFIG_DIR, "ai-settings.ts"), "utf8");
    const specifiers = extractModuleSpecifiers(source);
    expect(specifiers).not.toContain("unpdf");
    expect(specifiers).not.toContain("@neondatabase/serverless");
    expect(specifiers.some((s) => s.endsWith("/default-deps") || s === "./default-deps")).toBe(false);
    expect(specifiers.some((s) => s.includes("extraction/"))).toBe(false);
  });

  it("BC-9: home-display.ts owns home display SQL and stays away from concrete I/O/UI", () => {
    const source = readFileSync(path.join(CONFIG_DIR, "home-display.ts"), "utf8");
    const specifiers = extractModuleSpecifiers(source);
    expect(specifiers).not.toContain("@neondatabase/serverless");
    expect(specifiers).not.toContain("next/cache");
    expect(specifiers.some((specifier) => specifier.startsWith("@/components"))).toBe(false);
    expect(source).toContain('delete from "home_display_columns"');
    expect(source).toContain('delete from "home_display_etfs"');
    expect(source).toContain('delete from "home_display_settings"');
  });

  it("BC-10 (US-047 AC9): home display tables have one config writer and one monitoring reader", () => {
    const libRoot = path.join(CONFIG_DIR, "..");
    const files = readdirSync(libRoot, { recursive: true })
      .filter((entry): entry is string => typeof entry === "string")
      .filter((entry) => /\.(?:ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx"))
      .map((entry) => path.join(libRoot, entry));
    const references: { file: string; source: string }[] = files.map((file) => ({
      file: path.relative(libRoot, file).split(path.sep).join("/"),
      source: readFileSync(file, "utf8"),
    })).filter(({ source }) => /home_display_(?:settings|columns|etfs)/.test(source));
    const writes = references.filter(({ source }) =>
      /\b(?:insert\s+into|update|delete\s+from)\s+["']home_display_(?:settings|columns|etfs)["']/i.test(source),
    );
    const reads = references.filter(({ source }) =>
      source.split("`").some((sqlText) =>
        /\bselect\b[\s\S]*?\bfrom\s+["']home_display_(?:settings|columns|etfs)["']/i.test(sqlText),
      ),
    );
    expect(references.map(({ file }) => file).sort()).toEqual([
      "config/home-display.ts",
      "db/schema.ts",
      "monitoring/home.ts",
    ]);
    expect(writes.map(({ file }) => file)).toEqual(["config/home-display.ts"]);
    expect(reads.map(({ file }) => file)).toEqual(["monitoring/home.ts"]);
  });

  it("BC-7: cron.ts imports only the allowed specifiers (no fs, no network, no @vercel/*)", () => {
    const source = readFileSync(path.join(CONFIG_DIR, "cron.ts"), "utf8");
    const specifiers = extractModuleSpecifiers(source);
    const allowed = new Set(["drizzle-orm", "../db/index", "../ingestion/store", "../../vercel.json"]);
    for (const specifier of specifiers) {
      expect(allowed.has(specifier), `"${specifier}" is not in cron.ts's allowlist`).toBe(true);
    }
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("readFile");
    expect(source).not.toContain("writeFile");
    expect(source).not.toContain("process.env");
  });

  it("BC-8: app/api/cron/, lib/cron/ and lib/ingestion/ never reference cron_hour_utc or import config/cron", () => {
    const repoRoot = path.join(CONFIG_DIR, "..", "..");
    const dirs = [path.join(repoRoot, "app", "api", "cron"), path.join(repoRoot, "lib", "cron"), path.join(repoRoot, "lib", "ingestion")];
    let fileCount = 0;
    for (const dir of dirs) {
      const entries = readdirSync(dir, { recursive: true })
        .filter((f): f is string => typeof f === "string")
        .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
      for (const file of entries) {
        fileCount += 1;
        const filePath = path.join(dir, file);
        const source = readFileSync(filePath, "utf8");
        expect(source, `${filePath} references cron_hour_utc`).not.toContain("cron_hour_utc");
        expect(source, `${filePath} references cronHourUtc`).not.toContain("cronHourUtc");
        const specifiers = extractModuleSpecifiers(source);
        expect(specifiers.some((s) => s.endsWith("config/cron")), `${filePath} imports config/cron`).toBe(false);
      }
    }
    expect(fileCount).toBeGreaterThanOrEqual(5);
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
