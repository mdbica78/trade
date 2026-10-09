import { describe, expect, it } from "vitest";
import { CANONICAL_NUMERIC_PATTERN } from "./validate";
import { parseReportNumber } from "./numbers";

describe("parseReportNumber (AC6)", () => {
  it.each([
    ["37,470,000", "37470000"],
    ["8,640,000.00", "8640000.00"],
    ["415,591,664.27", "415591664.27"],
    ["1,517,663,423.87", "1517663423.87"],
    ["11.091", "11.091"],
    ["54.1373", "54.1373"],
    ["77", "77"],
  ])("accepts %s -> %s", (token, expectedNumericValue) => {
    const result = parseReportNumber(token);
    expect(result).toEqual({ numericValue: expectedNumericValue, rawValue: token });
    expect(result?.numericValue).toMatch(CANONICAL_NUMERIC_PATTERN);
  });

  it.each([
    "1.234,56",
    "12,34",
    "1,2345",
    "abc",
    "",
    " 77",
    "77 ",
    "-5",
    "+5",
    ".5",
    "5.",
    "1,234.",
    "1234,567",
    ",123",
    "1,,234",
    "1e5",
    "١٢",
    "37,470,000RON",
  ])("rejects %s", (token) => {
    expect(parseReportNumber(token)).toBeNull();
  });
});
