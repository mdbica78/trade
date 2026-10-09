import { describe, expect, it } from "vitest";
import { formatNumber } from "./number";

describe("formatNumber", () => {
  it("ro uses a comma decimal mark", () => {
    expect(formatNumber("415591664.27", "ro")).toBe("415591664,27");
  });

  it("en keeps the dot decimal mark", () => {
    expect(formatNumber("415591664.27", "en")).toBe("415591664.27");
  });

  it("an integer with no decimal point is unchanged in both locales", () => {
    expect(formatNumber("37470000", "ro")).toBe("37470000");
    expect(formatNumber("37470000", "en")).toBe("37470000");
  });

  it("keeps trailing zeros exactly as stored", () => {
    expect(formatNumber("8640000.00", "ro")).toBe("8640000,00");
  });

  it("keeps a variable number of decimal places (VUAN-style values)", () => {
    expect(formatNumber("54.1373", "ro")).toBe("54,1373");
    expect(formatNumber("54.1373", "en")).toBe("54.1373");
  });

  it("keeps a negative sign", () => {
    expect(formatNumber("-0.006", "ro")).toBe("-0,006");
  });

  it.each(["ro", "en"] as const)(
    "never contains a grouping character even on a value long enough to trigger Intl grouping (%s)",
    (locale) => {
      const result = formatNumber("1234567890.12", locale);
      const groupingChars = [" ", "\u00a0", "'"];
      for (const char of groupingChars) {
        expect(result).not.toContain(char);
      }
      // exactly one decimal mark, no thousands separator of the *other* locale's kind
      const decimalMark = locale === "ro" ? "," : ".";
      const otherMark = locale === "ro" ? "." : ",";
      expect(result.split(decimalMark)).toHaveLength(2);
      expect(result).not.toContain(otherMark);
    },
  );
});
