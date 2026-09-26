import { describe, expect, it, vi } from "vitest";
import { seedEtfs } from "../db/seed-data";
import type { Db } from "../db/index";
import type { BatchRunner } from "../ingestion/store";
import { addEtf, bvbInstrumentUrl, normaliseName, normaliseSymbol, type EtfConfigDeps } from "./etfs";

function fakeDeps(overrides: Partial<EtfConfigDeps> = {}): { deps: EtfConfigDeps; run: BatchRunner } {
  const run: BatchRunner = vi.fn(async () => {
    throw new Error("runner should not be called");
  });
  const deps: EtfConfigDeps = {
    db: { execute: (q: unknown) => q } as unknown as Db,
    run,
    registry: { get: () => undefined, list: () => [] },
    detect: async () => ({ adapterKey: null, reason: "not_found" }),
    ...overrides,
  };
  return { deps, run: deps.run };
}

describe("bvbInstrumentUrl (CE-U1)", () => {
  it("matches seed-data.ts's bvbUrl for every seeded symbol", () => {
    for (const etf of seedEtfs) {
      expect(bvbInstrumentUrl(etf.symbol)).toBe(etf.bvbUrl);
    }
  });
});

describe("normaliseSymbol / normaliseName validation (CE-V)", () => {
  it.each(["", "   ", "BT-ETF", "BT ETF", "ȘTEF", 42, null, undefined])(
    "CE-V: %j is an invalid symbol",
    (raw) => {
      expect(normaliseSymbol(raw)).toBeNull();
    },
  );

  it("valid symbols are trimmed and upper-cased", () => {
    expect(normaliseSymbol("  btbetretf ")).toBe("BTBETRETF");
    expect(normaliseSymbol("Abc123")).toBe("ABC123");
  });

  it.each(["", "   ", 42, null, undefined])("CE-V: %j is an invalid name", (raw) => {
    expect(normaliseName(raw)).toBeNull();
  });

  it("valid names are trimmed", () => {
    expect(normaliseName(" BT Index ")).toBe("BT Index");
  });
});

describe("addEtf validation makes no runner or detect call (CE-V, CE-U)", () => {
  it.each(["", "   ", "BT-ETF", "BT ETF", "ȘTEF", 42, null])(
    "invalid symbol %j returns invalid_symbol with zero calls",
    async (symbol) => {
      const detect = vi.fn(async () => ({ adapterKey: null as string | null, reason: "not_found" as const }));
      const { deps, run } = fakeDeps({ detect });
      const result = await addEtf({ symbol, name: "Valid Name" }, deps);
      expect(result).toEqual({ ok: false, error: "invalid_symbol" });
      expect(run).not.toHaveBeenCalled();
      expect(detect).not.toHaveBeenCalled();
    },
  );

  it.each(["", "   ", 42, null])("invalid name %j returns invalid_name with zero calls", async (name) => {
    const detect = vi.fn(async () => ({ adapterKey: null as string | null, reason: "not_found" as const }));
    const { deps, run } = fakeDeps({ detect });
    const result = await addEtf({ symbol: "BTBETRETF", name }, deps);
    expect(result).toEqual({ ok: false, error: "invalid_name" });
    expect(run).not.toHaveBeenCalled();
    expect(detect).not.toHaveBeenCalled();
  });
});
