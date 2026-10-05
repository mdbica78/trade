import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDeclarations, parseRules } from "@/test/helpers/css";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

describe("US-036: home table row-click, PDF button and cell stylesheet rules", () => {
  it("HR-1 (AC1) the row hook is the positioning context, and the row-link's ::after stretches over it", () => {
    const rules = parseRules(css);
    const row = rules.find((r) => r.selector === "[data-home-row]");
    expect(parseDeclarations(row!.body).position).toBe("relative");

    const link = rules.find((r) => r.selector === "[data-home-row-link]");
    expect(parseDeclarations(link!.body).position).toBeUndefined();

    const after = rules.find((r) => r.selector === "[data-home-row-link]::after");
    const decls = parseDeclarations(after!.body);
    expect(decls.position).toBe("absolute");
    expect(decls.inset).toBe("0");
  });

  it("HR-2 (AC2) the PDF button hook sits above the stretched link with its own z-index, and has a border", () => {
    const rules = parseRules(css);
    const pdf = rules.find((r) => r.selector.includes("[data-home-pdf-link]") && !r.selector.includes(":hover"));
    const decls = parseDeclarations(pdf!.body);
    expect(decls.position).toBe("relative");
    expect(Number(decls["z-index"])).toBeGreaterThan(0);
    expect(decls.border).toBeTruthy();
    expect(decls["border-radius"]).toBeTruthy();
  });

  it("HR-3 (AC7) the numeric-cell hook is right-aligned and inherits tabular digits from body", () => {
    const rules = parseRules(css);
    const numeric = rules.find((r) => r.selector === "[data-home-numeric]");
    const decls = parseDeclarations(numeric!.body);
    expect(decls["text-align"]).toBe("right");
    expect(decls["font-variant-numeric"]).toBeUndefined();
    const body = rules.find((r) => r.selector === "body");
    expect(parseDeclarations(body!.body)["font-variant-numeric"]).toBe("tabular-nums");
  });

  it("HR-3a (spec rule 3) home body rows have 14px vertical padding", () => {
    const rowCells = parseRules(css).find((r) => r.selector === "[data-home-row] > td");
    expect(parseDeclarations(rowCells!.body)["padding-block"]).toBe("0.875rem");
  });

  it("HR-4 (AC8) the numeric/date-cell hook (shared by both) does not wrap", () => {
    const rules = parseRules(css);
    const numeric = rules.find((r) => r.selector === "[data-home-numeric]");
    expect(parseDeclarations(numeric!.body)["white-space"]).toBe("nowrap");
  });

  it("HR-5 self-check: the checks above are not vacuous", () => {
    const rules = parseRules(css);
    expect(rules.some((r) => r.selector === "[data-home-row]")).toBe(true);
    expect(rules.some((r) => r.selector.includes("[data-home-pdf-link]"))).toBe(true);
  });
});
