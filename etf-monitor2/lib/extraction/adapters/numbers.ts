/**
 * FINDINGS "Number formatting": comma is the thousands separator, dot is the decimal
 * separator, the number of decimals varies, and there is no sign. No trimming happens here —
 * the caller passes a whitespace-free token, so " 77" and "77 " are rejected.
 */
export const REPORT_NUMBER_PATTERN = /^(?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\.[0-9]+)?$/;

export type ParsedReportNumber = { numericValue: string; rawValue: string };

export function parseReportNumber(token: string): ParsedReportNumber | null {
  if (!REPORT_NUMBER_PATTERN.test(token)) {
    return null;
  }
  return { numericValue: token.replace(/,/g, ""), rawValue: token };
}
