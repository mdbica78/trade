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

describe("README documents migrate-before-deploy and the load-error diagnostic (AC7)", () => {
  const readme = readFileSync(README_PATH, "utf8");

  it("RD-D1: the Deployment section has the bold migrate-first sentence before the deploy step, and the exact schema-check code", () => {
    const deployment = section(readme, "## Deployment");

    const boldIndex = deployment.indexOf("**Migrate first, then deploy.**");
    expect(boldIndex).toBeGreaterThan(-1);

    const deployStepIndex = deployment.search(/^\d+\.\s+Deploy/m);
    expect(deployStepIndex).toBeGreaterThan(-1);
    expect(boldIndex).toBeLessThan(deployStepIndex);

    expect(deployment).toContain("select to_regclass('public.etf_report_links');");

    const codeIndex = deployment.indexOf("select to_regclass('public.etf_report_links');");
    const afterCode = deployment.indexOf("\n\n", codeIndex);
    const nextParagraphEnd = deployment.indexOf("\n\n", afterCode + 2);
    const nearby = deployment.slice(codeIndex, nextParagraphEnd === -1 ? undefined : nextParagraphEnd);
    expect(nearby).toContain("null");
    expect(nearby).toContain("pnpm db:migrate");
  });

  it("RD-D2: the Health check section mentions pnpm db:migrate and [load-error]", () => {
    const healthCheck = section(readme, "## Health check");
    expect(healthCheck).toContain("pnpm db:migrate");
    expect(healthCheck).toContain("[load-error]");
  });
});
