import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  getTokenBlocks,
  hueDelta,
  parseDeclarations,
  parseRules,
  relativeLuminance,
  removeTokenBlocks,
  stripComments,
} from "./css";

const FIXTURE = `
:root {
  --bg: #ffffff; /* comment with a { brace */
  --text: #000000;
}
:root[data-theme="dark"] {
  --bg: #111111;
}
@media (min-width: 640px) {
  .x { color: red; }
}
table { color: blue; }
`;

describe("css helpers", () => {
  it("CSS-H1 strips comments even with braces inside", () => {
    const stripped = stripComments(FIXTURE);
    expect(stripped).not.toContain("comment with a");
  });

  it("CSS-H1 parseRules flattens @media and records prelude", () => {
    const rules = parseRules(FIXTURE);
    const media = rules.find((r) => r.selector === ".x");
    expect(media?.atRule).toBe("@media (min-width: 640px)");
    const table = rules.find((r) => r.selector === "table");
    expect(table?.atRule).toBeNull();
  });

  it("CSS-H1 getTokenBlocks finds exactly the two root blocks", () => {
    const blocks = getTokenBlocks(FIXTURE);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].selector).toBe(":root");
    expect(blocks[1].selector).toBe(':root[data-theme="dark"]');
  });

  it("CSS-H1 removeTokenBlocks removes both blocks' bodies", () => {
    const rest = removeTokenBlocks(FIXTURE);
    expect(rest).not.toContain("#ffffff");
    expect(rest).not.toContain("#111111");
    expect(rest).toContain("table { color: blue; }");
  });

  it("CSS-H1 parseDeclarations splits name:value pairs", () => {
    const decls = parseDeclarations("color: red; background: blue");
    expect(decls).toEqual({ color: "red", background: "blue" });
  });

  it("CSS-H2 known WCAG contrast values", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
  });

  it("CSS-H2 known low-contrast pair fails 4.5", () => {
    expect(contrastRatio("#566173", "#10151d")).toBeLessThan(4.5);
  });

  it("CSS-H3 relativeLuminance is monotonic black to white", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBe(1);
  });

  it("CSS-H3 hueDelta is 0 for identical hues and small for near hues", () => {
    expect(hueDelta("#ff0000", "#ff0000")).toBe(0);
    expect(hueDelta("#1a5fd0", "#1f6feb")).toBeLessThan(10);
  });
});
