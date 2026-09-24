import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { seedEtfs } from "../db/seed-data";
import { defaultAdapterRegistry } from "./adapters/default-registry";
import { brdDepositaryAdapter } from "./adapters/brd-depositary";
import { CANONICAL_NUMERIC_PATTERN, isIsoCalendarDate, validateExtractionResult } from "./adapters/validate";
import type { ExtractionAdapter } from "./adapters/types";
import { extractPdfText } from "./pdf";

const FIXTURES_DIR = path.join(__dirname, "../../test/fixtures");

type ManifestValue = { rawValue: string; numericValue: string };
type ManifestEntry = {
  file: string;
  symbol: string;
  adapterKey: string;
  reportDate: string;
  source: string;
  values: Record<string, ManifestValue>;
};

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`manifest: ${label} must be a non-empty string, got ${JSON.stringify(value)}`);
  }
}

function loadManifest(): ManifestEntry[] {
  const raw = readFileSync(path.join(FIXTURES_DIR, "expected.json"), "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || !("fixtures" in parsed)) {
    throw new Error('expected.json must have a top-level "fixtures" array');
  }
  const fixtures = (parsed as { fixtures: unknown }).fixtures;
  if (!Array.isArray(fixtures)) {
    throw new Error('expected.json: "fixtures" must be an array');
  }

  return fixtures.map((entry, index) => {
    const label = `fixtures[${index}]`;
    if (typeof entry !== "object" || entry === null) {
      throw new Error(`${label}: must be an object`);
    }
    const e = entry as Record<string, unknown>;
    assertNonEmptyString(e.file, `${label}.file`);
    assertNonEmptyString(e.symbol, `${label}.symbol`);
    assertNonEmptyString(e.adapterKey, `${label}.adapterKey`);
    assertNonEmptyString(e.reportDate, `${label}.reportDate`);
    assertNonEmptyString(e.source, `${label}.source`);
    if (typeof e.values !== "object" || e.values === null) {
      throw new Error(`${label} (${e.file}).values must be an object`);
    }
    const values: Record<string, ManifestValue> = {};
    for (const [fieldKey, v] of Object.entries(e.values as Record<string, unknown>)) {
      if (typeof v !== "object" || v === null) {
        throw new Error(`${label} (${e.file}).values.${fieldKey} must be an object`);
      }
      const vv = v as Record<string, unknown>;
      assertNonEmptyString(vv.rawValue, `${label} (${e.file}).values.${fieldKey}.rawValue`);
      assertNonEmptyString(vv.numericValue, `${label} (${e.file}).values.${fieldKey}.numericValue`);
      values[fieldKey] = { rawValue: vv.rawValue, numericValue: vv.numericValue };
    }

    return {
      file: e.file,
      symbol: e.symbol,
      adapterKey: e.adapterKey,
      reportDate: e.reportDate,
      source: e.source,
      values,
    };
  });
}

function listPdfFixtures(): string[] {
  return readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"))
    .map((entry) => entry.name)
    .sort();
}

/** Pure helper: which PDFs have no manifest entry, and which manifest entries have no PDF. */
export function diffFixtureSets(
  pdfFiles: readonly string[],
  manifestFiles: readonly string[],
): { unlisted: string[]; stale: string[] } {
  const pdfSet = new Set(pdfFiles);
  const manifestSet = new Set(manifestFiles);
  const unlisted = pdfFiles.filter((f) => !manifestSet.has(f)).sort();
  const stale = manifestFiles.filter((f) => !pdfSet.has(f)).sort();
  return { unlisted, stale };
}

function readPdfFixture(name: string): Uint8Array<ArrayBuffer> {
  const buf = readFileSync(path.join(FIXTURES_DIR, name));
  const out = new Uint8Array(buf.byteLength);
  out.set(buf);
  return out;
}

/** Exact decimal-string arithmetic: sums parts and compares against total, no float tolerance. */
export function sumsExactly(parts: readonly string[], total: string): boolean {
  const toScaled = (s: string): { digits: bigint; scale: number } => {
    const negative = s.startsWith("-");
    const unsigned = negative ? s.slice(1) : s;
    const [intPart, fracPart = ""] = unsigned.split(".");
    const digitsStr = `${intPart}${fracPart}`;
    const digits = BigInt(digitsStr === "" ? "0" : digitsStr) * (negative ? BigInt("-1") : BigInt("1"));
    return { digits, scale: fracPart.length };
  };

  const scaledParts = parts.map(toScaled);
  const scaledTotal = toScaled(total);
  const maxScale = Math.max(scaledTotal.scale, ...scaledParts.map((p) => p.scale));

  const rescale = (p: { digits: bigint; scale: number }): bigint =>
    p.digits * BigInt("10") ** BigInt(maxScale - p.scale);

  const sum = scaledParts.reduce((acc, p) => acc + rescale(p), BigInt("0"));
  return sum === rescale(scaledTotal);
}

const manifest = loadManifest();
const pipelineCache = new Map<string, Awaited<ReturnType<typeof extractPdfText>>>();

describe("fixture manifest and PDFs stay in sync", () => {
  it("is not vacuous: at least 3 entries, including BTBETRETF-2026-09-21", () => {
    expect(manifest.length).toBeGreaterThanOrEqual(3);
    expect(manifest.some((e) => e.file === "BTBETRETF-2026-09-21.pdf")).toBe(true);
  });

  describe("diffFixtureSets helper (AC3 synthetic checks)", () => {
    it("finds a PDF with no manifest entry", () => {
      expect(diffFixtureSets(["a.pdf", "b.pdf"], ["a.pdf"])).toEqual({ unlisted: ["b.pdf"], stale: [] });
    });
    it("finds a manifest entry with no PDF", () => {
      expect(diffFixtureSets(["a.pdf"], ["a.pdf", "c.pdf"])).toEqual({ unlisted: [], stale: ["c.pdf"] });
    });
    it("finds nothing when the sets are equal", () => {
      expect(diffFixtureSets(["a.pdf", "b.pdf"], ["b.pdf", "a.pdf"])).toEqual({ unlisted: [], stale: [] });
    });
  });

  it("every PDF in test/fixtures/ has a manifest entry (AC3)", () => {
    const { unlisted } = diffFixtureSets(
      listPdfFixtures(),
      manifest.map((e) => e.file),
    );
    expect(unlisted, "PDFs in test/fixtures/ without a manifest entry").toEqual([]);
  });

  it("every manifest entry has a PDF (AC3)", () => {
    const { stale } = diffFixtureSets(
      listPdfFixtures(),
      manifest.map((e) => e.file),
    );
    expect(stale, "manifest entries without a PDF").toEqual([]);
  });
});

describe("manifest shape (AC1)", () => {
  it.each(manifest)("$file: has all fieldKeys, valid reportDate, consistent naming", (entry) => {
    expect(Object.keys(entry.values).sort()).toEqual([...brdDepositaryAdapter.fieldKeys].sort());
    expect(Object.keys(entry.values).length).toBe(brdDepositaryAdapter.fieldKeys.length);
    expect(isIsoCalendarDate(entry.reportDate)).toBe(true);
    expect(entry.file).toBe(`${entry.symbol}-${entry.reportDate}.pdf`);

    const seedEtf = seedEtfs.find((e) => e.symbol === entry.symbol);
    expect(seedEtf, `symbol "${entry.symbol}" must be a seeded ETF`).toBeDefined();
    expect(entry.adapterKey).toBe(seedEtf?.adapterKey);

    expect(entry.source.trim()).not.toBe("");

    for (const [fieldKey, value] of Object.entries(entry.values)) {
      expect(CANONICAL_NUMERIC_PATTERN.test(value.numericValue), `${fieldKey}.numericValue`).toBe(true);
      expect(value.numericValue, `${fieldKey}: numericValue must equal rawValue without commas`).toBe(
        value.rawValue.replace(/,/g, ""),
      );
    }
  });

  it("has no duplicate file names", () => {
    const files = manifest.map((e) => e.file);
    expect(new Set(files).size).toBe(files.length);
  });

  it("BTBETRETF-2026-09-21 entry equals the story's Task 1 table", () => {
    const entry = manifest.find((e) => e.file === "BTBETRETF-2026-09-21.pdf");
    expect(entry).toBeDefined();
    expect(entry?.reportDate).toBe("2026-09-21");
    expect(entry?.values).toEqual({
      net_asset: { rawValue: "415,591,664.27", numericValue: "415591664.27" },
      units_in_circulation: { rawValue: "37,470,000", numericValue: "37470000" },
      units_held_individuals: { rawValue: "29,733,778", numericValue: "29733778" },
      units_held_legal_entities: { rawValue: "7,736,222", numericValue: "7736222" },
      nav_per_unit: { rawValue: "11.091", numericValue: "11.091" },
      investors_total: { rawValue: "18,708", numericValue: "18708" },
      investors_individuals: { rawValue: "18,631", numericValue: "18631" },
      investors_legal_entities: { rawValue: "77", numericValue: "77" },
    });
  });
});

describe("PDF -> text -> adapter pipeline (AC2, AC4, AC5)", () => {
  let networkGuard: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    networkGuard = vi.fn();
    vi.stubGlobal("fetch", networkGuard);

    for (const entry of manifest) {
      const bytes = readPdfFixture(entry.file);
      const result = await extractPdfText(bytes);
      pipelineCache.set(entry.file, result);
    }
  }, 60_000);

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("never touches the network", () => {
    expect(networkGuard).not.toHaveBeenCalled();
  });

  describe.each(manifest)("$file", (entry) => {
    it("adapter extracts exactly the manifest's date and values, no missing field, no violation (AC2)", () => {
      const textResult = pipelineCache.get(entry.file);
      if (!textResult || !textResult.ok) {
        throw new Error(`extractPdfText failed for ${entry.file}: ${textResult && "message" in textResult ? textResult.message : "no result"}`);
      }
      const adapter = defaultAdapterRegistry.get(entry.adapterKey) as ExtractionAdapter;
      expect(adapter, `adapter "${entry.adapterKey}" must be registered`).toBeDefined();

      const result = adapter.extract(textResult.text);
      if (!result.ok) {
        throw new Error(`adapter.extract failed for ${entry.file}: ${result.error}`);
      }

      expect(result.reportDate).toBe(entry.reportDate);

      const actualValues = Object.fromEntries(
        result.values.map((v) => [v.fieldKey, { rawValue: v.rawValue, numericValue: v.numericValue }]),
      );
      expect(actualValues).toEqual(entry.values);
      expect(result.missingFields).toEqual([]);
      expect(validateExtractionResult(adapter, result)).toEqual([]);
    });

    it("detect(text) returns the brd-depositary adapter (AC5)", () => {
      const textResult = pipelineCache.get(entry.file);
      if (!textResult || !textResult.ok) {
        throw new Error(`extractPdfText failed for ${entry.file}`);
      }
      const detected = defaultAdapterRegistry.detect(textResult.text);
      expect(detected).toBe(defaultAdapterRegistry.get("brd-depositary"));
      expect(detected?.key).toBe(entry.adapterKey);
    });
  });
});

describe("sumsExactly helper", () => {
  it("sums two decimals with matching scale", () => {
    expect(sumsExactly(["27044585.00", "1175415.00"], "28220000.00")).toBe(true);
  });
  it("sums when the total has fewer decimal places than the parts", () => {
    expect(sumsExactly(["27044585.00", "1175415.00"], "28220000")).toBe(true);
  });
  it("returns false for a wrong sum", () => {
    expect(sumsExactly(["1", "2"], "4")).toBe(false);
  });
  it("avoids the float trap: 0.1 + 0.2 = 0.3 exactly", () => {
    expect(sumsExactly(["0.1", "0.2"], "0.3")).toBe(true);
  });
});

describe("consistency checks (AC4)", () => {
  describe.each(manifest)("$file", (entry) => {
    it("pipeline: units breakdown sums to units_in_circulation, investors breakdown sums to investors_total", () => {
      const textResult = pipelineCache.get(entry.file);
      if (!textResult || !textResult.ok) {
        throw new Error(`extractPdfText failed for ${entry.file}`);
      }
      const adapter = defaultAdapterRegistry.get(entry.adapterKey) as ExtractionAdapter;
      const result = adapter.extract(textResult.text);
      if (!result.ok) {
        throw new Error(`adapter.extract failed for ${entry.file}: ${result.error}`);
      }
      const byKey = new Map(result.values.map((v) => [v.fieldKey, v.numericValue]));

      expect(
        sumsExactly(
          [byKey.get("units_held_individuals")!, byKey.get("units_held_legal_entities")!],
          byKey.get("units_in_circulation")!,
        ),
      ).toBe(true);
      expect(
        sumsExactly(
          [byKey.get("investors_individuals")!, byKey.get("investors_legal_entities")!],
          byKey.get("investors_total")!,
        ),
      ).toBe(true);
    });

    it("manifest: units breakdown sums to units_in_circulation, investors breakdown sums to investors_total", () => {
      expect(
        sumsExactly(
          [entry.values.units_held_individuals.numericValue, entry.values.units_held_legal_entities.numericValue],
          entry.values.units_in_circulation.numericValue,
        ),
      ).toBe(true);
      expect(
        sumsExactly(
          [entry.values.investors_individuals.numericValue, entry.values.investors_legal_entities.numericValue],
          entry.values.investors_total.numericValue,
        ),
      ).toBe(true);
    });

    it("nav_per_unit is within 1% of net_asset / units_in_circulation (not an AC, mis-anchoring guard)", () => {
      const netAsset = Number(entry.values.net_asset.numericValue);
      const units = Number(entry.values.units_in_circulation.numericValue);
      const nav = Number(entry.values.nav_per_unit.numericValue);
      const computed = netAsset / units;
      expect(Math.abs(computed - nav) / nav).toBeLessThan(0.01);
    });
  });
});
