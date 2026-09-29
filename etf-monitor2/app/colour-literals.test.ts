import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { removeTokenBlocks } from "@/test/helpers/css";
import { walkFiles } from "@/test/helpers/walk-files";

const HEX_RE = /(?<![\w#])#[0-9a-fA-F]{3,8}\b/g;
const FUNC_RE = /\b(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(/g;

const NAMED_COLOURS = [
  "white",
  "black",
  "red",
  "green",
  "blue",
  "gray",
  "grey",
  "orange",
  "yellow",
  "purple",
  "cyan",
  "magenta",
];
const COLOUR_PROP_RE =
  /(color|background(-color)?|border(-[a-z]+)?-color|outline(-color)?|fill|stroke|box-shadow|text-decoration-color|caret-color|accent-color)\s*:\s*([^;]+)/g;

const TAILWIND_PALETTE_RE =
  /\b(text|bg|border|ring|fill|stroke|outline|divide|from|via|to|shadow|decoration|caret|accent)-(white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-\d{2,3})?\b/g;

const OLD_TOKEN_NAMES = [
  "--bg-panel",
  "--bg-elevated",
  "--bg-hover",
  "--border-strong",
  "--border",
  "--text-muted",
  "--text-dim",
  "--accent-strong",
  "--accent-soft",
  "--gain-soft",
  "--loss-soft",
  "--warn-soft",
  "--background",
  "--foreground",
  "--color-background",
  "--color-foreground",
  "--font-geist-sans",
  "--font-geist-mono",
];

interface Finding {
  file: string;
  detail: string;
}

function scanContent(raw: string, relPath: string, isCss: boolean): Finding[] {
  const content = isCss ? removeTokenBlocks(raw) : raw;
  const findings: Finding[] = [];

  let m: RegExpExecArray | null;
  HEX_RE.lastIndex = 0;
  while ((m = HEX_RE.exec(content))) findings.push({ file: relPath, detail: `hex literal "${m[0]}"` });
  FUNC_RE.lastIndex = 0;
  while ((m = FUNC_RE.exec(content))) findings.push({ file: relPath, detail: `colour function "${m[0]}"` });

  for (const name of OLD_TOKEN_NAMES) {
    const re = new RegExp(`${name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}(?![\\w-])`, "g");
    re.lastIndex = 0;
    while ((m = re.exec(content))) findings.push({ file: relPath, detail: `old token "${name}"` });
  }

  if (isCss) {
    COLOUR_PROP_RE.lastIndex = 0;
    while ((m = COLOUR_PROP_RE.exec(content))) {
      const value = m[5].trim();
      if (value === "transparent" || value === "currentColor" || value === "inherit" || value === "none") continue;
      if (value.startsWith("var(")) continue;
      for (const named of NAMED_COLOURS) {
        if (new RegExp(`\\b${named}\\b`).test(value)) {
          findings.push({ file: relPath, detail: `named colour keyword "${named}" in "${m[0]}"` });
        }
      }
    }
  } else {
    TAILWIND_PALETTE_RE.lastIndex = 0;
    while ((m = TAILWIND_PALETTE_RE.exec(content))) findings.push({ file: relPath, detail: `Tailwind palette class "${m[0]}"` });
  }

  return findings;
}

function scanFile(relPath: string, isCss: boolean): Finding[] {
  const raw = readFileSync(join(process.cwd(), relPath), "utf8");
  return scanContent(raw, relPath, isCss);
}

describe("US-035 AC1/AC5: no colour literal outside the token blocks", () => {
  const root = process.cwd();
  const cssFiles = walkFiles(root, "app", [".css"]);
  const tsxFiles = [...walkFiles(root, "app", [".ts", ".tsx"]), ...walkFiles(root, "components", [".ts", ".tsx"])];

  it("CL-1..CL-4 scans app/**/*.{css,ts,tsx} and components/**/*.{ts,tsx}", () => {
    const findings: Finding[] = [];
    for (const file of cssFiles) findings.push(...scanFile(file, true));
    for (const file of tsxFiles) findings.push(...scanFile(file, false));
    expect(findings).toEqual([]);
  });

  it("CL-5 self-check: each detector flags its synthetic offence, and the scan is not vacuous", () => {
    expect(scanContent("color: #abc123;", "x.css", true).length).toBeGreaterThan(0);
    expect(scanContent("box-shadow: 0 0 0 3px rgba(0,0,0,.5);", "x.css", true).length).toBeGreaterThan(0);
    expect(scanContent("color: white;", "x.css", true).length).toBeGreaterThan(0);
    expect(scanContent("border-color: var(--text-dim);", "x.css", true).length).toBeGreaterThan(0);
    expect(scanContent(`className="bg-slate-800"`, "x.tsx", false).length).toBeGreaterThan(0);
    // clean input produces nothing, so the scan is not vacuous
    expect(scanContent("color: var(--text);", "x.css", true)).toEqual([]);
    expect(cssFiles.length).toBeGreaterThan(0);
    expect(tsxFiles.length).toBeGreaterThan(0);
  });
});
