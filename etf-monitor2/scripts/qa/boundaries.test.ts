import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { walkFiles } from "@/test/helpers/walk-files";

describe("US-036 QA render code stays outside the application", () => {
  it("no application module imports scripts/qa, by alias or relative path", () => {
    const root = process.cwd();
    const files = ["app", "lib", "components"].flatMap((dir) => walkFiles(root, dir, [".ts", ".tsx"]));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(path.join(root, file), "utf8");
      const imports = source.matchAll(/(?:from\s*|import\s*\(|require\s*\()\s*["']([^"']+)["']/g);
      for (const [, specifier] of imports) {
        const resolved = specifier.startsWith("@/")
          ? path.resolve(root, specifier.slice(2))
          : path.resolve(root, path.dirname(file), specifier);
        expect(resolved.startsWith(path.join(root, "scripts", "qa") + path.sep), `${file} imports ${specifier}`).toBe(false);
      }
    }
  });
});
