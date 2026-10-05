import type { ExtractionAdapter, ExtractionResult } from "./types";

/** Optional leading `-`, digits, optionally `.` plus digits. No thousands separator. */
export const CANONICAL_NUMERIC_PATTERN = /^-?\d+(\.\d+)?$/;

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** True when `s` is `YYYY-MM-DD` and a real Gregorian calendar date. Pure arithmetic, no `Date`. */
export function isIsoCalendarDate(s: string): boolean {
  const match = ISO_DATE_RE.exec(s);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12) {
    return false;
  }
  const daysInMonth = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day >= 1 && day <= daysInMonth;
}

export type ViolationRule =
  | "unknown_field"
  | "duplicate_field"
  | "uncovered_field"
  | "invalid_report_date"
  | "invalid_numeric_value"
  | "empty_raw_value"
  | "empty_error";

export type ContractViolation = {
  rule: ViolationRule;
  fieldKey?: string;
  message: string;
};

/**
 * Reports every way `result` breaks the `ExtractionAdapter` contract (empty = valid). Never
 * throws, never mutates its inputs.
 */
export function validateExtractionResult(
  adapter: Pick<ExtractionAdapter, "fieldKeys">,
  result: ExtractionResult,
): ContractViolation[] {
  if (!result.ok) {
    if (result.error.trim() === "") {
      return [{ rule: "empty_error", message: "error must be a non-empty string" }];
    }
    return [];
  }

  const violations: ContractViolation[] = [];
  const fieldKeySet = new Set(adapter.fieldKeys);
  const keys = [...result.values.map((v) => v.fieldKey), ...result.missingFields];
  const seenCounts = new Map<string, number>();
  for (const key of keys) {
    seenCounts.set(key, (seenCounts.get(key) ?? 0) + 1);
  }
  const distinctKeys = new Set(keys);

  for (const key of distinctKeys) {
    if (!fieldKeySet.has(key)) {
      violations.push({ rule: "unknown_field", fieldKey: key, message: `"${key}" is not in adapter.fieldKeys` });
    }
  }

  for (const key of distinctKeys) {
    if ((seenCounts.get(key) ?? 0) > 1) {
      violations.push({
        rule: "duplicate_field",
        fieldKey: key,
        message: `"${key}" appears more than once across values/missingFields`,
      });
    }
  }

  for (const key of adapter.fieldKeys) {
    if (!seenCounts.has(key)) {
      violations.push({
        rule: "uncovered_field",
        fieldKey: key,
        message: `"${key}" is in neither values nor missingFields`,
      });
    }
  }

  if (!isIsoCalendarDate(result.reportDate)) {
    violations.push({
      rule: "invalid_report_date",
      message: `reportDate "${result.reportDate}" is not a valid YYYY-MM-DD calendar date`,
    });
  }

  for (const value of result.values) {
    if (!CANONICAL_NUMERIC_PATTERN.test(value.numericValue)) {
      violations.push({
        rule: "invalid_numeric_value",
        fieldKey: value.fieldKey,
        message: `numericValue "${value.numericValue}" for "${value.fieldKey}" is not canonical`,
      });
    }
    if (value.rawValue.trim() === "") {
      violations.push({
        rule: "empty_raw_value",
        fieldKey: value.fieldKey,
        message: `rawValue for "${value.fieldKey}" is empty`,
      });
    }
  }

  return violations;
}
