import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractModuleSpecifiers } from "../../../test/helpers/module-specifiers";

const CAPABILITIES_DIR = path.join(__dirname);
const AI_DIR = path.join(__dirname, "..");

const ALLOWED_TARGETS = new Set([
  "lib/ai/providers/types",
  "lib/ai/providers/run-generation",
  "lib/ai/capabilities/types",
  "lib/ai/capabilities/generate",
  "lib/ai/capabilities/registry",
  "lib/ai/capabilities/action-list",
  "lib/ai/capabilities/configuration/context",
  "lib/ai/capabilities/configuration/intent",
  "lib/ai/capabilities/configuration/grounding",
  "lib/ai/capabilities/configuration/prompt",
  "lib/ai/capabilities/configuration/interpret",
  "lib/ai/capabilities/configuration/capability",
  "lib/ai/capabilities/configuration/execute",
  "lib/ai/capabilities/widgets/capability",
  "lib/ai/capabilities/widgets/context",
  "lib/ai/capabilities/widgets/intent",
  "lib/ai/capabilities/widgets/execute",
  "lib/config/etfs",
  "lib/config/tracked-fields",
  "lib/config/widgets",
]);

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

function nonTestFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true })
    .filter((f): f is string => typeof f === "string")
    .map(toPosix)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
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

function checkSpecifiers(relFile: string, source: string): string[] {
  const violations: string[] = [];
  for (const specifier of extractModuleSpecifiers(source)) {
    const resolved = resolveSpecifier(relFile, specifier);
    if (resolved === null || !ALLOWED_TARGETS.has(resolved)) {
      violations.push(specifier);
    }
  }
  return violations;
}

const CAPABILITY_WRITE_FUNCTION_NAMES = [
  "addEtf",
  "setEtfActive",
  "setEtfAdapter",
  "detectEtfAdapter",
  "trackField",
  "untrackField",
  "moveField",
  "addWidget",
  "updateWidget",
  "clearWidget",
  "replaceWidgets",
  "setAiSettings",
  "setCronHour",
];

describe("lib/ai/capabilities import and safety rules (AC1, AC2, AC8)", () => {
  const files = nonTestFiles(CAPABILITIES_DIR);

  it("CB-0: shared, configuration and widget capability files exist (not a vacuous pass)", () => {
    for (const expected of [
      "types.ts",
      "generate.ts",
      "registry.ts",
      "action-list.ts",
      "configuration/context.ts",
      "configuration/intent.ts",
      "configuration/grounding.ts",
      "configuration/prompt.ts",
      "configuration/interpret.ts",
      "configuration/capability.ts",
      "configuration/execute.ts",
      "widgets/capability.ts",
      "widgets/context.ts",
      "widgets/intent.ts",
      "widgets/execute.ts",
    ]) {
      expect(files).toContain(expected);
    }
  });

  for (const file of files) {
    const relFile = `lib/ai/capabilities/${file}`;
    it(`CB-1: ${file} imports only allowed targets`, () => {
      const source = readFileSync(path.join(CAPABILITIES_DIR, file), "utf8");
      const violations = checkSpecifiers(relFile, source);
      expect(violations, `${file} imports unexpected specifier(s): ${violations.join(", ")}`).toEqual([]);
    });
  }

  it("CB-1b: the checker itself flags a concrete adapter, the wiring module, key-status, default-registry, config/default-deps and lib/db", () => {
    const badSpecifiers = [
      "../providers/gemini",
      "../../providers/groq",
      "@/lib/ai/provider-deps",
      "../key-status",
      "../../providers/default-registry",
      "@/lib/config/default-deps",
      "@/lib/db/index",
    ];
    for (const specifier of badSpecifiers) {
      const source = `import x from "${specifier}";`;
      const violations = checkSpecifiers("lib/ai/capabilities/configuration/fake.ts", source);
      expect(violations, `${specifier} was not flagged`).toEqual([specifier]);
    }
  });

  it("CB-2: no non-test file under lib/ai/providers/ imports lib/ai/capabilities", () => {
    const providerFiles = readdirSync(path.join(AI_DIR, "providers"), { recursive: true })
      .filter((f): f is string => typeof f === "string")
      .map(toPosix)
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    for (const file of providerFiles) {
      const relFile = `lib/ai/providers/${file}`;
      const source = readFileSync(path.join(AI_DIR, "providers", file), "utf8");
      for (const specifier of extractModuleSpecifiers(source)) {
        const resolved = resolveSpecifier(relFile, specifier);
        expect(resolved?.startsWith("lib/ai/capabilities") ?? false, `${relFile} imports ${specifier}`).toBe(false);
      }
    }
  });

  it("CB-3: only key-store.ts uses raw SQL or drizzle-orm under lib/ai/", () => {
    const aiFiles = readdirSync(AI_DIR, { recursive: true })
      .filter((f): f is string => typeof f === "string")
      .map(toPosix)
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    for (const file of aiFiles) {
      const source = readFileSync(path.join(AI_DIR, file), "utf8");
      if (file === "key-store.ts") {
        expect(source.includes("sql`"), "key-store.ts uses Drizzle SQL").toBe(true);
        expect(
          extractModuleSpecifiers(source).some((specifier) => specifier === "drizzle-orm"),
          "key-store.ts imports drizzle-orm",
        ).toBe(true);
        continue;
      }
      expect(source.includes("sql`"), `lib/ai/${file} contains sql\``).toBe(false);
      expect(source.includes("db.execute"), `lib/ai/${file} contains db.execute`).toBe(false);
      expect(extractModuleSpecifiers(source).some((s) => s === "drizzle-orm" || s.startsWith("drizzle-orm/")), `lib/ai/${file} imports drizzle-orm`).toBe(false);
    }
  });

  it("CB-4: no non-execution capability file mentions a lib/config write function name", () => {
    for (const file of files) {
      if (file === "configuration/execute.ts" || file === "widgets/execute.ts") continue;
      const source = readFileSync(path.join(CAPABILITIES_DIR, file), "utf8");
      for (const name of CAPABILITY_WRITE_FUNCTION_NAMES) {
        expect(source.includes(name), `${file} mentions ${name}`).toBe(false);
      }
    }
  });

  it("CB-4-execute: each capability executor calls only its own config write functions", () => {
    const source = readFileSync(path.join(CAPABILITIES_DIR, "configuration/execute.ts"), "utf8");
    for (const name of ["addEtf", "setEtfActive", "trackField", "untrackField"]) {
      expect(source.includes(name), `execute.ts does not mention ${name}`).toBe(true);
    }
    for (const name of ["setEtfAdapter", "detectEtfAdapter", "moveField", "setAiSettings", "setCronHour"]) {
      expect(source.includes(name), `execute.ts mentions ${name}`).toBe(false);
    }
    const widgetsSource = readFileSync(path.join(CAPABILITIES_DIR, "widgets/execute.ts"), "utf8");
    for (const name of ["addWidget", "updateWidget", "clearWidget", "replaceWidgets"]) {
      expect(widgetsSource.includes(name), `widgets/execute.ts does not mention ${name}`).toBe(true);
    }
    for (const name of ["addEtf", "setEtfActive", "trackField", "untrackField"]) {
      expect(widgetsSource.includes(name), `widgets/execute.ts mentions ${name}`).toBe(false);
    }
  });
});
