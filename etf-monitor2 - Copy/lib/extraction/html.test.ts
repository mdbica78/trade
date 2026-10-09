import { describe, expect, it } from "vitest";
import { collapseWhitespace, decodeEntities, foldForMatch, stripTags } from "./html";

describe("decodeEntities", () => {
  it("decodes named entities", () => {
    expect(decodeEntities("a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos;")).toBe('a & b <c> "d" \'e\'');
  });

  it("decodes &amp; inside a query string href", () => {
    expect(decodeEntities("/x.pdf?a=1&amp;b=2")).toBe("/x.pdf?a=1&b=2");
  });

  it("decodes numeric decimal and hex entities, including Romanian diacritics", () => {
    expect(decodeEntities("&#536;tiri")).toBe("Știri");
    expect(decodeEntities("&#x218;tiri")).toBe("Știri");
  });

  it("leaves unknown entities as-is", () => {
    expect(decodeEntities("&unknown;")).toBe("&unknown;");
  });
});

describe("stripTags", () => {
  it("removes tags but keeps text", () => {
    expect(stripTags("<b>bold</b> and <i>italic</i>")).toBe("bold and italic");
  });
});

describe("collapseWhitespace", () => {
  it("collapses runs of whitespace, including CRLF, and trims", () => {
    expect(collapseWhitespace("  a\r\n\tb   c  ")).toBe("a b c");
  });
});

describe("foldForMatch", () => {
  it("folds Romanian comma-below diacritics (Stiri variants) alike", () => {
    expect(foldForMatch("Știri")).toBe("stiri"); // Știri
    expect(foldForMatch("Ştiri")).toBe("stiri"); // Ştiri (cedilla)
    expect(foldForMatch("Stiri")).toBe("stiri");
  });

  it("lowercases and matches VAN title regardless of case/diacritics", () => {
    expect(foldForMatch("VAN LA DATA 22.09.2026")).toBe("van la data 22.09.2026");
  });
});
