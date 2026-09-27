import { describe, expect, it } from "vitest";
import { seedFieldCatalog } from "../../db/seed-data";
import { brdDepositaryAdapter } from "./brd-depositary";
import { defaultAdapterRegistry } from "./default-registry";
import { intercapitalNavAdapter } from "./intercapital-nav";
import type { ExtractionResult } from "./types";
import { validateExtractionResult } from "./validate";

type SegmentKey =
  | "intro"
  | "dateEn"
  | "dataLabel"
  | "ticker"
  | "headerUnitClass"
  | "headerNavPerUnit"
  | "headerNumberOfUnits"
  | "headerTotalNav"
  | "classALabel"
  | "classACurrency"
  | "classANav"
  | "classAUnits"
  | "classATotal"
  | "classAExtra"
  | "classBLabel"
  | "classBCurrency"
  | "classBNav"
  | "classBUnits"
  | "classBTotal"
  | "totalLabel"
  | "totalUnits"
  | "totalNav"
  | "trailer"
  | "croatian";

const DEFAULT_SEGMENTS: Record<SegmentKey, string | null> = {
  intro: "Official Net Asset Value for InterCapital BET-TRN UCITS ETF",
  dateEn: "Date: 24. September 2026",
  dataLabel: "Data: 24.09.2026",
  ticker: "Class B units of the ETF are traded on the Bucharest Stock Exchange under the ticker ICBETNETF.",
  headerUnitClass: "Unit Class Clasa de unități Unit Currency Moneda unitară",
  headerNavPerUnit: "NAV per Unit VUAN",
  headerNumberOfUnits: "Number of Units Număr de Unități",
  headerTotalNav: "Total NAV (EUR) VAN total (EUR)",
  classALabel: "Class A Clasa A",
  classACurrency: "EUR",
  classANav: "26.9315",
  classAUnits: "1,196,346",
  classATotal: "32,219,356.78",
  classAExtra: null,
  classBLabel: "Class B Clasa B",
  classBCurrency: "RON",
  classBNav: "142.1413",
  classBUnits: "514,169",
  classBTotal: "13,847,299.12",
  totalLabel: "TOTAL",
  totalUnits: "1,710,515",
  totalNav: "46,066,655.90",
  trailer: "The official confirmation by the custodian bank (OTP Croatia) can be found on the next page (in Croatian).",
  croatian: "Klasa A 24.09.2026 32.219.356,78 26,9315 Datum Vrijednost Ispisano na dan : 25.09.2026",
};

const SEGMENT_ORDER: SegmentKey[] = [
  "intro",
  "dateEn",
  "dataLabel",
  "ticker",
  "headerUnitClass",
  "headerNavPerUnit",
  "headerNumberOfUnits",
  "headerTotalNav",
  "classALabel",
  "classACurrency",
  "classANav",
  "classAUnits",
  "classATotal",
  "classAExtra",
  "classBLabel",
  "classBCurrency",
  "classBNav",
  "classBUnits",
  "classBTotal",
  "totalLabel",
  "totalUnits",
  "totalNav",
  "trailer",
  "croatian",
];

function buildIcbetnetfText(overrides: Partial<Record<SegmentKey, string | null>> = {}): string {
  const parts: string[] = [];
  for (const key of SEGMENT_ORDER) {
    const override = overrides[key];
    const value = override === undefined ? DEFAULT_SEGMENTS[key] : override;
    if (value !== null) {
      parts.push(value);
    }
  }
  return parts.join(" ");
}

function run(text: string): ExtractionResult {
  const result = intercapitalNavAdapter.extract(text);
  expect(validateExtractionResult(intercapitalNavAdapter, result)).toEqual([]);
  return result;
}

function valueOf(result: ExtractionResult, key: string): { numericValue: string; rawValue: string } | undefined {
  if (!result.ok) throw new Error("expected an ok:true result");
  const found = result.values.find((v) => v.fieldKey === key);
  return found ? { numericValue: found.numericValue, rawValue: found.rawValue } : undefined;
}

function isMissing(result: ExtractionResult, key: string): boolean {
  if (!result.ok) throw new Error("expected an ok:true result");
  expect(result.values.some((v) => v.fieldKey === key)).toBe(false);
  return result.missingFields.includes(key);
}

const DEFAULT_TEXT = buildIcbetnetfText();
const DEFAULT_RESULT = run(DEFAULT_TEXT);

const EXPECTED_VALUES: Record<string, { numericValue: string; rawValue: string }> = {
  nav_per_unit: { numericValue: "142.1413", rawValue: "142.1413" },
  units_in_circulation: { numericValue: "514169", rawValue: "514,169" },
  total_nav_class_b: { numericValue: "13847299.12", rawValue: "13,847,299.12" },
  nav_per_unit_class_a: { numericValue: "26.9315", rawValue: "26.9315" },
  units_class_a: { numericValue: "1196346", rawValue: "1,196,346" },
  total_nav_class_a: { numericValue: "32219356.78", rawValue: "32,219,356.78" },
  units_total: { numericValue: "1710515", rawValue: "1,710,515" },
  total_nav: { numericValue: "46066655.90", rawValue: "46,066,655.90" },
};

describe("identity", () => {
  it("key is intercapital-nav", () => {
    expect(intercapitalNavAdapter.key).toBe("intercapital-nav");
  });

  it("fieldKeys equal exactly the seeded catalogue's intercapital-nav field keys", () => {
    const expected = seedFieldCatalog.filter((f) => f.adapterKey === "intercapital-nav").map((f) => f.fieldKey);
    expect([...intercapitalNavAdapter.fieldKeys].sort()).toEqual([...expected].sort());
    expect(intercapitalNavAdapter.fieldKeys.length).toBe(expected.length);
    expect(new Set(intercapitalNavAdapter.fieldKeys).size).toBe(intercapitalNavAdapter.fieldKeys.length);
  });
});

describe("registration", () => {
  it("the default registry returns this adapter by identity", () => {
    expect(defaultAdapterRegistry.get("intercapital-nav")).toBe(intercapitalNavAdapter);
  });

  it("detect resolves the default text to this adapter", () => {
    expect(defaultAdapterRegistry.detect(DEFAULT_TEXT)).toBe(intercapitalNavAdapter);
  });
});

describe("report date", () => {
  it("default text: reportDate is 2026-09-24 from the Data: line, not the English Date: line", () => {
    expect(DEFAULT_RESULT).toMatchObject({ ok: true, reportDate: "2026-09-24" });
  });

  it("no Data: label gives ok:false with a non-empty error", () => {
    const result = intercapitalNavAdapter.extract(buildIcbetnetfText({ dataLabel: null }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
  });

  it("the English Date: line alone (no Data: line) gives ok:false", () => {
    const result = intercapitalNavAdapter.extract(buildIcbetnetfText({ dataLabel: null, dateEn: "Date: 24. September 2026" }));
    expect(result.ok).toBe(false);
  });

  it("an impossible date (31.09.2026) gives ok:false", () => {
    const result = intercapitalNavAdapter.extract(buildIcbetnetfText({ dataLabel: "Data: 31.09.2026" }));
    expect(result.ok).toBe(false);
  });

  it("the same date twice gives ok:true", () => {
    const text = `${DEFAULT_TEXT} Data: 24.09.2026`;
    const result = intercapitalNavAdapter.extract(text);
    expect(result).toMatchObject({ ok: true, reportDate: "2026-09-24" });
  });

  it("two conflicting Data: dates give ok:false", () => {
    const text = `${DEFAULT_TEXT} Data: 23.09.2026`;
    expect(intercapitalNavAdapter.extract(text).ok).toBe(false);
  });

  it("the Croatian page-2 dates are never used (default text already embeds them, and still resolves to 2026-09-24)", () => {
    expect(DEFAULT_TEXT.includes("25.09.2026")).toBe(true);
    expect(DEFAULT_RESULT).toMatchObject({ ok: true, reportDate: "2026-09-24" });
  });
});

describe("rows (default)", () => {
  it("extracts all 8 values with no missing field", () => {
    if (!DEFAULT_RESULT.ok) throw new Error("expected ok:true");
    expect(DEFAULT_RESULT.missingFields).toEqual([]);
    for (const [key, expected] of Object.entries(EXPECTED_VALUES)) {
      expect(valueOf(DEFAULT_RESULT, key)).toEqual(expected);
    }
  });
});

describe("rows (label-based, order-independent)", () => {
  it("swapping Class A and Class B rows still gives the same values", () => {
    const classARow = "Class A Clasa A EUR 26.9315 1,196,346 32,219,356.78";
    const classBRow = "Class B Clasa B RON 142.1413 514,169 13,847,299.12";
    const swapped = DEFAULT_TEXT.replace(`${classARow} ${classBRow}`, `${classBRow} ${classARow}`);
    expect(swapped).not.toBe(DEFAULT_TEXT);
    const result = run(swapped);
    for (const [key, expected] of Object.entries(EXPECTED_VALUES)) {
      expect(valueOf(result, key)).toEqual(expected);
    }
  });
});

describe("rows (rejected tokens)", () => {
  it("a wrong currency token (USD in class A) makes class A's 3 fields missing, others intact", () => {
    const result = run(buildIcbetnetfText({ classACurrency: "USD" }));
    if (!result.ok) throw new Error("expected ok:true");
    expect([...result.missingFields].sort()).toEqual(
      ["nav_per_unit_class_a", "total_nav_class_a", "units_class_a"].sort(),
    );
    for (const key of ["nav_per_unit", "units_in_circulation", "total_nav_class_b", "units_total", "total_nav"]) {
      expect(valueOf(result, key)).toEqual(EXPECTED_VALUES[key]);
    }
  });

  it("a row missing one number (non-numeric token) makes that row's fields missing, leaves the others intact", () => {
    const result = run(buildIcbetnetfText({ classAUnits: "N/A" }));
    if (!result.ok) throw new Error("expected ok:true");
    expect([...result.missingFields].sort()).toEqual(
      ["nav_per_unit_class_a", "total_nav_class_a", "units_class_a"].sort(),
    );
    for (const key of ["nav_per_unit", "units_in_circulation", "total_nav_class_b", "units_total", "total_nav"]) {
      expect(valueOf(result, key)).toEqual(EXPECTED_VALUES[key]);
    }
  });

  it("a row with one extra number right after it makes that row's fields missing (boundary violation), leaves the others intact", () => {
    const result = run(buildIcbetnetfText({ classAExtra: "999" }));
    if (!result.ok) throw new Error("expected ok:true");
    expect([...result.missingFields].sort()).toEqual(
      ["nav_per_unit_class_a", "total_nav_class_a", "units_class_a"].sort(),
    );
    for (const key of ["nav_per_unit", "units_in_circulation", "total_nav_class_b", "units_total", "total_nav"]) {
      expect(valueOf(result, key)).toEqual(EXPECTED_VALUES[key]);
    }
  });

  it("a European-format token (26,9315) makes that row's fields missing, leaves the others intact", () => {
    const result = run(buildIcbetnetfText({ classANav: "26,9315" }));
    if (!result.ok) throw new Error("expected ok:true");
    expect([...result.missingFields].sort()).toEqual(
      ["nav_per_unit_class_a", "total_nav_class_a", "units_class_a"].sort(),
    );
    for (const key of ["nav_per_unit", "units_in_circulation", "total_nav_class_b", "units_total", "total_nav"]) {
      expect(valueOf(result, key)).toEqual(EXPECTED_VALUES[key]);
    }
  });
});

describe("rows (missing labels)", () => {
  it("a missing class label makes only that row missing", () => {
    const result = run(buildIcbetnetfText({ classALabel: null }));
    if (!result.ok) throw new Error("expected ok:true");
    expect([...result.missingFields].sort()).toEqual(
      ["nav_per_unit_class_a", "total_nav_class_a", "units_class_a"].sort(),
    );
    for (const key of ["nav_per_unit", "units_in_circulation", "total_nav_class_b", "units_total", "total_nav"]) {
      expect(valueOf(result, key)).toEqual(EXPECTED_VALUES[key]);
    }
  });

  it("a missing TOTAL label makes only the two total fields missing", () => {
    const result = run(buildIcbetnetfText({ totalLabel: null, totalUnits: null, totalNav: null }));
    if (!result.ok) throw new Error("expected ok:true");
    expect(isMissing(result, "units_total")).toBe(true);
    expect(isMissing(result, "total_nav")).toBe(true);
    for (const key of [
      "nav_per_unit",
      "units_in_circulation",
      "total_nav_class_b",
      "nav_per_unit_class_a",
      "units_class_a",
      "total_nav_class_a",
    ]) {
      expect(valueOf(result, key)).toEqual(EXPECTED_VALUES[key]);
    }
  });
});

describe("header (structure)", () => {
  it("reordered header columns make every class-row and total field missing", () => {
    const reordered = buildIcbetnetfText().replace(
      "NAV per Unit VUAN Number of Units",
      "Number of Units NAV per Unit VUAN",
    );
    const result = run(reordered);
    if (!result.ok) throw new Error("expected ok:true");
    expect([...result.missingFields].sort()).toEqual([...intercapitalNavAdapter.fieldKeys].sort());
  });

  it.each(["headerNavPerUnit", "headerNumberOfUnits", "headerTotalNav"] as const)(
    "a missing header column (%s) makes every class-row and total field missing",
    (key) => {
      const result = run(buildIcbetnetfText({ [key]: null }));
      if (!result.ok) throw new Error("expected ok:true");
      expect([...result.missingFields].sort()).toEqual([...intercapitalNavAdapter.fieldKeys].sort());
    },
  );
});

describe("canHandle", () => {
  it("true for the default text", () => {
    expect(intercapitalNavAdapter.canHandle(DEFAULT_TEXT)).toBe(true);
  });

  it("true with whitespace runs and newlines inside the header labels", () => {
    const text = buildIcbetnetfText({
      headerNavPerUnit: "NAV  per\nUnit VUAN",
      headerTotalNav: "Total  NAV\n(EUR) VAN total (EUR)",
    });
    expect(intercapitalNavAdapter.canHandle(text)).toBe(true);
  });

  it("false for empty text", () => {
    expect(intercapitalNavAdapter.canHandle("")).toBe(false);
  });

  it("false for unrelated text", () => {
    expect(intercapitalNavAdapter.canHandle("lorem ipsum dolor sit amet")).toBe(false);
  });

  it("false for BRD-shaped text", () => {
    const brdText =
      "16426/22.09.2026 ACTIV NET (in valuta fond - RON) 415,591,664.27 NUMAR U.F. in circulatie, din care detinute de: 37,470,000 VALOARE UNITARA A ACTIVULUI NET (VUAN) (RON) Raport depozitar la data de 21.09.2026 in valuta RON";
    expect(intercapitalNavAdapter.canHandle(brdText)).toBe(false);
  });

  it.each(["headerNavPerUnit", "headerNumberOfUnits", "headerTotalNav"] as const)(
    "false when a header column (%s) is missing",
    (key) => {
      expect(intercapitalNavAdapter.canHandle(buildIcbetnetfText({ [key]: null }))).toBe(false);
    },
  );

  it("brdDepositaryAdapter.canHandle is false on the ICBETNETF-shaped text", () => {
    expect(brdDepositaryAdapter.canHandle(DEFAULT_TEXT)).toBe(false);
  });
});

describe("purity", () => {
  it("A-B-A: extract does not leak state between calls", () => {
    const textA = DEFAULT_TEXT;
    const textB = buildIcbetnetfText({ dataLabel: null });
    const resultA1 = intercapitalNavAdapter.extract(textA);
    intercapitalNavAdapter.extract(textB);
    const resultA2 = intercapitalNavAdapter.extract(textA);
    expect(resultA2).toEqual(resultA1);
  });
});
