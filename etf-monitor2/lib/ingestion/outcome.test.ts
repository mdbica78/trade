import { describe, expect, expectTypeOf, it } from "vitest";
import type { ContractViolation } from "../extraction/adapters/validate";
import {
  errorText,
  formatFetchError,
  formatMissingFields,
  formatViolations,
  INGEST_OUTCOME_CODES,
  oneLine,
  type IngestOutcome,
  type IngestOutcomeCode,
} from "./outcome";

describe("OC: outcome vocabulary and message builders", () => {
  it("OC-8a: the code list is exactly the seven story codes, and IngestOutcome['code'] matches it", () => {
    expect(INGEST_OUTCOME_CODES).toEqual([
      "ok",
      "already_ingested",
      "missing",
      "fetch_error",
      "no_adapter",
      "parse_error",
      "persist_error",
    ]);
    expectTypeOf<IngestOutcome["code"]>().toEqualTypeOf<IngestOutcomeCode>();
  });

  describe("oneLine", () => {
    it("collapses whitespace runs including newlines to one space and trims", () => {
      expect(oneLine("a\nb   c\t\td")).toBe("a b c d");
      expect(oneLine("  spaced  ")).toBe("spaced");
    });

    it("never returns an empty string", () => {
      expect(oneLine("")).toBe("(no message)");
      expect(oneLine("   \n\t  ")).toBe("(no message)");
    });
  });

  describe("formatMissingFields", () => {
    it("joins keys in the given order", () => {
      expect(formatMissingFields(["nav_per_unit"])).toBe("missing fields: nav_per_unit");
      expect(formatMissingFields(["nav_per_unit", "not_a_real_field"])).toBe(
        "missing fields: nav_per_unit, not_a_real_field",
      );
    });
  });

  describe("formatViolations", () => {
    it("uses rule and fieldKey only, never message, and omits the field when absent", () => {
      const violations: ContractViolation[] = [
        { rule: "uncovered_field", fieldKey: "nav_per_unit", message: `"nav_per_unit" quotes 1,234.5 which must never leak` },
        { rule: "invalid_numeric_value", fieldKey: "net_asset", message: "numericValue 1,234.5 is not canonical" },
      ];
      const text = formatViolations(violations);
      expect(text).toBe("contract violations: uncovered_field(nav_per_unit); invalid_numeric_value(net_asset)");
      expect(text).not.toContain("1,234.5");
      expect(text).not.toContain("quotes");
    });

    it("omits the parenthesized field when a violation has none (e.g. invalid_report_date)", () => {
      const violations: ContractViolation[] = [{ rule: "invalid_report_date", message: `reportDate "2026-02-30" is invalid` }];
      expect(formatViolations(violations)).toBe("contract violations: invalid_report_date");
    });
  });

  describe("formatFetchError", () => {
    it("includes the http status when present", () => {
      expect(formatFetchError("discovery", "http_error", 503, "server error")).toBe("discovery http_error 503: server error");
    });

    it("omits the status when absent", () => {
      expect(formatFetchError("download", "network", undefined, "fetch failed")).toBe("download network: fetch failed");
    });
  });

  describe("errorText", () => {
    it("returns the message for an Error", () => {
      expect(errorText(new Error("boom"))).toBe("boom");
    });

    it("stringifies a non-Error value", () => {
      expect(errorText("plain")).toBe("plain");
      expect(errorText(42)).toBe("42");
    });

    it("never throws, even for a value whose String() conversion throws", () => {
      const hostile = {
        toString() {
          throw new Error("cannot stringify");
        },
      };
      expect(errorText(hostile)).toBe("(unprintable error)");
    });
  });
});
