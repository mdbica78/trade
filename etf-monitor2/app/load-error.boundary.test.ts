import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP_DIR = path.join(__dirname);
const REPO_ROOT = path.join(__dirname, "..");

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

function findPageFiles(): string[] {
  return readdirSync(APP_DIR, { recursive: true })
    .filter((f): f is string => typeof f === "string")
    .map(toPosix)
    .filter((f) => f.endsWith("page.tsx") && !f.endsWith(".test.tsx"))
    .sort();
}

function allAppSources(): string[] {
  return readdirSync(APP_DIR, { recursive: true })
    .filter((f): f is string => typeof f === "string")
    .map(toPosix)
    .filter((f) => (f.endsWith(".ts") || f.endsWith(".tsx")) && !f.includes(".test."))
    .sort();
}

function allLibSources(): string[] {
  const dir = path.join(REPO_ROOT, "lib");
  return readdirSync(dir, { recursive: true })
    .filter((f): f is string => typeof f === "string")
    .map(toPosix)
    .filter((f) => (f.endsWith(".ts") || f.endsWith(".tsx")) && !f.includes(".test."))
    .sort();
}

type CatchBlock = { bound: boolean; body: string };

/** Finds every `catch` clause in `source`, brace-balanced, without a real parser. */
function findCatchBlocks(source: string): CatchBlock[] {
  const blocks: CatchBlock[] = [];
  const re = /\bcatch\b\s*/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    let i = match.index + match[0].length;
    let bound = true;
    if (source[i] === "(") {
      let depth = 1;
      i++;
      while (i < source.length && depth > 0) {
        if (source[i] === "(") depth++;
        else if (source[i] === ")") depth--;
        i++;
      }
    } else {
      bound = false;
    }
    while (i < source.length && /\s/.test(source[i])) i++;
    if (source[i] !== "{") continue; // not a catch clause (e.g. a variable named "catch")
    const bodyStart = i + 1;
    let depth = 1;
    let j = bodyStart;
    while (j < source.length && depth > 0) {
      if (source[j] === "{") depth++;
      else if (source[j] === "}") depth--;
      j++;
    }
    blocks.push({ bound, body: source.slice(bodyStart, j - 1) });
  }
  return blocks;
}

const PAGE_SCOPES: Record<string, string> = {
  "page.tsx": "home",
  "etf/[symbol]/page.tsx": "etf-detail",
  "health/page.tsx": "health",
  "admin/etfs/page.tsx": "admin/etfs",
  "admin/etfs/[symbol]/fields/page.tsx": "admin/etf-fields",
  "admin/ai/page.tsx": "admin/ai",
  "admin/cron/page.tsx": "admin/cron",
  "admin/operations/page.tsx": "admin/operations",
};

describe("app/**/page.tsx load failures always go through the shared logger, never console (AC5)", () => {
  const pageFiles = findPageFiles();

  it("LB-E0: each expected page handles load failures directly or through loadOrError", () => {
    const handled = Object.entries(PAGE_SCOPES)
      .filter(([file, scope]) => {
        const source = readFileSync(path.join(APP_DIR, file), "utf8");
        return findCatchBlocks(source).length > 0 || source.includes(`loadOrError("${scope}"`);
      })
      .map(([file]) => file);
    expect(handled.sort()).toEqual(Object.keys(PAGE_SCOPES).sort());
  });

  it("LB-E1: every page uses its scoped wrapper or a bound catch that logs; no console. anywhere", () => {
    for (const [file, scope] of Object.entries(PAGE_SCOPES)) {
      const source = readFileSync(path.join(APP_DIR, file), "utf8");
      expect(source, `${file} contains console.`).not.toContain("console.");
      if (source.includes(`loadOrError("${scope}"`)) {
        expect(source, `${file}: wrapper import missing`).toContain("loadOrError");
        continue;
      }
      const blocks = findCatchBlocks(source);
      expect(blocks.length, `${file}: expected at least one catch`).toBeGreaterThanOrEqual(1);
      for (const block of blocks) {
        expect(block.bound, `${file}: an unbound catch {} was found`).toBe(true);
        expect(block.body, `${file}: catch body does not call logLoadError("${scope}", ...)`).toContain(
          `logLoadError("${scope}"`,
        );
      }
    }
  });

  it("LB-E2: every page.tsx that imports @/lib/db handles load errors through the shared logger", () => {
    for (const file of pageFiles) {
      const source = readFileSync(path.join(APP_DIR, file), "utf8");
      if (/from ["']@\/lib\/db["']/.test(source)) {
        expect(source, `${file} imports @/lib/db but uses no shared load-error handler`).toMatch(
          /logLoadError\(|loadOrError\(/,
        );
      }
    }
  });
});

describe("lib/ load-failure catches call logLoadError with the right scope (AC5)", () => {
  it("LB-E3: chat.ts, health.ts and home.ts each log through their documented scope", () => {
    const chatSource = readFileSync(path.join(REPO_ROOT, "lib/ai/chat.ts"), "utf8");
    const healthSource = readFileSync(path.join(REPO_ROOT, "lib/health.ts"), "utf8");
    const homeSource = readFileSync(path.join(REPO_ROOT, "lib/monitoring/home.ts"), "utf8");

    expect(chatSource).toContain('logLoadError("chat"');
    expect(healthSource).toContain('logLoadError("health"');
    expect(homeSource).toContain('logLoadError("home/report-links"');
  });

  it("LB-E4: lib/log/load-error.ts is pure — no process.env, no .stack, exactly one console.error(, no import", () => {
    const source = readFileSync(path.join(REPO_ROOT, "lib/log/load-error.ts"), "utf8");
    expect(source).not.toContain("process.env");
    expect(source).not.toContain(".stack");
    expect(source).not.toMatch(/^\s*import /m);
    const matches = source.match(/console\.error\(/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it("LB-E5: console. appears in non-test lib/ sources only in load-error.ts and the pre-existing daily-handler.ts; nowhere in app/**", () => {
    const libFiles = allLibSources();
    const withConsole = libFiles.filter((f) => readFileSync(path.join(REPO_ROOT, "lib", f), "utf8").includes("console."));
    expect(withConsole.sort()).toEqual(["cron/daily-handler.ts", "log/load-error.ts"]);

    const appFiles = allAppSources();
    const appWithConsole = appFiles.filter((f) => readFileSync(path.join(APP_DIR, f), "utf8").includes("console."));
    expect(appWithConsole).toEqual([]);
  });
});
