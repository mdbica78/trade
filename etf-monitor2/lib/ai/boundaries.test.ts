import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractModuleSpecifiers } from "../../test/helpers/module-specifiers";

const AI_DIR = path.join(__dirname);
const REPO_ROOT = path.join(__dirname, "..", "..");

const SDK_DENYLIST_RE =
  /^(openai|groq-sdk|ai|@ai-sdk\/|@google\/|@google-ai\/|@mistralai\/|@anthropic-ai\/|@openrouter\/|langchain|@langchain\/|ollama|cohere-ai|@huggingface\/)/;

const NETWORK_PRIMITIVES = ["XMLHttpRequest", "WebSocket", "EventSource", "sendBeacon", "node:http", "node:https", "node:net", "undici"];

const ALLOWED_TARGETS = new Set([
  "lib/ai/provider-catalog",
  "lib/db/index",
  "lib/ingestion/store",
  "lib/config/ai-settings",
  "lib/ai/key-status",
  "lib/ai/settings-deps",
  "lib/ai/providers/types",
  "lib/ai/providers/run-generation",
  "lib/ai/providers/registry",
  "lib/ai/providers/default-registry",
  "lib/ai/providers/resolve",
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

function collectFiles(dir: string, extensions: readonly string[]): string[] {
  return readdirSync(dir, { recursive: true })
    .filter((f): f is string => typeof f === "string")
    .map(toPosix)
    .filter((f) => extensions.some((ext) => f.endsWith(ext)) && !f.endsWith(".test.ts") && !f.endsWith(".test.tsx"))
    .sort();
}

/** Resolves a specifier from `fromFile` (repo-relative, e.g. `lib/ai/providers/resolve.ts`) to a repo-relative target without extension. */
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

describe("lib/ai stays free of network code and SDKs (AC5, AC6)", () => {
  const files = nonTestFiles(AI_DIR);
  const relFiles = files.map((f) => `lib/ai/${f}`);

  it("LB-0: at least 9 non-test files including the provider modules (not a vacuous pass)", () => {
    expect(files.length).toBeGreaterThanOrEqual(9);
    for (const expected of [
      "providers/types.ts",
      "providers/run-generation.ts",
      "providers/registry.ts",
      "providers/resolve.ts",
      "provider-deps.ts",
    ]) {
      expect(files).toContain(expected);
    }
  });

  it("LB-1: provider-catalog.ts has zero imports, no process.env, no fetch", () => {
    const source = readFileSync(path.join(AI_DIR, "provider-catalog.ts"), "utf8");
    expect(extractModuleSpecifiers(source)).toEqual([]);
    expect(source).not.toContain("process.env");
    expect(source).not.toContain("fetch(");
  });

  for (const file of files) {
    const relFile = `lib/ai/${file}`;
    const isProviderDeps = file === "provider-deps.ts";
    const isUnderProviders = file.startsWith("providers/");

    it(`LB-2: ${file} imports only allowed targets, no SDK, no re-export, no other network primitive`, () => {
      const source = readFileSync(path.join(AI_DIR, file), "utf8");
      const specifiers = extractModuleSpecifiers(source);

      for (const specifier of specifiers) {
        expect(SDK_DENYLIST_RE.test(specifier), `"${specifier}" in ${file} matches the SDK denylist`).toBe(false);
        const resolved = resolveSpecifier(relFile, specifier);
        expect(resolved !== null, `"${specifier}" in ${file} is not a relative/@ specifier`).toBe(true);
        expect(ALLOWED_TARGETS.has(resolved!), `"${specifier}" in ${file} resolves to "${resolved}", not on the allowlist`).toBe(true);
      }

      expect(/export\s+(\*|\{[^}]*\})\s*from\s+["']/.test(source), `${file} re-exports from another module`).toBe(false);

      for (const primitive of NETWORK_PRIMITIVES) {
        expect(source.includes(primitive), `${file} references ${primitive}`).toBe(false);
      }
    });

    it(`LB-2-fetch: ${file} follows the fetch-token rules for its role`, () => {
      const source = readFileSync(path.join(AI_DIR, file), "utf8");
      const bareCallRe = /(^|[^.\w$])fetch\s*\(/m;
      const globalRefRe = /\b(globalThis|window|self|global)\.fetch\b/;

      if (!isProviderDeps) {
        expect(bareCallRe.test(source), `${file} has a bare fetch( call`).toBe(false);
        expect(globalRefRe.test(source), `${file} references a global fetch`).toBe(false);
      }

      if (!isUnderProviders && !isProviderDeps) {
        expect(/\bfetch\b/.test(source), `${file} mentions fetch at all`).toBe(false);
      }

      if (isUnderProviders) {
        const calls = source.match(/[\w$.]*fetch\s*\(/g) ?? [];
        for (const call of calls) {
          expect(call.trim(), `${file} calls fetch other than through ctx.fetch(`).toBe("ctx.fetch(");
        }
      }
    });
  }

  it("LB-2-positive: provider-deps.ts contains the one bare global fetch( reference", () => {
    const source = readFileSync(path.join(AI_DIR, "provider-deps.ts"), "utf8");
    expect(/(^|[^.\w$])fetch\s*\(/m.test(source)).toBe(true);
  });

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

  it("LB-4: importers of key-status are exactly app/admin/ai/page.tsx and lib/ai/provider-deps.ts; no client component; readApiKey never referenced outside lib/ai", () => {
    const candidateDirs = [
      { dir: path.join(REPO_ROOT, "app"), rel: "app" },
      { dir: path.join(REPO_ROOT, "components"), rel: "components" },
      { dir: AI_DIR, rel: "lib/ai" },
    ];
    const importers: string[] = [];
    for (const { dir, rel } of candidateDirs) {
      for (const file of collectFiles(dir, [".ts", ".tsx"])) {
        const filePath = path.join(dir, file);
        const relFile = `${rel}/${file}`;
        const source = readFileSync(filePath, "utf8");
        const specifiers = extractModuleSpecifiers(source);
        const importsKeyStatus = specifiers.some((s) => {
          const resolved = resolveSpecifier(relFile, s);
          return (resolved !== null && resolved === "lib/ai/key-status") || s.endsWith("ai/key-status") || s.endsWith("/key-status");
        });
        if (importsKeyStatus) {
          importers.push(relFile);
        }
        if (source.startsWith('"use client"') || source.startsWith("'use client'")) {
          expect(importsKeyStatus, `${relFile} is a client component and must not import key-status`).toBe(false);
        }
        if (rel !== "lib/ai") {
          expect(source.includes("readApiKey"), `${relFile} references readApiKey`).toBe(false);
        }
      }
    }
    expect(importers.sort()).toEqual(["app/admin/ai/page.tsx", "lib/ai/provider-deps.ts"]);
  });

  it("LB-5: app/ and components/ never mention the key-carrying resolution names, or import providers/resolve", () => {
    const FORBIDDEN_NAMES = [
      "loadActiveProvider",
      "resolveActiveProvider",
      "ActiveProviderCall",
      "ActiveProviderResolution",
      "ProviderCallInput",
      "ProviderCallContext",
    ];
    for (const dir of [path.join(REPO_ROOT, "app"), path.join(REPO_ROOT, "components")]) {
      const relRoot = path.relative(REPO_ROOT, dir);
      for (const file of collectFiles(dir, [".ts", ".tsx"])) {
        const filePath = path.join(dir, file);
        const relFile = toPosix(path.join(relRoot, file));
        const source = readFileSync(filePath, "utf8");
        for (const name of FORBIDDEN_NAMES) {
          expect(source.includes(name), `${relFile} mentions ${name}`).toBe(false);
        }
        const specifiers = extractModuleSpecifiers(source);
        for (const specifier of specifiers) {
          const resolved = resolveSpecifier(relFile, specifier);
          expect(
            resolved !== "lib/ai/providers/resolve",
            `${relFile} imports lib/ai/providers/resolve directly`,
          ).toBe(true);
        }
      }
    }
  });

  it("LB-6: lib/ai/providers/* imports neither key-status nor provider-deps nor lib/db", () => {
    for (const relFile of relFiles.filter((f) => f.startsWith("lib/ai/providers/"))) {
      const file = relFile.replace("lib/ai/", "");
      const source = readFileSync(path.join(AI_DIR, file), "utf8");
      const specifiers = extractModuleSpecifiers(source);
      for (const specifier of specifiers) {
        const resolved = resolveSpecifier(relFile, specifier);
        expect(resolved === "lib/ai/key-status", `${relFile} imports key-status`).toBe(false);
        expect(resolved === "lib/ai/provider-deps", `${relFile} imports provider-deps`).toBe(false);
        expect(resolved === "lib/db/index", `${relFile} imports lib/db directly`).toBe(false);
      }
    }
  });

  it("LB-7: package.json has no dependency matching the SDK denylist", () => {
    const pkg = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const names = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
    for (const name of names) {
      expect(SDK_DENYLIST_RE.test(name), `package.json dependency "${name}" matches the SDK denylist`).toBe(false);
    }
  });
});
