/** Pure CSS helpers for tests: no dependency, no DOM. */

export function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

export interface CssRule {
  selector: string;
  body: string;
  /** at-rule prelude this rule is nested in, if any (e.g. "@media (min-width: 640px)") */
  atRule: string | null;
}

/**
 * Brace-matching scanner. Flattens @media and @theme blocks into their
 * inner rules (recording the at-rule prelude on each), and records
 * @theme's own declarations as a rule with selector "@theme".
 */
export function parseRules(css: string): CssRule[] {
  const text = stripComments(css);
  const rules: CssRule[] = [];

  function scan(input: string, start: number, end: number, atRule: string | null): void {
    let i = start;
    while (i < end) {
      const braceIdx = input.indexOf("{", i);
      const semiIdx = input.indexOf(";", i);
      if (semiIdx !== -1 && semiIdx < end && (braceIdx === -1 || braceIdx >= end || semiIdx < braceIdx)) {
        // A body-less statement (e.g. @import "...";) — skip it.
        i = semiIdx + 1;
        continue;
      }
      if (braceIdx === -1 || braceIdx >= end) break;
      const prelude = input.slice(i, braceIdx).trim();
      let depth = 1;
      let j = braceIdx + 1;
      while (j < end && depth > 0) {
        if (input[j] === "{") depth++;
        else if (input[j] === "}") depth--;
        j++;
      }
      const body = input.slice(braceIdx + 1, j - 1);
      if (prelude.startsWith("@media") || prelude.startsWith("@supports")) {
        scan(input, braceIdx + 1, j - 1, prelude);
      } else if (prelude.startsWith("@theme")) {
        rules.push({ selector: "@theme", body, atRule });
      } else if (prelude.startsWith("@")) {
        // other at-rules (@import has no body reached here): skip
      } else if (prelude.length > 0) {
        rules.push({ selector: prelude, body, atRule });
      }
      i = j;
    }
  }

  scan(text, 0, text.length, null);
  return rules;
}

export function getTokenBlocks(css: string): CssRule[] {
  return parseRules(css).filter(
    (r) => r.selector === ":root" || r.selector === ':root[data-theme="dark"]',
  );
}

/** Remove the bodies of the two token blocks from the source (for literal scans). */
export function removeTokenBlocks(css: string): string {
  const text = stripComments(css);
  let result = text;
  for (const selector of [":root", ':root[data-theme="dark"]']) {
    const idx = result.indexOf(selector);
    if (idx === -1) continue;
    const braceIdx = result.indexOf("{", idx);
    if (braceIdx === -1) continue;
    let depth = 1;
    let j = braceIdx + 1;
    while (j < result.length && depth > 0) {
      if (result[j] === "{") depth++;
      else if (result[j] === "}") depth--;
      j++;
    }
    result = result.slice(0, idx) + result.slice(j);
  }
  return result;
}

export function parseDeclarations(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of body.split(";")) {
    const colonIdx = part.indexOf(":");
    if (colonIdx === -1) continue;
    const prop = part.slice(0, colonIdx).trim();
    const value = part.slice(colonIdx + 1).trim();
    if (!prop) continue;
    out[prop] = value;
  }
  return out;
}

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3 || h.length === 4) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return [r, g, b];
}

function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  const [rl, gl, bl] = [linearize(r), linearize(g), linearize(b)];
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

export function contrastRatio(hexA: string, hexB: string): number {
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function hslHue(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;
  let hue: number;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue *= 60;
  if (hue < 0) hue += 360;
  return hue;
}

export function hueDelta(hexA: string, hexB: string): number {
  const diff = Math.abs(hslHue(hexA) - hslHue(hexB));
  return Math.min(diff, 360 - diff);
}
