import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractModuleSpecifiers } from "../test/helpers/module-specifiers";

const APP_DIR = path.join(__dirname);

const ALLOWED_LIB_PREFIXES = ["lib/config/", "lib/db", "lib/ai/settings-deps", "lib/ai/chat"];

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

function findActionFiles(): string[] {
  return readdirSync(APP_DIR, { recursive: true })
    .filter((f): f is string => typeof f === "string")
    .map(toPosix)
    .filter((f) => f.endsWith("actions.ts"))
    .sort();
}

function resolveSpecifier(fromFile: string, specifier: string): string | null {
  if (specifier.startsWith("@/")) {
    return specifier.slice(2);
  }
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
    return null;
  }
  const fromDir = path.posix.dirname(fromFile);
  return path.posix.normalize(path.posix.join(fromDir, specifier));
}

/** Fails on an SQL-shaped import or literal, or a `lib/` import outside the allowlist. */
export function checkActionFile(relFile: string, source: string): string[] {
  const violations: string[] = [];
  const specifiers = extractModuleSpecifiers(source);

  for (const specifier of specifiers) {
    if (specifier === "drizzle-orm" || specifier.startsWith("drizzle-orm/")) {
      violations.push(`drizzle-orm import: ${specifier}`);
    }
    const resolved = resolveSpecifier(relFile, specifier);
    if (resolved !== null && resolved.startsWith("lib/")) {
      const allowed = ALLOWED_LIB_PREFIXES.some((prefix) => resolved === prefix || resolved.startsWith(prefix));
      if (!allowed) violations.push(`disallowed lib import: ${specifier}`);
    }
  }

  if (/sql`/.test(source)) violations.push("sql` template");
  if (/insert into/i.test(source)) violations.push("insert into text");
  if (/update "/i.test(source)) violations.push('update " text');
  if (/delete from/i.test(source)) violations.push("delete from text");

  return violations;
}

describe("app/**/actions.ts contains no SQL and imports lib/ only through the allowlist (US-028 AC9)", () => {
  const files = findActionFiles();

  it("AB-0: finds at least 5 action files, including the ones this story expects (not a vacuous pass)", () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
    for (const expected of [
      "admin/etfs/actions.ts",
      "admin/etfs/[symbol]/fields/actions.ts",
      "admin/ai/actions.ts",
      "admin/cron/actions.ts",
      "chat/actions.ts",
    ]) {
      expect(files).toContain(expected);
    }
  });

  for (const file of files) {
    it(`AB-1..3: ${file} has no SQL and no disallowed lib/ import`, () => {
      const source = readFileSync(path.join(APP_DIR, file), "utf8");
      const violations = checkActionFile(`app/${file}`, source);
      expect(violations, `${file}: ${violations.join(", ")}`).toEqual([]);
    });
  }

  it("AB-4: the checker itself flags each forbidden pattern and passes a clean file", () => {
    const cases: [string, string][] = [
      ["drizzle-orm import", 'import { sql } from "drizzle-orm";'],
      ["sql` template", "const q = sql`select 1`;"],
      ["insert into text", 'const s = "INSERT INTO etfs";'],
      ["update \" text", "const s = 'update \"etfs\" set';"],
      ["delete from text", 'const s = "Delete From x";'],
      ["disallowed import (provider-deps)", 'import { createProviderDeps } from "@/lib/ai/provider-deps";'],
      ["disallowed import (relative ingestion)", 'import { neonBatchRunner } from "../../lib/ingestion/store";'],
      ["disallowed import (capabilities/execute)", 'import { executeConfigurationIntent } from "@/lib/ai/capabilities/configuration/execute";'],
    ];
    for (const [label, source] of cases) {
      const violations = checkActionFile("app/fake/actions.ts", source);
      expect(violations.length, `${label} was not flagged`).toBeGreaterThanOrEqual(1);
    }

    const relativeViolations = checkActionFile(
      "app/chat/actions.ts",
      'import { createProviderDeps } from "../../lib/ai/provider-deps";',
    );
    expect(relativeViolations, "a relative lib/ import from a real action path was not flagged").not.toEqual([]);

    const clean = [
      'import { getDb } from "@/lib/db";',
      'import { addEtf } from "@/lib/config/etfs";',
      'import { handleChatMessage } from "@/lib/ai/chat";',
    ].join("\n");
    expect(checkActionFile("app/fake/actions.ts", clean)).toEqual([]);
  });
});
