import { describe, expect, it } from "vitest";
import { findLabel, labelSource, parseDottedDate, tokenAfter, tokensAfter, tokenWindowEnd } from "./text";

describe("labelSource / findLabel (TX-1)", () => {
  it("tolerates whitespace runs and newlines between label words", () => {
    const text = "before ACTIV  NET\n(in valuta) after";
    const span = findLabel(text, "ACTIV NET (in valuta)");
    expect(span).not.toBeNull();
    expect(text.slice(span!.start, span!.end)).toBe("ACTIV  NET\n(in valuta)");
  });

  it("escapes regex metacharacters in label words", () => {
    expect(findLabel("Total NAV (EUR) VAN total (EUR)", "Total NAV (EUR) VAN total (EUR)")).not.toBeNull();
  });

  it("returns null when the label isn't found", () => {
    expect(findLabel("lorem ipsum", "ACTIV NET")).toBeNull();
  });

  it("respects the [from, to) bound", () => {
    const text = "ACTIV NET here, ACTIV NET there";
    const span = findLabel(text, "ACTIV NET", 5);
    expect(span!.start).toBe(16);
  });

  it("labelSource joins escaped words with \\s+", () => {
    expect(labelSource("A.B C")).toBe("A\\.B\\s+C");
  });
});

describe("tokenAfter (TX-2)", () => {
  it("skips leading whitespace and takes the next non-whitespace run", () => {
    const tok = tokenAfter("   42 next", 0);
    expect(tok).toEqual({ token: "42", end: 5 });
  });

  it("returns null at end of text", () => {
    expect(tokenAfter("abc", 3)).toBeNull();
  });

  it("respects the `to` bound", () => {
    expect(tokenAfter("abc def", 3, 4)).toBeNull();
  });
});

describe("tokensAfter / tokenWindowEnd (TX-3)", () => {
  it("returns the next n tokens with end offsets", () => {
    const text = "one two three four";
    const tokens = tokensAfter(text, 0, 2);
    expect(tokens.map((t) => t.token)).toEqual(["one", "two"]);
  });

  it("returns fewer than n tokens when the text runs out", () => {
    const text = "one two";
    const tokens = tokensAfter(text, 0, 5);
    expect(tokens.map((t) => t.token)).toEqual(["one", "two"]);
  });

  it("tokenWindowEnd is the end offset of the n-th token", () => {
    const text = "one two three";
    const end = tokenWindowEnd(text, 0, 2);
    expect(text.slice(0, end)).toBe("one two");
  });

  it("tokenWindowEnd falls back to text.length when fewer than n tokens remain", () => {
    const text = "one two";
    expect(tokenWindowEnd(text, 0, 10)).toBe(text.length);
  });
});

describe("parseDottedDate (TX-4)", () => {
  it("parses a real calendar date", () => {
    expect(parseDottedDate("24.09.2026")).toBe("2026-09-24");
  });

  it("rejects an impossible date", () => {
    expect(parseDottedDate("31.09.2026")).toBeNull();
  });

  it("rejects a non-leap Feb 29", () => {
    expect(parseDottedDate("29.02.2026")).toBeNull();
  });

  it("rejects a token that isn't DD.MM.YYYY shaped", () => {
    expect(parseDottedDate("2026-09-24")).toBeNull();
    expect(parseDottedDate("abc")).toBeNull();
  });
});
