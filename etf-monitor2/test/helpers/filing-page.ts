const TABLE_RE = /<table[^>]*\bid=(["'])gv5News\1[^>]*>([\s\S]*?)<\/table>/i;
const ROW_RE = /<tr>([\s\S]*?)<\/tr>/gi;
const ANCHOR_RE = /<a\s+href=(['"])([\s\S]*?)\1([\s\S]*?)<\/a>/i;
const HREF_RE = /<a\s+href=(['"])([\s\S]*?)\1/gi;

function requireTable(html: string): RegExpExecArray {
  const match = TABLE_RE.exec(html);
  if (!match) {
    throw new Error("filing-page: gv5News table not found");
  }
  return match;
}

/**
 * Replaces the `<a href>` anchors of the first `gv5News` row that has any, with one anchor per
 * given href (in the given order), keeping the anchor's other attributes/content. The page's
 * markup uses single-quoted attributes (test/fixtures/bvb/README.md), so this preserves them.
 */
export function withNewestRowHrefs(html: string, hrefs: readonly string[]): string {
  const tableMatch = requireTable(html);
  const inner = tableMatch[2];
  let replaced = false;

  const newInner = inner.replace(ROW_RE, (rowMatch, rowInner: string) => {
    if (replaced) {
      return rowMatch;
    }
    const anchorMatch = ANCHOR_RE.exec(rowInner);
    if (!anchorMatch) {
      return rowMatch;
    }
    replaced = true;
    const [fullAnchor, quote, , rest] = anchorMatch;
    const newAnchors = hrefs.map((href) => `<a href=${quote}${href}${quote}${rest}</a>`).join(" ");
    return rowMatch.replace(fullAnchor, newAnchors);
  });

  if (!replaced) {
    throw new Error("filing-page: no row with an <a href> found");
  }
  const newTable = tableMatch[0].replace(inner, newInner);
  return html.replace(tableMatch[0], newTable);
}

/** Drops the first `n` `<tr>` rows of the `gv5News` table, so row `n` becomes the newest. */
export function withoutRowsBefore(html: string, n: number): string {
  const tableMatch = requireTable(html);
  const inner = tableMatch[2];
  const rows = [...inner.matchAll(/<tr>[\s\S]*?<\/tr>/gi)];
  const kept = rows
    .slice(n)
    .map((m) => m[0])
    .join("");
  const newTable = tableMatch[0].replace(inner, kept);
  return html.replace(tableMatch[0], newTable);
}

/** An independent (non-production) regex read of one row's hrefs, in document order, for cross-checking discovery's output. */
export function rowHrefs(html: string, rowIndex: number): string[] {
  const tableMatch = requireTable(html);
  const rows = [...tableMatch[2].matchAll(/<tr>([\s\S]*?)<\/tr>/gi)];
  const row = rows[rowIndex];
  if (!row) {
    throw new Error(`filing-page: row ${rowIndex} not found`);
  }
  return [...row[1].matchAll(HREF_RE)].map((m) => m[2]);
}
