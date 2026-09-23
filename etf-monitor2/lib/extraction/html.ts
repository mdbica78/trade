const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body[0] === "#") {
      const isHex = body[1] === "x" || body[1] === "X";
      const codePoint = Number.parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    const replacement = NAMED_ENTITIES[body];
    return replacement ?? match;
  });
}

export function stripTags(input: string): string {
  return input.replace(/<[^>]*>/g, "");
}

export function collapseWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

// Romanian ș/ț (comma below, U+0219/U+021B/U+0218/U+021A) have no canonical Unicode
// decomposition, unlike the legacy cedilla forms ş/ţ — normalize both variants by hand
// before NFD so "Știri"/"Ştiri"/"Stiri" all fold to the same string.
const ROMANIAN_COMMA_BELOW: Record<string, string> = {
  "Ș": "S",
  "ș": "s",
  "Ț": "T",
  "ț": "t",
};

export function foldForMatch(input: string): string {
  const withoutCommaBelow = input.replace(/[ȘșȚț]/g, (ch) => ROMANIAN_COMMA_BELOW[ch]);
  return withoutCommaBelow
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
