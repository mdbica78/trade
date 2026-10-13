import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildDailyCron, createVercelConfig } from "../../vercel";
import { DAILY_CRON_PATH, type BuildCronHour } from "../config/cron-build";
import { extractModuleSpecifiers } from "../../test/helpers/module-specifiers";

const REPO_ROOT = path.join(__dirname, "..", "..");
const README_PATH = path.join(REPO_ROOT, "README.md");

describe("AC1: buildDailyCron", () => {
  it("VC-1: returns the once-a-day entry for a valid hour", () => {
    expect(buildDailyCron(0)).toEqual({ path: "/api/cron/daily", schedule: "0 0 * * *" });
    expect(buildDailyCron(10)).toEqual({ path: "/api/cron/daily", schedule: "0 10 * * *" });
    expect(buildDailyCron(23)).toEqual({ path: "/api/cron/daily", schedule: "0 23 * * *" });
  });

  it("VC-1b: the path equals DAILY_CRON_PATH", () => {
    expect(buildDailyCron(5).path).toBe(DAILY_CRON_PATH);
  });

  it("VC-2: throws RangeError for anything that is not an integer 0-23", () => {
    for (const bad of [-1, 24, 7.5, NaN, Infinity, -Infinity]) {
      expect(() => buildDailyCron(bad)).toThrow(RangeError);
    }
    for (const bad of ["7", null, undefined] as unknown[]) {
      expect(() => buildDailyCron(bad as number)).toThrow(RangeError);
    }
  });
});

describe("AC3: createVercelConfig", () => {
  it("VC-3: builds one entry from an injected resolver and logs the source", async () => {
    const resolve = async (): Promise<BuildCronHour> => ({ hour: 14, source: "db" });
    const lines: string[] = [];
    const result = await createVercelConfig(resolve, (line) => lines.push(line));
    expect(result).toEqual({ crons: [{ path: "/api/cron/daily", schedule: "0 14 * * *" }] });
    expect(result.crons).toHaveLength(1);
    expect(result.crons[0].schedule).toMatch(/^0 \d{1,2} \* \* \*$/);
    expect(lines).toEqual(["[vercel.ts] daily cron hour 14 UTC (source: db)"]);
  });

  it("VC-3b: logs (source: default) for a default resolution", async () => {
    const resolve = async (): Promise<BuildCronHour> => ({ hour: 10, source: "default" });
    const lines: string[] = [];
    await createVercelConfig(resolve, (line) => lines.push(line));
    expect(lines).toEqual(["[vercel.ts] daily cron hour 10 UTC (source: default)"]);
  });

  it("VC-4: a rejecting resolver makes the build fail, with no 'daily cron hour' line logged", async () => {
    const resolve = async (): Promise<BuildCronHour> => {
      throw new Error("could not read the daily cron hour after 3 attempts");
    };
    const lines: string[] = [];
    await expect(createVercelConfig(resolve, (line) => lines.push(line))).rejects.toThrow();
    expect(lines).toEqual([]);
  });
});

describe("AC3: vercel.ts's own exported config (default resolver)", () => {
  it("VC-5: with VERCEL_ENV/DATABASE_URL blank, config is the default schedule and no fetch is made", async () => {
    vi.resetModules();
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("DATABASE_URL", "");
    const fetchSpy = vi.fn(() => {
      throw new Error("fetch must never be called for this build");
    });
    vi.stubGlobal("fetch", fetchSpy);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const mod = await import("../../vercel");
    expect(mod.config).toEqual({ crons: [{ path: "/api/cron/daily", schedule: "0 10 * * *" }] });
    expect(logSpy.mock.calls.some((c) => typeof c[0] === "string" && c[0].includes("(source: default)"))).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});

describe("AC3: exactly one config file, vercel.ts, with no new dependency", () => {
  it("VC-6: vercel.ts exists at the project root; vercel.json and other extensions do not", () => {
    expect(existsSync(path.join(REPO_ROOT, "vercel.ts"))).toBe(true);
    for (const other of ["vercel.json", "vercel.js", "vercel.mjs", "vercel.cjs", "vercel.mts", "vercel.cts"]) {
      expect(existsSync(path.join(REPO_ROOT, other)), `${other} must not exist`).toBe(false);
    }
  });

  it("VC-7: vercel.ts imports only the local cron-build module, nothing else", () => {
    const source = readFileSync(path.join(REPO_ROOT, "vercel.ts"), "utf8");
    const specifiers = extractModuleSpecifiers(source);
    expect(specifiers).toEqual(["./lib/config/cron-build"]);
  });

  it("VC-7b: no @vercel/* package was added as a dependency", () => {
    const pkg = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const allKeys = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
    expect(allKeys.some((k) => k.startsWith("@vercel/"))).toBe(false);
  });

  it("VC-8: nothing in app/, components/, lib/, i18n/ or the Next config imports vercel.ts, and the build script does not mention it", () => {
    const dirs = ["app", "components", "lib", "i18n"].map((d) => path.join(REPO_ROOT, d));
    const specifiersThatReachVercelRoot = (source: string) =>
      extractModuleSpecifiers(source).some((s) =>
        /^(\.\.\/)*vercel$|^@\/vercel$|^\.\/vercel$/.test(s),
      );
    for (const dir of dirs) {
      const files = readdirSync(dir, { recursive: true })
        .filter((f): f is string => typeof f === "string")
        .filter((f) => /\.(ts|tsx|mts|mjs)$/.test(f) && !/\.test\.tsx?$/.test(f));
      for (const file of files) {
        const source = readFileSync(path.join(dir, file), "utf8");
        expect(specifiersThatReachVercelRoot(source), `${dir}/${file} imports vercel.ts`).toBe(false);
      }
    }
    for (const topLevel of ["next.config.ts", "drizzle.config.ts"]) {
      const fullPath = path.join(REPO_ROOT, topLevel);
      if (existsSync(fullPath)) {
        const source = readFileSync(fullPath, "utf8");
        expect(specifiersThatReachVercelRoot(source), `${topLevel} imports vercel.ts`).toBe(false);
      }
    }
    const pkg = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.build ?? "").not.toContain("vercel.ts");
  });

  it("VC-W1: the hourly-ping GitHub Actions workflow is gone (AC7)", () => {
    expect(existsSync(path.join(REPO_ROOT, ".github", "workflows", "daily-ping.yml"))).toBe(false);
  });
});

describe("AC7: README documents the Vercel-native cron contract", () => {
  const readme = readFileSync(README_PATH, "utf8");

  it("VC-R1: documents the route, vercel.ts, the auth header, Production-only, the gate codes and the Deploy Hook", () => {
    for (const must of [
      "/api/cron/daily",
      "vercel.ts",
      "Authorization: Bearer",
      "Production",
      "/admin/cron",
      "not_scheduled_hour",
      "already_ran",
      "Deploy Hook",
      "VERCEL_DEPLOY_HOOK_URL",
    ]) {
      expect(readme, `README should contain "${must}"`).toContain(must);
    }
  });

  it("VC-R2: no longer mentions vercel.json, the GitHub ping or its repository secrets", () => {
    for (const mustNot of ["vercel.json", "Setting up the hourly ping", "ETF_MONITOR_BASE_URL", "daily-ping", "GitHub Actions"]) {
      expect(readme, `README should not contain "${mustNot}"`).not.toContain(mustNot);
    }
  });

  it("no longer calls CRON_SECRET Reserved", () => {
    const cronSecretSection = readme.slice(readme.indexOf("`CRON_SECRET`"), readme.indexOf("`CRON_SECRET`") + 400);
    expect(cronSecretSection).not.toMatch(/Reserved/);
  });
});

describe("RD-1: README documents the US-023 admin procedure", () => {
  const readme = readFileSync(README_PATH, "utf8");

  it("mentions /admin/cron and no longer points to 'Until US-023'", () => {
    expect(readme).toContain("/admin/cron");
    expect(readme).not.toContain("Until US-023");
  });
});
