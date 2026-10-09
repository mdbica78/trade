import { describe, expect, expectTypeOf, it } from "vitest";
import type { ExtractedValue, ExtractionAdapter, ExtractionResult } from "./types";

describe("contract (AC1)", () => {
  it("a fake adapter satisfies ExtractionAdapter", () => {
    const fake = {
      key: "fake-a",
      fieldKeys: ["a", "b"] as const,
      canHandle: (text: string) => text.includes("A"),
      extract: (_text: string): ExtractionResult => ({
        ok: true,
        reportDate: "2026-09-21",
        values: [{ fieldKey: "a", numericValue: "1", rawValue: "1" }],
        missingFields: ["b"],
      }),
    } satisfies ExtractionAdapter;
    expect(fake.key).toBe("fake-a");
  });

  it("ok:true requires reportDate", () => {
    // @ts-expect-error reportDate is required on the ok:true branch
    const result: ExtractionResult = { ok: true, values: [], missingFields: [] };
    expect(result.ok).toBe(true);
  });

  it("ok:true requires missingFields", () => {
    // @ts-expect-error missingFields is required on the ok:true branch
    const result: ExtractionResult = { ok: true, reportDate: "2026-09-21", values: [] };
    expect(result.ok).toBe(true);
  });

  it("ok:false requires error", () => {
    // @ts-expect-error error is required on the ok:false branch
    const result: ExtractionResult = { ok: false };
    expect(result.ok).toBe(false);
  });

  it("ExtractedValue requires rawValue", () => {
    // @ts-expect-error rawValue is required
    const value: ExtractedValue = { fieldKey: "a", numericValue: "1" };
    expect(value.fieldKey).toBe("a");
  });

  it("fieldKeys is readonly string[]", () => {
    expectTypeOf<ExtractionAdapter["fieldKeys"]>().toEqualTypeOf<readonly string[]>();
  });

  it("extract takes text only", () => {
    expectTypeOf<Parameters<ExtractionAdapter["extract"]>>().toEqualTypeOf<[string]>();
  });

  it("narrowing on ok gives access to values/missingFields or error", () => {
    const okResult: ExtractionResult = {
      ok: true,
      reportDate: "2026-09-21",
      values: [],
      missingFields: [],
    };
    if (okResult.ok) {
      expect(okResult.values).toEqual([]);
      expect(okResult.missingFields).toEqual([]);
    }

    const errResult: ExtractionResult = { ok: false, error: "unusable" };
    if (!errResult.ok) {
      expect(errResult.error).toBe("unusable");
    }
  });
});
