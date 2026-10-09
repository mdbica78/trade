import { describe, expect, it } from "vitest";
import { isIsoCalendarDate, validateExtractionResult } from "./validate";
import type { ExtractionResult } from "./types";

const adapter = { fieldKeys: ["a", "b", "c"] as const };

function okResult(overrides: Partial<Extract<ExtractionResult, { ok: true }>> = {}): ExtractionResult {
  return {
    ok: true,
    reportDate: "2026-09-21",
    values: [
      { fieldKey: "a", numericValue: "1", rawValue: "1" },
      { fieldKey: "b", numericValue: "2.5", rawValue: "2.5" },
    ],
    missingFields: ["c"],
    ...overrides,
  };
}

describe("isIsoCalendarDate", () => {
  it.each(["2026-09-21", "2028-02-29", "2000-02-29"])("valid: %s", (date) => {
    expect(isIsoCalendarDate(date)).toBe(true);
  });

  it.each([
    "2026-02-29",
    "2100-02-29",
    "2026-09-31",
    "2026-13-01",
    "2026-00-10",
    "2026-09-00",
    "0000-01-01",
    "21.09.2026",
    "2026-9-21",
    "2026-09-21T00:00:00Z",
    " 2026-09-21",
    "",
  ])("invalid: %s", (date) => {
    expect(isIsoCalendarDate(date)).toBe(false);
  });
});

describe("validateExtractionResult (AC5)", () => {
  it("valid: all fields present, some in values some missing", () => {
    expect(validateExtractionResult(adapter, okResult())).toEqual([]);
  });

  it("valid: all fields present in values", () => {
    expect(
      validateExtractionResult(
        adapter,
        okResult({
          values: [
            { fieldKey: "a", numericValue: "1", rawValue: "1" },
            { fieldKey: "b", numericValue: "2", rawValue: "2" },
            { fieldKey: "c", numericValue: "3", rawValue: "3" },
          ],
          missingFields: [],
        }),
      ),
    ).toEqual([]);
  });

  it("valid: all fields missing", () => {
    expect(validateExtractionResult(adapter, okResult({ values: [], missingFields: ["a", "b", "c"] }))).toEqual([]);
  });

  it("valid: ok:false with a non-empty error", () => {
    expect(validateExtractionResult(adapter, { ok: false, error: "no report date found" })).toEqual([]);
  });

  it("unknown_field: an unknown key in values", () => {
    const result = okResult({
      values: [
        { fieldKey: "a", numericValue: "1", rawValue: "1" },
        { fieldKey: "b", numericValue: "2", rawValue: "2" },
        { fieldKey: "zzz", numericValue: "3", rawValue: "3" },
      ],
      missingFields: ["c"],
    });
    const violations = validateExtractionResult(adapter, result);
    expect(violations.map((v) => v.rule)).toEqual(["unknown_field"]);
    expect(violations[0].fieldKey).toBe("zzz");
  });

  it("unknown_field: an unknown key in missingFields", () => {
    const result = okResult({ missingFields: ["c", "zzz"] });
    const violations = validateExtractionResult(adapter, result);
    expect(violations.map((v) => v.rule)).toEqual(["unknown_field"]);
    expect(violations[0].fieldKey).toBe("zzz");
  });

  it("duplicate_field: same key twice in values", () => {
    const result = okResult({
      values: [
        { fieldKey: "a", numericValue: "1", rawValue: "1" },
        { fieldKey: "a", numericValue: "1", rawValue: "1" },
        { fieldKey: "b", numericValue: "2", rawValue: "2" },
      ],
      missingFields: ["c"],
    });
    const violations = validateExtractionResult(adapter, result);
    expect(violations.map((v) => v.rule)).toEqual(["duplicate_field"]);
    expect(violations[0].fieldKey).toBe("a");
  });

  it("duplicate_field: same key twice in missingFields", () => {
    const result = okResult({
      values: [{ fieldKey: "a", numericValue: "1", rawValue: "1" }],
      missingFields: ["b", "b", "c"],
    });
    const violations = validateExtractionResult(adapter, result);
    expect(violations.map((v) => v.rule)).toEqual(["duplicate_field"]);
    expect(violations[0].fieldKey).toBe("b");
  });

  it("duplicate_field: once in values and once in missingFields", () => {
    const result = okResult({
      values: [
        { fieldKey: "a", numericValue: "1", rawValue: "1" },
        { fieldKey: "b", numericValue: "2", rawValue: "2" },
      ],
      missingFields: ["b", "c"],
    });
    const violations = validateExtractionResult(adapter, result);
    expect(violations.map((v) => v.rule)).toEqual(["duplicate_field"]);
    expect(violations[0].fieldKey).toBe("b");
  });

  it("uncovered_field: a fieldKeys entry in neither list", () => {
    const result = okResult({
      values: [{ fieldKey: "a", numericValue: "1", rawValue: "1" }],
      missingFields: [],
    });
    const violations = validateExtractionResult(adapter, result);
    expect(violations.map((v) => v.rule)).toEqual(["uncovered_field", "uncovered_field"]);
    expect(violations.map((v) => v.fieldKey).sort()).toEqual(["b", "c"]);
  });

  it("invalid_report_date", () => {
    const result = okResult({ reportDate: "2026-02-30" });
    const violations = validateExtractionResult(adapter, result);
    expect(violations.map((v) => v.rule)).toEqual(["invalid_report_date"]);
  });

  it.each(["37,470,000", "1.234,56", "1 234", "+5", ".5", "5.", "1e5", "NaN", "--5", " 5", "5 ", "", "١٢"])(
    "invalid_numeric_value: %s",
    (numericValue) => {
      const result = okResult({
        values: [{ fieldKey: "a", numericValue, rawValue: "x" }],
        missingFields: ["b", "c"],
      });
      const violations = validateExtractionResult(adapter, result);
      expect(violations.map((v) => v.rule)).toEqual(["invalid_numeric_value"]);
      expect(violations[0].fieldKey).toBe("a");
    },
  );

  it.each(["0", "77", "37470000", "8640000.00", "11.091", "-12.5"])("valid numericValue: %s", (numericValue) => {
    const result = okResult({
      values: [{ fieldKey: "a", numericValue, rawValue: "x" }],
      missingFields: ["b", "c"],
    });
    expect(validateExtractionResult(adapter, result)).toEqual([]);
  });

  it("empty_raw_value", () => {
    const result = okResult({
      values: [{ fieldKey: "a", numericValue: "1", rawValue: "   " }],
      missingFields: ["b", "c"],
    });
    const violations = validateExtractionResult(adapter, result);
    expect(violations.map((v) => v.rule)).toEqual(["empty_raw_value"]);
    expect(violations[0].fieldKey).toBe("a");
  });

  it("empty_error", () => {
    const violations = validateExtractionResult(adapter, { ok: false, error: "   " });
    expect(violations.map((v) => v.rule)).toEqual(["empty_error"]);
  });

  it("does not mutate its inputs", () => {
    const result = okResult();
    if (!result.ok) throw new Error("expected an ok:true result");
    const valuesCopy = [...result.values];
    const missingCopy = [...result.missingFields];
    validateExtractionResult(adapter, result);
    expect(result.values).toEqual(valuesCopy);
    expect(result.missingFields).toEqual(missingCopy);
  });
});
