import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT_PATH = path.join(__dirname, "predeploy-check.sh");

describe("scripts/claude/predeploy-check.sh runs the pre-deploy gate safely (US-034 AC4)", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");

  it("PDC-1: runs typecheck, lint, build and test", () => {
    for (const step of ["pnpm typecheck", "pnpm lint", "pnpm build", "pnpm test"]) {
      expect(source).toContain(step);
    }
  });

  it("PDC-2: never runs git, curl or wget", () => {
    expect(source).not.toMatch(/\bgit\s/);
    expect(source).not.toMatch(/\bcurl\b/);
    expect(source).not.toMatch(/\bwget\b/);
  });

  it("PDC-3: never prints a variable's value (no bare echo/printf of a $VAR)", () => {
    expect(source).not.toMatch(/echo\s+"?\$[A-Z_]+"?\s*$/m);
    expect(source).not.toMatch(/printf\s+.*\$[A-Z_]+/);
  });

  it("PDC-4: unsets the four secret-bearing env vars before every step", () => {
    for (const name of ["DATABASE_URL", "GEMINI_API_KEY", "GROQ_API_KEY", "CRON_SECRET"]) {
      expect(source).toContain(`-u ${name}`);
    }
  });
});
