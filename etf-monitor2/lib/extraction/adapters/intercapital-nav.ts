import { parseReportNumber } from "./numbers";
import { findLabel, findUniqueReportDate, toExtractionResult, tokensAfter } from "./text";
import type { ExtractionAdapter, ExtractionResult } from "./types";

export const INTERCAPITAL_NAV_KEY = "intercapital-nav";

/**
 * The Class B (BVB-listed) NAV-per-unit / units-in-circulation figures reuse the BRD field keys
 * (DEC-018 §3, sprint decision 3, US-029 plan D1 default): same measure, same unit, identical
 * catalogue labels. Every other figure has no BRD equivalent and gets its own key.
 */
export const INTERCAPITAL_FIELD_KEYS = [
  "nav_per_unit",
  "units_in_circulation",
  "total_nav_class_b",
  "nav_per_unit_class_a",
  "units_class_a",
  "total_nav_class_a",
  "units_total",
  "total_nav",
] as const;

const HEADER_LABELS = {
  navPerUnit: "NAV per Unit VUAN",
  numberOfUnits: "Number of Units",
  totalNav: "Total NAV (EUR) VAN total (EUR)",
} as const;

const CLASS_A_LABEL = "Class A Clasa A";
const CLASS_B_LABEL = "Class B Clasa B";
const DATA_LABEL_RE = /(?<![\p{L}])Data:/gu;

type Row = {
  navPerUnit: { numericValue: string; rawValue: string };
  units: { numericValue: string; rawValue: string };
  totalNav: { numericValue: string; rawValue: string };
};

function findReportDate(text: string): { reportDate: string } | { error: string } {
  return findUniqueReportDate(text, DATA_LABEL_RE, {
    occurrence: '"Data:"',
    missing: 'report date not found ("Data:" label missing)',
  });
}

/** The header columns, found strictly in order. `null` means the column order is unknown. */
function findHeaderEnd(text: string): number | null {
  const navPerUnit = findLabel(text, HEADER_LABELS.navPerUnit);
  if (!navPerUnit) return null;
  const numberOfUnits = findLabel(text, HEADER_LABELS.numberOfUnits, navPerUnit.end);
  if (!numberOfUnits) return null;
  const totalNav = findLabel(text, HEADER_LABELS.totalNav, numberOfUnits.end);
  if (!totalNav) return null;
  return totalNav.end;
}

/**
 * A class row is `label currency navPerUnit units totalNav`, accepted only if the currency
 * matches, all three numbers parse, and there is no extra number right after (the row boundary).
 * Never shifted, never partial: a rejected row yields no fields at all.
 */
function extractClassRow(text: string, label: string, expectedCurrency: string, from: number): Row | null {
  const labelSpan = findLabel(text, label, from);
  if (!labelSpan) return null;
  const tokens = tokensAfter(text, labelSpan.end, 5);
  if (tokens.length < 4) return null;
  const [t1, t2, t3, t4, t5] = tokens;
  if (t1.token !== expectedCurrency) return null;
  const navPerUnit = parseReportNumber(t2.token);
  const units = parseReportNumber(t3.token);
  const totalNav = parseReportNumber(t4.token);
  if (!navPerUnit || !units || !totalNav) return null;
  if (t5 && parseReportNumber(t5.token)) return null;
  return { navPerUnit, units, totalNav };
}

/** The whole-word, case-sensitive `TOTAL`, then `units totalNav`, with the same boundary rule. */
function extractTotalRow(text: string, from: number): { units: { numericValue: string; rawValue: string }; totalNav: { numericValue: string; rawValue: string } } | null {
  const re = /\bTOTAL\b/g;
  re.lastIndex = from;
  const match = re.exec(text);
  if (!match) return null;
  const labelEnd = match.index + match[0].length;
  const tokens = tokensAfter(text, labelEnd, 3);
  if (tokens.length < 2) return null;
  const [t1, t2, t3] = tokens;
  const units = parseReportNumber(t1.token);
  const totalNav = parseReportNumber(t2.token);
  if (!units || !totalNav) return null;
  if (t3 && parseReportNumber(t3.token)) return null;
  return { units, totalNav };
}

function extract(text: string): ExtractionResult {
  const dateResult = findReportDate(text);
  if ("error" in dateResult) {
    return { ok: false, error: dateResult.error };
  }

  const results = new Map<string, { numericValue: string; rawValue: string }>();
  const headerEnd = findHeaderEnd(text);

  if (headerEnd !== null) {
    const classA = extractClassRow(text, CLASS_A_LABEL, "EUR", headerEnd);
    if (classA) {
      results.set("nav_per_unit_class_a", classA.navPerUnit);
      results.set("units_class_a", classA.units);
      results.set("total_nav_class_a", classA.totalNav);
    }

    const classB = extractClassRow(text, CLASS_B_LABEL, "RON", headerEnd);
    if (classB) {
      results.set("nav_per_unit", classB.navPerUnit);
      results.set("units_in_circulation", classB.units);
      results.set("total_nav_class_b", classB.totalNav);
    }

    const total = extractTotalRow(text, headerEnd);
    if (total) {
      results.set("units_total", total.units);
      results.set("total_nav", total.totalNav);
    }
  }

  return toExtractionResult(dateResult.reportDate, INTERCAPITAL_FIELD_KEYS, results);
}

/** Structure-based: the three header columns found in order (US-029 FINDINGS §7). */
function canHandle(text: string): boolean {
  return findHeaderEnd(text) !== null;
}

export const intercapitalNavAdapter: ExtractionAdapter = {
  key: INTERCAPITAL_NAV_KEY,
  fieldKeys: INTERCAPITAL_FIELD_KEYS,
  canHandle,
  extract,
};
