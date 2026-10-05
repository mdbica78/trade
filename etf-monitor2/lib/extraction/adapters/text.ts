import type { ExtractedValue, ExtractionResult } from "./types";
import { isIsoCalendarDate } from "./validate";

/** Escapes regex metacharacters in one label word (R2). */
function escapeWord(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Splits a label on whitespace, escapes each word, and rejoins with \s+ (tolerates runs of whitespace, R2). */
export function labelSource(label: string): string {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .map(escapeWord)
    .join("\\s+");
}

export type Span = { start: number; end: number };

/** First match of `label` lying entirely inside text.slice(from, to). No module-level regex (R1). */
export function findLabel(text: string, label: string, from = 0, to: number = text.length): Span | null {
  const slice = text.slice(from, to);
  const match = new RegExp(labelSource(label)).exec(slice);
  if (!match) {
    return null;
  }
  return { start: from + match.index, end: from + match.index + match[0].length };
}

/** Skips whitespace from pos, then takes the maximal run of non-whitespace inside [pos, to). */
export function tokenAfter(text: string, pos: number, to: number = text.length): { token: string; end: number } | null {
  let i = pos;
  while (i < to && /\s/.test(text[i])) {
    i += 1;
  }
  const start = i;
  while (i < to && !/\s/.test(text[i])) {
    i += 1;
  }
  if (i === start) {
    return null;
  }
  return { token: text.slice(start, i), end: i };
}

/**
 * The next `n` whitespace-separated tokens starting at `from`, each with its end offset. Stops
 * early (returns fewer than `n`) when the text runs out.
 */
export function tokensAfter(text: string, from: number, n: number): { token: string; end: number }[] {
  const tokens: { token: string; end: number }[] = [];
  let pos = from;
  for (let i = 0; i < n; i += 1) {
    const tok = tokenAfter(text, pos);
    if (!tok) {
      break;
    }
    tokens.push(tok);
    pos = tok.end;
  }
  return tokens;
}

/** The index just after the n-th whitespace-separated token from `from`, or `text.length`. */
export function tokenWindowEnd(text: string, from: number, n: number): number {
  const tokens = tokensAfter(text, from, n);
  if (tokens.length === 0) {
    return text.length;
  }
  return tokens[tokens.length - 1].end;
}

const DOTTED_DATE_RE = /^(\d{2})\.(\d{2})\.(\d{4})$/;

/** "DD.MM.YYYY" -> ISO "YYYY-MM-DD", or null if the token isn't shaped like that or isn't a real calendar date. */
export function parseDottedDate(token: string): string | null {
  const match = DOTTED_DATE_RE.exec(token);
  if (!match) {
    return null;
  }
  const [, dd, mm, yyyy] = match;
  const iso = `${yyyy}-${mm}-${dd}`;
  return isIsoCalendarDate(iso) ? iso : null;
}

/**
 * Shared report-date loop (US-049 A4): every occurrence of a global `labelRe` must be followed
 * by a valid dotted date, and every occurrence must agree. `messages.occurrence` names the label
 * in the "not found after … occurrence N" error (e.g. `"footer"` or `'"Data:"'`);
 * `messages.missing` is the whole "label missing" error.
 */
export function findUniqueReportDate(
  text: string,
  labelRe: RegExp,
  messages: { occurrence: string; missing: string },
): { reportDate: string } | { error: string } {
  const re = new RegExp(labelRe.source, labelRe.flags.includes("g") ? labelRe.flags : `${labelRe.flags}g`);
  const dates = new Set<string>();
  let match: RegExpExecArray | null;
  let found = 0;

  while ((match = re.exec(text)) !== null) {
    found += 1;
    const tok = tokenAfter(text, match.index + match[0].length);
    if (!tok) {
      return { error: `report date not found after ${messages.occurrence} occurrence ${found}` };
    }
    const iso = parseDottedDate(tok.token);
    if (!iso) {
      return { error: `invalid report date "${tok.token}"` };
    }
    dates.add(iso);
  }

  if (found === 0) {
    return { error: messages.missing };
  }
  if (dates.size > 1) {
    return { error: `conflicting report dates: ${[...dates].join(", ")}` };
  }
  return { reportDate: [...dates][0] };
}

/** Builds the fixed `fieldKeys`-ordered values/missingFields result shared by every adapter. */
export function toExtractionResult(
  reportDate: string,
  fieldKeys: readonly string[],
  found: ReadonlyMap<string, { numericValue: string; rawValue: string }>,
): ExtractionResult {
  const values: ExtractedValue[] = [];
  const missingFields: string[] = [];
  for (const fieldKey of fieldKeys) {
    const value = found.get(fieldKey);
    if (value) {
      values.push({ fieldKey, numericValue: value.numericValue, rawValue: value.rawValue });
    } else {
      missingFields.push(fieldKey);
    }
  }
  return { ok: true, reportDate, values, missingFields };
}
