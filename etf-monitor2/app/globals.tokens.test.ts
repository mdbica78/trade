import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getTokenBlocks, parseDeclarations, parseRules } from "@/test/helpers/css";
import { walkFiles } from "@/test/helpers/walk-files";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

const REQUIRED_NAMES = [
  "--bg",
  "--panel",
  "--head",
  "--line",
  "--text",
  "--muted",
  "--accent",
  "--gain",
  "--loss",
  "--flat",
  "--hover",
  "--radius",
  "--focus",
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
  "--chart-6",
  "--warn",
];

describe("US-035 AC1: token blocks", () => {
  it("TK-1 has exactly one :root and one :root[data-theme=dark] block", () => {
    const blocks = getTokenBlocks(css);
    expect(blocks).toHaveLength(2);
    expect(blocks.filter((b) => b.selector === ":root")).toHaveLength(1);
    expect(blocks.filter((b) => b.selector === ':root[data-theme="dark"]')).toHaveLength(1);
  });

  it("TK-2/TK-3 both blocks declare exactly the same closed set of names", () => {
    const [light, dark] = getTokenBlocks(css);
    const lightDecls = parseDeclarations(light.body);
    const darkDecls = parseDeclarations(dark.body);
    const lightNames = Object.keys(lightDecls).filter((k) => k.startsWith("--")).sort();
    const darkNames = Object.keys(darkDecls).filter((k) => k.startsWith("--")).sort();
    expect(lightNames).toEqual(darkNames);
    expect(lightNames.sort()).toEqual([...REQUIRED_NAMES].sort());
  });

  it("TK-4 each block sets its own color-scheme, no other rule does", () => {
    const [light, dark] = getTokenBlocks(css);
    expect(parseDeclarations(light.body)["color-scheme"]).toBe("light");
    expect(parseDeclarations(dark.body)["color-scheme"]).toBe("dark");
    const rules = parseRules(css);
    const otherWithColorScheme = rules.filter(
      (r) =>
        r.selector !== ":root" &&
        r.selector !== ':root[data-theme="dark"]' &&
        /color-scheme\s*:/.test(r.body),
    );
    expect(otherWithColorScheme).toHaveLength(0);
  });

  it("TK-5 no alias custom property outside the token blocks, except @theme --font-*", () => {
    const rules = parseRules(css);
    for (const rule of rules) {
      if (rule.selector === ":root" || rule.selector === ':root[data-theme="dark"]') continue;
      const decls = parseDeclarations(rule.body);
      for (const name of Object.keys(decls)) {
        if (!name.startsWith("--")) continue;
        if (rule.selector === "@theme" && name.startsWith("--font-")) continue;
        throw new Error(`Unexpected custom property "${name}" declared outside token blocks in rule "${rule.selector}"`);
      }
    }
  });

  it("TK-6 every var(--name) used in app/**, components/** resolves to a defined token", () => {
    const [light] = getTokenBlocks(css);
    const definedInCss = new Set(Object.keys(parseDeclarations(light.body)));
    const themeRule = parseRules(css).find((r) => r.selector === "@theme");
    const definedInTheme = themeRule ? new Set(Object.keys(parseDeclarations(themeRule.body))) : new Set<string>();
    const defined = new Set([...definedInCss, ...definedInTheme]);

    const root = process.cwd();
    const files = [
      ...walkFiles(root, "app", [".css", ".tsx"]),
      ...walkFiles(root, "components", [".tsx"]),
    ];
    const varRe = /var\((--[a-zA-Z0-9-]+)/g;
    const missing = new Set<string>();
    for (const file of files) {
      const content = readFileSync(join(process.cwd(), file), "utf8");
      let m: RegExpExecArray | null;
      while ((m = varRe.exec(content))) {
        if (!defined.has(m[1])) missing.add(`${m[1]} (${file})`);
      }
    }
    expect([...missing]).toEqual([]);
  });
});
