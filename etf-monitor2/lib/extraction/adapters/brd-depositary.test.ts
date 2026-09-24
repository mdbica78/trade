import { describe, expect, it } from "vitest";
import { seedEtfs, seedFieldCatalog } from "../../db/seed-data";
import { brdDepositaryAdapter } from "./brd-depositary";
import { defaultAdapterRegistry } from "./default-registry";
import type { ExtractionResult } from "./types";
import { validateExtractionResult } from "./validate";

type SegmentKey =
  | "stamp"
  | "header"
  | "navClassLabel"
  | "navClassValue"
  | "navFundLabel"
  | "navFundValue"
  | "unitsLabel"
  | "unitsValue"
  | "unitsIndLabel"
  | "unitsIndValue"
  | "unitsLegLabel"
  | "unitsLegValue"
  | "vuanValue"
  | "invLabel"
  | "invValue"
  | "invIndLabel"
  | "invIndValue"
  | "invLegLabel"
  | "invLegValue"
  | "footer"
  | "vuanLabel"
  | "signature";

const DEFAULT_SEGMENTS: Record<SegmentKey, string> = {
  stamp: "16426/22.09.2026",
  header: "BT Index Romania ETF BET-TR Decizie autorizare: 255/06.08.2008",
  navClassLabel: "ACTIV NET (in valuta clasa UF - RON)",
  navClassValue: "415,591,664.27",
  navFundLabel: "ACTIV NET (in valuta fond - RON)",
  navFundValue: "415,591,664.27",
  unitsLabel: "NUMAR U.F. in circulatie, din care detinute de:",
  unitsValue: "37,470,000",
  unitsIndLabel: "Persoane fizice",
  unitsIndValue: "29,733,778",
  unitsLegLabel: "Persoane juridice",
  unitsLegValue: "7,736,222",
  vuanValue: "11.091",
  invLabel: "Numar investitori, din care:",
  invValue: "18,708",
  invIndLabel: "Persoane fizice",
  invIndValue: "18,631",
  invLegLabel: "Persoane juridice",
  invLegValue: "77",
  footer: "Raport depozitar la data de 21.09.2026 in valuta RON",
  vuanLabel: "VALOARE UNITARA A ACTIVULUI NET (VUAN) (RON)",
  signature: "FILIMON ANICA Intocmit",
};

const SEGMENT_ORDER: SegmentKey[] = [
  "stamp",
  "header",
  "navClassLabel",
  "navClassValue",
  "navFundLabel",
  "navFundValue",
  "unitsLabel",
  "unitsValue",
  "unitsIndLabel",
  "unitsIndValue",
  "unitsLegLabel",
  "unitsLegValue",
  "vuanValue",
  "invLabel",
  "invValue",
  "invIndLabel",
  "invIndValue",
  "invLegLabel",
  "invLegValue",
  "footer",
  "vuanLabel",
  "signature",
];

function buildBrdText(overrides: Partial<Record<SegmentKey, string | null>> = {}): string {
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
  const result = brdDepositaryAdapter.extract(text);
  expect(validateExtractionResult(brdDepositaryAdapter, result)).toEqual([]);
  return result;
}

function valueOf(result: ExtractionResult, key: string): { numericValue: string; rawValue: string } | undefined {
  if (!result.ok) throw new Error("expected an ok:true result");
  const found = result.values.find((v) => v.fieldKey === key);
  return found ? { numericValue: found.numericValue, rawValue: found.rawValue } : undefined;
}

function isMissing(result: ExtractionResult, key: string): boolean {
  if (!result.ok) throw new Error("expected an ok:true result");
  const inValues = result.values.some((v) => v.fieldKey === key);
  expect(inValues).toBe(false);
  return result.missingFields.includes(key);
}

const DEFAULT_TEXT = buildBrdText();
const DEFAULT_RESULT = run(DEFAULT_TEXT);

describe("identity (AC1)", () => {
  it("key is brd-depositary", () => {
    expect(brdDepositaryAdapter.key).toBe("brd-depositary");
  });

  it("fieldKeys equal exactly the seeded catalogue's brd-depositary field keys", () => {
    const expected = seedFieldCatalog.filter((f) => f.adapterKey === "brd-depositary").map((f) => f.fieldKey);
    expect([...brdDepositaryAdapter.fieldKeys].sort()).toEqual([...expected].sort());
    expect(brdDepositaryAdapter.fieldKeys.length).toBe(expected.length);
    expect(new Set(brdDepositaryAdapter.fieldKeys).size).toBe(brdDepositaryAdapter.fieldKeys.length);
  });
});

describe("registration (AC2)", () => {
  it("the default registry returns this adapter by identity", () => {
    expect(defaultAdapterRegistry.get("brd-depositary")).toBe(brdDepositaryAdapter);
  });

  it.each(seedEtfs)("$symbol's adapterKey resolves to a registered adapter", (etf) => {
    expect(defaultAdapterRegistry.get(etf.adapterKey)).toBeDefined();
  });

  it("detect resolves BRD-format text to this adapter", () => {
    expect(defaultAdapterRegistry.detect(DEFAULT_TEXT)).toBe(brdDepositaryAdapter);
  });
});

describe("report date (AC3)", () => {
  it("default text: reportDate is 2026-09-21 (footer, not the filing stamp)", () => {
    expect(DEFAULT_TEXT.includes("22.09.2026")).toBe(true);
    expect(DEFAULT_RESULT).toMatchObject({ ok: true, reportDate: "2026-09-21" });
  });

  it("no footer phrase gives ok:false with a non-empty error", () => {
    const text = buildBrdText({ footer: null });
    const result = brdDepositaryAdapter.extract(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
  });

  it("footer with an impossible date (31.09.2026) gives ok:false", () => {
    const text = buildBrdText({ footer: "Raport depozitar la data de 31.09.2026 in valuta RON" });
    expect(brdDepositaryAdapter.extract(text).ok).toBe(false);
  });

  it("footer with a non-leap Feb 29 (29.02.2026) gives ok:false", () => {
    const text = buildBrdText({ footer: "Raport depozitar la data de 29.02.2026 in valuta RON" });
    expect(brdDepositaryAdapter.extract(text).ok).toBe(false);
  });

  it("footer phrase followed by a non-date token gives ok:false", () => {
    const text = buildBrdText({ footer: "Raport depozitar la data de XX in valuta RON" });
    expect(brdDepositaryAdapter.extract(text).ok).toBe(false);
  });

  it("whitespace runs or a newline inside the footer phrase still work", () => {
    const text = buildBrdText({ footer: "Raport  depozitar\nla data de 21.09.2026 in valuta RON" });
    const result = brdDepositaryAdapter.extract(text);
    expect(result).toMatchObject({ ok: true, reportDate: "2026-09-21" });
  });

  it("the footer twice with the same date gives ok:true", () => {
    const text = `${DEFAULT_TEXT} Raport depozitar la data de 21.09.2026 in valuta RON`;
    const result = brdDepositaryAdapter.extract(text);
    expect(result).toMatchObject({ ok: true, reportDate: "2026-09-21" });
  });

  it("the footer twice with different dates gives ok:false", () => {
    const text = `${DEFAULT_TEXT} Raport depozitar la data de 20.09.2026 in valuta RON`;
    expect(brdDepositaryAdapter.extract(text).ok).toBe(false);
  });
});

describe("values (AC4)", () => {
  const variantText = buildBrdText({ navClassValue: "415,000,000.00" });
  const variantResult = run(variantText);

  it.each([
    ["net_asset", "415591664.27", "415,591,664.27"],
    ["units_in_circulation", "37470000", "37,470,000"],
    ["units_held_individuals", "29733778", "29,733,778"],
    ["units_held_legal_entities", "7736222", "7,736,222"],
    ["investors_total", "18708", "18,708"],
    ["investors_individuals", "18631", "18,631"],
    ["investors_legal_entities", "77", "77"],
  ])("%s -> numericValue %s, rawValue %s", (fieldKey, numericValue, rawValue) => {
    expect(valueOf(variantResult, fieldKey)).toEqual({ numericValue, rawValue });
  });

  it("nav_per_unit is 11.091", () => {
    expect(valueOf(variantResult, "nav_per_unit")).toEqual({ numericValue: "11.091", rawValue: "11.091" });
  });

  it("missingFields is empty on the full default text", () => {
    if (!DEFAULT_RESULT.ok) throw new Error("expected ok:true");
    expect(DEFAULT_RESULT.missingFields).toEqual([]);
  });

  it("swapping the order of the two ACTIV NET lines still gives the correct net_asset (label-based, not positional)", () => {
    const text = buildBrdText();
    const swapped = text
      .replace("ACTIV NET (in valuta clasa UF - RON) 415,591,664.27", "@@SWAP@@")
      .replace("ACTIV NET (in valuta fond - RON) 415,591,664.27", "ACTIV NET (in valuta clasa UF - RON) 415,591,664.27")
      .replace("@@SWAP@@", "ACTIV NET (in valuta fond - RON) 415,591,664.27");
    const result = run(swapped);
    expect(valueOf(result, "net_asset")).toEqual({ numericValue: "415591664.27", rawValue: "415,591,664.27" });
  });

  it("values come out in fieldKeys order", () => {
    if (!variantResult.ok) throw new Error("expected ok:true");
    expect(variantResult.values.map((v) => v.fieldKey)).toEqual(
      brdDepositaryAdapter.fieldKeys.filter((k) => variantResult.values.some((v) => v.fieldKey === k)),
    );
  });
});

describe("VUAN (AC5)", () => {
  it("default: nav_per_unit is 11.091", () => {
    expect(valueOf(DEFAULT_RESULT, "nav_per_unit")).toEqual({ numericValue: "11.091", rawValue: "11.091" });
  });

  function expectNavMissingOthersUnchanged(text: string) {
    const result = run(text);
    expect(isMissing(result, "nav_per_unit")).toBe(true);
    for (const key of brdDepositaryAdapter.fieldKeys) {
      if (key === "nav_per_unit") continue;
      expect(valueOf(result, key)).toEqual(valueOf(DEFAULT_RESULT, key));
    }
  }

  it("(a) VUAN label absent", () => {
    expect(DEFAULT_TEXT.includes("VALOARE UNITARA")).toBe(true);
    expectNavMissingOthersUnchanged(buildBrdText({ vuanLabel: null }));
  });

  it("(b) gap holds no number", () => {
    expectNavMissingOthersUnchanged(buildBrdText({ vuanValue: null }));
  });

  it("(c) gap holds more than one number", () => {
    expectNavMissingOthersUnchanged(buildBrdText({ vuanValue: "11.091 12.5" }));
  });

  it("gap holds a non-number token", () => {
    expectNavMissingOthersUnchanged(buildBrdText({ vuanValue: "abc" }));
  });

  it("gap holds a rejected number format", () => {
    expectNavMissingOthersUnchanged(buildBrdText({ vuanValue: "11,09" }));
  });

  it("gap holds a number plus an extra token", () => {
    expectNavMissingOthersUnchanged(buildBrdText({ vuanValue: "11.091 RON" }));
  });

  it("VUAN label present but moved before the ACTIV NET block still gives 11.091", () => {
    const text = buildBrdText({
      header: `BT Index Romania ETF BET-TR Decizie autorizare: 255/06.08.2008 VALOARE UNITARA A ACTIVULUI NET (VUAN) (RON)`,
      vuanLabel: null,
    });
    const result = run(text);
    expect(valueOf(result, "nav_per_unit")).toEqual({ numericValue: "11.091", rawValue: "11.091" });
  });
});

describe("rejected token (AC6, adapter half)", () => {
  it("a rejected net_asset token (ro-format) is missing, not the clasa UF value", () => {
    const text = buildBrdText({ navFundValue: "415.591.664,27" });
    const result = run(text);
    expect(isMissing(result, "net_asset")).toBe(true);
  });

  it("a rejected investors_total token leaves the sub-fields correct", () => {
    const text = buildBrdText({ invValue: "18,70" });
    const result = run(text);
    expect(isMissing(result, "investors_total")).toBe(true);
    expect(valueOf(result, "investors_individuals")).toEqual({ numericValue: "18631", rawValue: "18,631" });
    expect(valueOf(result, "investors_legal_entities")).toEqual({ numericValue: "77", rawValue: "77" });
  });
});

describe("label removal (AC7)", () => {
  it("navFundLabel removed -> only net_asset missing", () => {
    const text = buildBrdText({ navFundLabel: null });
    expect(text.includes("ACTIV NET (in valuta fond - RON)")).toBe(false);
    const result = run(text);
    if (!result.ok) throw new Error("expected ok:true");
    expect([...result.missingFields].sort()).toEqual(["net_asset"]);
    for (const key of brdDepositaryAdapter.fieldKeys) {
      if (key === "net_asset") continue;
      expect(valueOf(result, key)).toEqual(valueOf(DEFAULT_RESULT, key));
    }
  });

  it("units block's Persoane fizice removed -> only units_held_individuals missing", () => {
    const text = buildBrdText({ unitsIndLabel: null });
    expect(text.split("Persoane fizice").length - 1).toBe(1);
    const result = run(text);
    if (!result.ok) throw new Error("expected ok:true");
    expect([...result.missingFields].sort()).toEqual(["units_held_individuals"]);
    for (const key of brdDepositaryAdapter.fieldKeys) {
      if (key === "units_held_individuals") continue;
      expect(valueOf(result, key)).toEqual(valueOf(DEFAULT_RESULT, key));
    }
  });

  it("units block's Persoane juridice removed -> units_held_legal_entities and nav_per_unit missing", () => {
    const text = buildBrdText({ unitsLegLabel: null });
    expect(text.split("Persoane juridice").length - 1).toBe(1);
    const result = run(text);
    if (!result.ok) throw new Error("expected ok:true");
    expect([...result.missingFields].sort()).toEqual(["nav_per_unit", "units_held_legal_entities"]);
    for (const key of brdDepositaryAdapter.fieldKeys) {
      if (key === "units_held_legal_entities" || key === "nav_per_unit") continue;
      expect(valueOf(result, key)).toEqual(valueOf(DEFAULT_RESULT, key));
    }
  });

  it("NUMAR U.F. label removed -> units_* fields and nav_per_unit missing", () => {
    const text = buildBrdText({ unitsLabel: null });
    expect(text.includes("NUMAR U.F.")).toBe(false);
    const result = run(text);
    if (!result.ok) throw new Error("expected ok:true");
    expect([...result.missingFields].sort()).toEqual(
      ["nav_per_unit", "units_held_individuals", "units_held_legal_entities", "units_in_circulation"].sort(),
    );
    for (const key of ["net_asset", "investors_total", "investors_individuals", "investors_legal_entities"]) {
      expect(valueOf(result, key)).toEqual(valueOf(DEFAULT_RESULT, key));
    }
  });

  it("Numar investitori label removed -> investors_* fields and nav_per_unit missing, units_* still correct", () => {
    const text = buildBrdText({ invLabel: null });
    expect(text.includes("Numar investitori")).toBe(false);
    const result = run(text);
    if (!result.ok) throw new Error("expected ok:true");
    expect([...result.missingFields].sort()).toEqual(
      ["investors_individuals", "investors_legal_entities", "investors_total", "nav_per_unit"].sort(),
    );
    expect(valueOf(result, "units_in_circulation")).toEqual({ numericValue: "37470000", rawValue: "37,470,000" });
    expect(valueOf(result, "units_held_individuals")).toEqual({ numericValue: "29733778", rawValue: "29,733,778" });
    expect(valueOf(result, "units_held_legal_entities")).toEqual({ numericValue: "7736222", rawValue: "7,736,222" });
    expect(valueOf(result, "net_asset")).toEqual(valueOf(DEFAULT_RESULT, "net_asset"));
  });

  it("investors block's Persoane fizice removed -> only investors_individuals missing", () => {
    const text = buildBrdText({ invIndLabel: null });
    expect(text.split("Persoane fizice").length - 1).toBe(1);
    const result = run(text);
    if (!result.ok) throw new Error("expected ok:true");
    expect([...result.missingFields].sort()).toEqual(["investors_individuals"]);
    for (const key of brdDepositaryAdapter.fieldKeys) {
      if (key === "investors_individuals") continue;
      expect(valueOf(result, key)).toEqual(valueOf(DEFAULT_RESULT, key));
    }
  });

  it("investors block's Persoane juridice removed -> only investors_legal_entities missing", () => {
    const text = buildBrdText({ invLegLabel: null });
    expect(text.split("Persoane juridice").length - 1).toBe(1);
    const result = run(text);
    if (!result.ok) throw new Error("expected ok:true");
    expect([...result.missingFields].sort()).toEqual(["investors_legal_entities"]);
    for (const key of brdDepositaryAdapter.fieldKeys) {
      if (key === "investors_legal_entities") continue;
      expect(valueOf(result, key)).toEqual(valueOf(DEFAULT_RESULT, key));
    }
  });

  it("regex metacharacters in labels are escaped: NUMAR UXF. gives the same result as the label being absent", () => {
    const text = buildBrdText({ unitsLabel: "NUMAR UXF. in circulatie, din care detinute de:" });
    const result = run(text);
    if (!result.ok) throw new Error("expected ok:true");
    expect([...result.missingFields].sort()).toEqual(
      ["nav_per_unit", "units_held_individuals", "units_held_legal_entities", "units_in_circulation"].sort(),
    );
  });
});

describe("canHandle (AC8)", () => {
  it("true for the default BRD-format text", () => {
    expect(brdDepositaryAdapter.canHandle(DEFAULT_TEXT)).toBe(true);
  });

  it("true with whitespace runs or newlines inside the required labels", () => {
    const text = buildBrdText({
      footer: "Raport  depozitar\nla data de 21.09.2026 in valuta RON",
      unitsLabel: "NUMAR  U.F.\nin circulatie, din care detinute de:",
      vuanLabel: "VALOARE  UNITARA A ACTIVULUI NET (VUAN) (RON)",
    });
    expect(brdDepositaryAdapter.canHandle(text)).toBe(true);
  });

  it("false for VAN instead of VUAN (ICBETNETF-style)", () => {
    const text = buildBrdText({ vuanLabel: "VALOARE UNITARA A ACTIVULUI NET (VAN) (RON)" });
    expect(brdDepositaryAdapter.canHandle(text)).toBe(false);
  });

  it("false when the footer is absent", () => {
    expect(brdDepositaryAdapter.canHandle(buildBrdText({ footer: null }))).toBe(false);
  });

  it("false when the units label is absent", () => {
    expect(brdDepositaryAdapter.canHandle(buildBrdText({ unitsLabel: null }))).toBe(false);
  });

  it("false for empty text", () => {
    expect(brdDepositaryAdapter.canHandle("")).toBe(false);
  });

  it("false for unrelated text", () => {
    expect(brdDepositaryAdapter.canHandle("lorem ipsum dolor sit amet")).toBe(false);
  });

  it("canHandle is independent of extract: VAN text still extracts without throwing", () => {
    const text = buildBrdText({ vuanLabel: "VALOARE UNITARA A ACTIVULUI NET (VAN) (RON)" });
    expect(() => brdDepositaryAdapter.extract(text)).not.toThrow();
    const result = run(text);
    expect(isMissing(result, "nav_per_unit")).toBe(true);
  });
});

describe("purity (AC9)", () => {
  it("A-B-A: extract does not leak state between calls", () => {
    const textA = DEFAULT_TEXT;
    const textB = buildBrdText({ footer: null });
    const resultA1 = brdDepositaryAdapter.extract(textA);
    brdDepositaryAdapter.extract(textB);
    const resultA2 = brdDepositaryAdapter.extract(textA);
    expect(resultA2).toEqual(resultA1);
  });
});
