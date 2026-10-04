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

  it("EX-2: the set of *_API_KEY lines equals exactly the catalogue's, and each is documented with an https:// URL", () => {
    const keyVarLines = lines.filter((line) => /^[A-Z][A-Z0-9_]*_API_KEY=$/.test(line));
    const foundVars = keyVarLines.map((line) => line.replace(/=$/, "")).sort();
    const catalogueVars = PROVIDER_CATALOG.map((p) => p.apiKeyEnvVar).sort();
    expect(foundVars).toEqual(catalogueVars);

    for (const line of keyVarLines) {
      const varName = line.replace(/=$/, "");
      const index = lines.indexOf(line);
      let commentBlock = "";
      for (let i = index - 1; i >= 0 && lines[i].trimStart().startsWith("#"); i -= 1) {
        commentBlock = `${lines[i]}\n${commentBlock}`;
      }
      expect(commentBlock, `comment above ${varName} names a https:// URL`).toMatch(/https:\/\//);
    }
  });

  it("EX-3 (US-040): documents the optional base64 master-key override without a sample secret", () => {
    const index = lines.findIndex((line) => line === "AI_KEY_MASTER_KEY=");
    expect(index).toBeGreaterThan(0);
    const comments = lines.slice(Math.max(0, index - 2), index).join("\n");
    expect(comments).toMatch(/32 random bytes/);
    expect(comments).toMatch(/base64/);
    expect(lines[index]).toBe("AI_KEY_MASTER_KEY=");
  });
});

describe("README documents exactly the catalogue's API key variables (RM-1)", () => {
  const readme = readFileSync(path.join(__dirname, "..", "..", "README.md"), "utf8");
  const envSection = readme.slice(
    readme.indexOf("## Environment variables"),
    readme.indexOf("## ", readme.indexOf("## Environment variables") + 1),
  );

  it("mentions every catalogue apiKeyEnvVar in the Environment variables section", () => {
    for (const provider of PROVIDER_CATALOG) {
      expect(envSection).toContain(provider.apiKeyEnvVar);
    }
  });

  it("every *_API_KEY token in the whole README is a catalogue variable", () => {
    const tokens = readme.match(/\b[A-Z][A-Z0-9_]*_API_KEY\b/g) ?? [];
    const catalogueVars = new Set(PROVIDER_CATALOG.map((p) => p.apiKeyEnvVar));
    for (const token of tokens) {
      expect(catalogueVars.has(token), `README mentions unknown key variable ${token}`).toBe(true);
    }
  });
});
