import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findBuildCss, renderHomeQaFiles } from "./render-home";

const directories: string[] = [];

function fixtureDirs() {
  const root = mkdtempSync(path.join(tmpdir(), "home-qa-"));
  directories.push(root);
  return { outDir: path.join(root, "output"), nextDir: path.join(root, ".next") };
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("US-036 QA render harness", () => {
  it("fails before creating output if the production stylesheet is missing", () => {
    const { outDir, nextDir } = fixtureDirs();
    expect(() => renderHomeQaFiles(outDir, nextDir)).toThrow();
    expect(existsSync(outDir)).toBe(false);
  });

  it("renders the shipped home body in RO/EN and light/dark with every build stylesheet", () => {
    const { outDir, nextDir } = fixtureDirs();
    const cssDir = path.join(nextDir, "static", "css");
    mkdirSync(cssDir, { recursive: true });
    writeFileSync(path.join(cssDir, "a.css"), "body { color: red; }");
    writeFileSync(path.join(cssDir, "b.css"), "table { color: blue; }");

    expect(findBuildCss(nextDir)).toHaveLength(2);
    const files = renderHomeQaFiles(outDir, nextDir);
    expect(files.map((file) => path.basename(file)).sort()).toEqual([
      "home-en-dark.html",
      "home-en-light.html",
      "home-ro-dark.html",
      "home-ro-light.html",
    ]);
    for (const file of files) {
      const html = readFileSync(file, "utf8");
      expect(html).toContain('href="./build-0.css"');
      expect(html).toContain('href="./build-1.css"');
      expect(html).toContain("data-home-row-link");
      expect(html).toContain("data-home-pdf-link");
      expect(html).toContain("data-home-change");
      expect(html).toContain("data-table-scroll");
      expect(html).toContain("BTBETRETF");
      expect(html).toContain("▲");
      expect(html).toContain("▼");
      expect(html).toContain("–");
      expect(html).toContain("NOADAPTER");
      expect(html).toContain("data-extraction-unavailable");
      expect(html).toContain('aria-expanded="true"');
      expect(html.match(/<fieldset class="home-customize-group">/g)).toHaveLength(3);
      expect(html.match(/<legend>/g)).toHaveLength(3);
      expect(html).toContain('type="checkbox"');
      expect(html).toContain(file.includes("-ro-") ? 'lang="ro"' : 'lang="en"');
      expect(html).toContain(file.includes("-dark.") ? 'data-theme="dark"' : 'data-theme="light"');
    }
    expect(readFileSync(path.join(outDir, "build-0.css"), "utf8")).toContain("color: red");
    expect(readFileSync(path.join(outDir, "build-1.css"), "utf8")).toContain("color: blue");
  });
});
