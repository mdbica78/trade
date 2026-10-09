import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, getTokenBlocks, hueDelta, parseDeclarations } from "@/test/helpers/css";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
const [lightBlock, darkBlock] = getTokenBlocks(css);
const light = parseDeclarations(lightBlock.body);
const dark = parseDeclarations(darkBlock.body);

const TEXT_TOKENS = ["--text", "--muted", "--accent", "--gain", "--loss", "--flat", "--warn"];
const SURFACES = ["--bg", "--panel", "--head", "--hover"];
const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;

function isPlainHex(value: string): boolean {
  return HEX_RE.test(value.trim());
}

// Mockup token values, from backlog/home-design/mockup-home.html (light only —
// DEC-020 §1 names that appear in the spec's token line).
const MOCKUP_LIGHT: Record<string, string> = {
  "--bg": "#eef1f6",
  "--panel": "#ffffff",
  "--head": "#f5f7fb",
  "--line": "#dde3ee",
  "--text": "#1b2433",
  "--muted": "#5d6b82",
  "--accent": "#1f6feb",
  "--gain": "#0f8a4b",
  "--loss": "#d1323f",
  "--flat": "#5d6b82",
  "--hover": "#f1f5fd",
};

describe("US-035 AC2: contrast", () => {
  it("CT-1 every checked token is a plain hex colour, not color-mix()/var()", () => {
    for (const theme of [light, dark]) {
      for (const name of [...TEXT_TOKENS, ...SURFACES, "--focus", "--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5", "--chart-6"]) {
        expect(isPlainHex(theme[name]), `${name} = "${theme[name]}" must be a plain hex colour`).toBe(true);
      }
    }
  });

  it("CT-2 every text token reaches >= 4.5:1 on every surface, in both themes", () => {
    const failures: string[] = [];
    for (const [themeName, theme] of [["light", light], ["dark", dark]] as const) {
      for (const surface of SURFACES) {
        for (const text of TEXT_TOKENS) {
          const ratio = contrastRatio(theme[text], theme[surface]);
          if (ratio < 4.5) {
            failures.push(`${themeName}: ${text} on ${surface} = ${ratio.toFixed(2)}`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("CT-3 panel text on an accent fill reaches >= 4.5:1, in both themes", () => {
    expect(contrastRatio(light["--panel"], light["--accent"])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(dark["--panel"], dark["--accent"])).toBeGreaterThanOrEqual(4.5);
  });

  it("CT-4 focus reaches >= 3:1 on every surface, and chart colours reach >= 3:1 on panel", () => {
    for (const theme of [light, dark]) {
      for (const surface of SURFACES) {
        expect(contrastRatio(theme["--focus"], theme[surface])).toBeGreaterThanOrEqual(3);
      }
      for (let i = 1; i <= 6; i++) {
        expect(contrastRatio(theme[`--chart-${i}`], theme["--panel"])).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("CT-5 adjusted tokens keep the mockup hue within +/-8 degrees", () => {
    for (const [name, mockupValue] of Object.entries(MOCKUP_LIGHT)) {
      const shipped = light[name];
      if (!shipped) continue;
      if (shipped.toLowerCase() === mockupValue.toLowerCase()) continue;
      const delta = hueDelta(shipped, mockupValue);
      expect(delta, `${name}: shipped ${shipped} vs mockup ${mockupValue}`).toBeLessThanOrEqual(8);
    }
  });

  it("CT-6 self-check: the checker fails on a synthetic low-contrast pair and known ratios", () => {
    expect(contrastRatio("#777777", "#888888")).toBeLessThan(4.5);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
    expect(contrastRatio("#566173", "#10151d")).toBeLessThan(4.5);
  });
});
