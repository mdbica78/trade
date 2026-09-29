import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDeclarations, parseRules } from "@/test/helpers/css";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

const POSITIONAL_RE = /(:nth-child|:nth-of-type|:nth-last-child|:first-child|:last-child|:only-child|:not\(\[class\]\))/;
const COLOUR_PROPS = /^(color|background|background-color|border.*|outline.*)$/;

function findPositionalColourViolations(source: string): string[] {
  const rules = parseRules(source);
  const violations: string[] = [];
  for (const rule of rules) {
    if (!POSITIONAL_RE.test(rule.selector)) continue;
    const decls = parseDeclarations(rule.body);
    for (const [prop, value] of Object.entries(decls)) {
      if (COLOUR_PROPS.test(prop) && (value.includes("var(--") || /#[0-9a-fA-F]{3,8}/.test(value))) {
        violations.push(`${rule.selector} { ${prop}: ${value} }`);
      }
    }
  }
  return violations;
}

describe("US-035 AC6/AC3/AC7: stylesheet rules", () => {
  it("GR-1 no positional selector sets a colour", () => {
    expect(findPositionalColourViolations(css)).toEqual([]);
  });

  it("GR-5 self-check: the positional-colour checker is not vacuous", () => {
    const offending = `td:first-child > span:not([class]) { color: var(--warn) }`;
    expect(findPositionalColourViolations(offending)).toHaveLength(1);
  });

  it("GR-2 hook rules exist for run status and extraction-unavailable", () => {
    const rules = parseRules(css);
    const running = rules.find((r) => r.selector === 'tr[data-run-end="running"] [data-run-status]');
    const dnf = rules.find((r) => r.selector === 'tr[data-run-end="did-not-finish"] [data-run-status]');
    const finished = rules.find((r) => r.selector === 'tr[data-run-end="finished"] [data-run-status]');
    const unavailable = rules.find((r) => r.selector === "[data-extraction-unavailable]");
    expect(parseDeclarations(running!.body).color).toBe("var(--accent)");
    expect(parseDeclarations(dnf!.body).color).toBe("var(--loss)");
    expect(parseDeclarations(finished!.body).color).toBe("var(--gain)");
    expect(parseDeclarations(unavailable!.body).color).toBe("var(--warn)");
  });

  it("GR-3 the scroll wrapper hook sets overflow-x, radius, border and background; table itself has none", () => {
    const rules = parseRules(css);
    const wrapper = rules.find((r) => r.selector === "[data-table-scroll]");
    const decls = parseDeclarations(wrapper!.body);
    expect(decls["overflow-x"]).toBe("auto");
    expect(decls["border-radius"]).toBe("var(--radius)");
    expect(decls.border).toContain("var(--line)");
    expect(decls.background).toBe("var(--panel)");

    const inner = rules.find((r) => r.selector === "[data-table-scroll] > table");
    expect(parseDeclarations(inner!.body)["min-width"]).toBeTruthy();

    const bareTable = rules.find((r) => r.selector === "table");
    const bareDecls = parseDeclarations(bareTable!.body);
    expect(bareDecls["border-radius"]).toBeUndefined();
    expect(bareDecls.overflow).toBeUndefined();
  });

  it("GR-4 the active nav link and focus-visible rules use the right tokens", () => {
    const rules = parseRules(css);
    const active = rules.find((r) => r.selector === '[data-app-nav] a[aria-current="page"]');
    const activeDecls = parseDeclarations(active!.body);
    expect(activeDecls.background).toBe("var(--head)");
    expect(activeDecls.color).toBe("var(--accent)");

    const focus = rules.find((r) => r.selector === ":focus-visible");
    expect(parseDeclarations(focus!.body).outline).toContain("var(--focus)");
  });
});
