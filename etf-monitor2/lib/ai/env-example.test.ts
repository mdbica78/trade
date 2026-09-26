import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PROVIDER_CATALOG } from "./provider-catalog";

describe("`.env.example` documents every provider's API key variable (EX-1)", () => {
  const source = readFileSync(path.join(__dirname, "..", "..", ".env.example"), "utf8");
  const lines = source.split("\n");

  for (const provider of PROVIDER_CATALOG) {
    it(`has "${provider.apiKeyEnvVar}=" preceded by a comment line`, () => {
      const index = lines.findIndex((line) => line === `${provider.apiKeyEnvVar}=`);
      expect(index, `"${provider.apiKeyEnvVar}=" not found`).toBeGreaterThan(0);
      expect(lines[index - 1].trimStart().startsWith("#")).toBe(true);
    });
  }
});
