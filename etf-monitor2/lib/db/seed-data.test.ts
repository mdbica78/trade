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
    expect(seedFieldCatalog).toHaveLength(8);
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
