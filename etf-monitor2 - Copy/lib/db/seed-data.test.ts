import { describe, expect, it } from "vitest";
import {
  seedEtfs,
  seedFieldCatalog,
  seedSettings,
  seedTrackedFields,
} from "./seed-data";

describe("seed data consistency", () => {
  it("every tracked field key exists in the field catalogue", () => {
    const catalogKeys = new Set(seedFieldCatalog.map((f) => f.fieldKey));
    for (const tracked of seedTrackedFields) {
      expect(catalogKeys.has(tracked.fieldKey)).toBe(true);
    }
  });

  it("every ETF's adapter key is present in the field catalogue", () => {
    const catalogAdapterKeys = new Set(seedFieldCatalog.map((f) => f.adapterKey));
    for (const etf of seedEtfs) {
      expect(catalogAdapterKeys.has(etf.adapterKey)).toBe(true);
    }
  });

  it("seeds exactly the expected counts", () => {
    expect(seedEtfs).toHaveLength(3);
    // US-029: 8 brd-depositary rows + 8 intercapital-nav rows.
    expect(seedFieldCatalog).toHaveLength(16);
    expect(seedTrackedFields).toHaveLength(2);
  });

  it("has no duplicate ETF symbols or field catalog keys", () => {
    expect(new Set(seedEtfs.map((e) => e.symbol)).size).toBe(seedEtfs.length);
    expect(
      new Set(seedFieldCatalog.map((f) => `${f.adapterKey}:${f.fieldKey}`)).size,
    ).toBe(seedFieldCatalog.length);
  });

  it("settings row uses id 1 and a valid default locale", () => {
    expect(seedSettings.id).toBe(1);
    expect(seedSettings.defaultLocale).toBe("ro");
  });
});

type CatalogRow = { adapterKey: string; fieldKey: string; labelRo: string; labelEn: string; unit: string | null };

/**
 * A `field_key` shared by more than one `adapter_key` must carry identical labels/unit (US-029
 * AC10, DEC-018 §3): the home table and history pages key a column off the field, not the
 * adapter, so a mismatch would silently show one adapter's rows under another's header.
 */
function findSharedKeyConflicts(
  catalog: readonly CatalogRow[],
): { fieldKey: string; adapterKeys: string[] }[] {
  const byFieldKey = new Map<string, CatalogRow[]>();
  for (const row of catalog) {
    const rows = byFieldKey.get(row.fieldKey) ?? [];
    rows.push(row);
    byFieldKey.set(row.fieldKey, rows);
  }

  const conflicts: { fieldKey: string; adapterKeys: string[] }[] = [];
  for (const [fieldKey, rows] of byFieldKey) {
    const distinctAdapters = new Set(rows.map((r) => r.adapterKey));
    if (distinctAdapters.size < 2) continue;
    const distinctShapes = new Set(rows.map((r) => `${r.labelRo}\u0000${r.labelEn}\u0000${r.unit}`));
    if (distinctShapes.size > 1) {
      conflicts.push({ fieldKey, adapterKeys: [...distinctAdapters] });
    }
  }
  return conflicts;
}

describe("label invariant across adapters (SL, US-029 AC10)", () => {
  it("SL-1: the shipped catalogue has no shared-key conflict", () => {
    expect(findSharedKeyConflicts(seedFieldCatalog)).toEqual([]);
  });

  it("SL-2: a synthetic conflicting catalogue is caught", () => {
    const synthetic: CatalogRow[] = [
      { adapterKey: "adapter-a", fieldKey: "shared_key", labelRo: "Ro A", labelEn: "En A", unit: "count" },
      { adapterKey: "adapter-b", fieldKey: "shared_key", labelRo: "Ro B", labelEn: "En A", unit: "count" },
    ];
    expect(findSharedKeyConflicts(synthetic)).toEqual([
      { fieldKey: "shared_key", adapterKeys: ["adapter-a", "adapter-b"] },
    ]);
  });

  it("SL-3: at least one key really is shared in the shipped catalogue (SL-1 is not vacuous)", () => {
    const byFieldKey = new Map<string, Set<string>>();
    for (const row of seedFieldCatalog) {
      const adapters = byFieldKey.get(row.fieldKey) ?? new Set<string>();
      adapters.add(row.adapterKey);
      byFieldKey.set(row.fieldKey, adapters);
    }
    const sharedKeys = [...byFieldKey.entries()].filter(([, adapters]) => adapters.size > 1);
    expect(sharedKeys.length).toBeGreaterThan(0);
    expect(sharedKeys.map(([fieldKey]) => fieldKey)).toContain("nav_per_unit");
  });
});
