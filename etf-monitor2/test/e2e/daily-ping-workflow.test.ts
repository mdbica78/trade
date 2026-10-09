import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const PROJECT = path.join(__dirname, "..", "..");
const WORKFLOW = path.join(PROJECT, ".github", "workflows", "daily-ping.yml");
// GitHub only runs workflows from the repository root, which sits one level above this project.
const ROOT_COPY = path.join(PROJECT, "..", ".github", "workflows", "etf-monitor2-daily-ping.yml");

const workflow = readFileSync(WORKFLOW, "utf8");

describe("daily-ping workflow guard (US-062 AC4, DEC-030)", () => {
  it("WF-1: runs hourly on the hour (UTC) and can be started by hand, nothing else", () => {
    expect(workflow).toMatch(/^on:\s*\n\s+schedule:\s*\n\s+- cron: "0 \* \* \* \*"\s*\n\s+workflow_dispatch:/m);
    expect(workflow).not.toMatch(/\bpush:|\bpull_request/);
  });

  it("WF-2: read-only repository permission and no write scopes", () => {
    expect(workflow).toMatch(/^permissions:\s*\n\s+contents: read\s*$/m);
    expect(workflow).not.toMatch(/:\s*write\b/);
  });

  it("WF-3: the base URL and bearer come only from repository secrets; no literal URL, token or Vercel hostname", () => {
    expect(workflow).toContain("${{ secrets.ETF_MONITOR_BASE_URL }}");
    expect(workflow).toContain("${{ secrets.CRON_SECRET }}");
    const withoutComments = workflow.split("\n").filter((line) => !line.trim().startsWith("#")).join("\n");
    expect(withoutComments).not.toMatch(/https?:\/\//);
    expect(withoutComments).not.toContain("vercel.app");
    expect(workflow).toContain("/api/cron/daily");
    expect(workflow).toMatch(/Authorization: Bearer \$\{CRON_SECRET\}/);
  });

  it("WF-4: never traces or echoes a secret, and discards the response body", () => {
    expect(workflow).not.toMatch(/set -[a-z]*x/);
    expect(workflow).not.toMatch(/echo[^\n]*\$\{?(CRON_SECRET|ETF_MONITOR_BASE_URL)/);
    expect(workflow).not.toMatch(/\bprintenv\b|\benv\s*\|/);
    expect(workflow).toContain("--output /dev/null");
    expect(workflow).toContain("--write-out '%{http_code}'");
  });

  it("WF-5: fails the job unless the endpoint answers 200 (skipped pings are 200s)", () => {
    expect(workflow).toContain('test "${status}" = "200"');
  });

  it("WF-6: the repository-root copy that GitHub actually runs is identical to the project's copy", () => {
    expect(existsSync(ROOT_COPY), `${ROOT_COPY} must exist so GitHub runs the workflow`).toBe(true);
    expect(readFileSync(ROOT_COPY, "utf8")).toBe(workflow);
  });

  it("WF-7: vercel.json keeps its daily safety-net call to the same route", () => {
    const config = JSON.parse(readFileSync(path.join(PROJECT, "vercel.json"), "utf8")) as {
      crons: { path: string; schedule: string }[];
    };
    expect(config.crons).toEqual([{ path: "/api/cron/daily", schedule: "0 10 * * *" }]);
  });

  it("WF-8: the README documents the hourly ping, both repository secrets (names only) and the once-per-UTC-day rule", () => {
    const readme = readFileSync(path.join(PROJECT, "README.md"), "utf8");
    expect(readme).toContain("Setting up the hourly ping");
    expect(readme).toContain("ETF_MONITOR_BASE_URL");
    expect(readme).toContain("CRON_SECRET");
    expect(readme).toContain("at most once per UTC day");
    expect(readme).toContain("not_scheduled_hour");
    expect(readme).toContain("already_ran");
    expect(readme).not.toMatch(/copy the line the page shows into `vercel\.json`/);
  });
});
