import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const README_PATH = path.join(__dirname, "..", "README.md");

function section(readme: string, heading: string): string {
  const lines = readme.split("\n");
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start === -1) throw new Error(`heading not found: ${heading}`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

describe("README documents the push-only deploy flow (US-048 AC7) and the load-error diagnostic", () => {
  const readme = readFileSync(README_PATH, "utf8");

  it("RD-D1: the Deployment section names the migrate-on-deploy script before the deploy step, and has no separate manual migrate step", () => {
    const deployment = section(readme, "## Deployment");

    const scriptIndex = deployment.indexOf("scripts/migrate-on-deploy.ts");
    expect(scriptIndex).toBeGreaterThan(-1);

    const pushStepIndex = deployment.search(/^\d+\.\s+Push to the production branch/m);
    expect(pushStepIndex).toBeGreaterThan(-1);
    expect(scriptIndex).toBeGreaterThan(pushStepIndex);

    expect(deployment).not.toContain("select to_regclass('public.etf_report_links')");
    expect(deployment).not.toMatch(/^\d+\.\s+Run the migrations against Neon/m);
  });

  it("RD-D2: the Health check section names the migrate-on-deploy script (not a manual pnpm db:migrate step) and [load-error]", () => {
    const healthCheck = section(readme, "## Health check");
    expect(healthCheck).toContain("scripts/migrate-on-deploy.ts");
    expect(healthCheck).not.toContain("run `pnpm db:migrate`");
    expect(healthCheck).toContain("[load-error]");
  });

  it("RD-AI-1 (US-040): documents write-only encrypted keys, the optional override and CRON_SECRET derivation", () => {
    const environment = section(readme, "## Environment variables");
    expect(environment).toContain("`AI_KEY_MASTER_KEY`");
    expect(environment).toContain("32 random bytes encoded as base64");
    expect(environment).toContain("derives an encryption key from `CRON_SECRET` using HKDF-SHA256");
    expect(environment).toContain("encrypted in `ai_provider_keys`");
    expect(environment).toContain("never shown again");
  });
});
