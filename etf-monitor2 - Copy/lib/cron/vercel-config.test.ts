import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.join(__dirname, "..", "..");
const VERCEL_JSON_PATH = path.join(REPO_ROOT, "vercel.json");
const README_PATH = path.join(REPO_ROOT, "README.md");

describe("AC5: vercel.json", () => {
  const config = JSON.parse(readFileSync(VERCEL_JSON_PATH, "utf8")) as {
    crons: { path: string; schedule: string }[];
    $schema?: string;
  };

  it("has exactly one cron entry for /api/cron/daily", () => {
    expect(config.crons).toHaveLength(1);
    expect(config.crons[0].path).toBe("/api/cron/daily");
  });

  it("the schedule is a once-a-day schedule: minute and hour are single numbers, the rest are *", () => {
    const fields = config.crons[0].schedule.split(" ");
    expect(fields).toHaveLength(5);
    const [minute, hour, dom, month, dow] = fields;
    expect(minute).toMatch(/^\d{1,2}$/);
    expect(Number(minute)).toBeGreaterThanOrEqual(0);
    expect(Number(minute)).toBeLessThanOrEqual(59);
    expect(hour).toMatch(/^\d{1,2}$/);
    expect(Number(hour)).toBeGreaterThanOrEqual(0);
    expect(Number(hour)).toBeLessThanOrEqual(23);
    expect(dom).toBe("*");
    expect(month).toBe("*");
    expect(dow).toBe("*");
  });

  it("has no other top-level key except the optional $schema", () => {
    const keys = Object.keys(config).filter((k) => k !== "$schema");
    expect(keys).toEqual(["crons"]);
  });
});

describe("AC8: README documents the cron contract", () => {
  const readme = readFileSync(README_PATH, "utf8");

  it("no longer calls CRON_SECRET Reserved", () => {
    const cronSecretSection = readme.slice(readme.indexOf("`CRON_SECRET`"), readme.indexOf("`CRON_SECRET`") + 400);
    expect(cronSecretSection).not.toMatch(/Reserved/);
  });

  it("documents the route, the schedule source, the auth header and Production-only cron", () => {
    expect(readme).toContain("/api/cron/daily");
    expect(readme).toContain("vercel.json");
    expect(readme).toContain("Authorization: Bearer");
    expect(readme).toContain("Production");
  });
});

describe("RD-1: README documents the US-023 admin procedure", () => {
  const readme = readFileSync(README_PATH, "utf8");

  it("mentions /admin/cron and no longer points to 'Until US-023'", () => {
    expect(readme).toContain("/admin/cron");
    expect(readme).not.toContain("Until US-023");
  });
});
