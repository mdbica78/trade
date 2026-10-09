import { describe, expect, it, vi } from "vitest";
import type { EtfConfigDeps } from "../../../config/etfs";
import { buildTestContext } from "../../../../test/helpers/ai-config-context";
import { EXECUTION_CODES, executeConfigurationIntent, type ExecutionCode } from "./execute";

vi.mock("../../../config/etfs", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../config/etfs")>();
  return { ...original, addEtf: vi.fn(), setEtfActive: vi.fn() };
});
vi.mock("../../../config/tracked-fields", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../config/tracked-fields")>();
  return { ...original, trackField: vi.fn(), untrackField: vi.fn() };
});

import { addEtf, setEtfActive } from "../../../config/etfs";
import { trackField, untrackField } from "../../../config/tracked-fields";

const deps = {} as EtfConfigDeps;
const context = buildTestContext();

describe("executeConfigurationIntent (EX)", () => {
  it("EX-1: add_etf sends the symbol only, so the name always comes from BVB (US-060 AC4)", async () => {
    vi.mocked(addEtf).mockResolvedValue({ ok: true, action: "added", symbol: "XYZ", adapterKey: null, reason: "no_match" });
    await executeConfigurationIntent({ action: "add_etf", symbol: "XYZ" }, context, deps);
    expect(addEtf).toHaveBeenCalledWith({ symbol: "XYZ" }, deps);

    // A model-supplied name that slipped past the types is never forwarded.
    vi.mocked(addEtf).mockClear();
    vi.mocked(addEtf).mockResolvedValue({ ok: true, action: "added", symbol: "XYZ", adapterKey: null, reason: "no_match" });
    await executeConfigurationIntent({ action: "add_etf", symbol: "XYZ", name: "Fond Test" } as never, context, deps);
    expect(addEtf).toHaveBeenCalledWith({ symbol: "XYZ" }, deps);
  });

  it("add_etf: added with an adapter -> added, adapterKey carried, changed", async () => {
    vi.mocked(addEtf).mockResolvedValue({ ok: true, action: "added", symbol: "XYZ", adapterKey: "brd-depositary", reason: "detected" });
    const result = await executeConfigurationIntent({ action: "add_etf", symbol: "XYZ" }, context, deps);
    expect(result).toEqual({ code: "added", symbol: "XYZ", field: null, adapterKey: "brd-depositary", detectionReason: null, changed: true });
  });

  it("add_etf: added with no adapter -> added_no_adapter, detectionReason carried", async () => {
    vi.mocked(addEtf).mockResolvedValue({ ok: true, action: "added", symbol: "XYZ", adapterKey: null, reason: "no_match" });
    const result = await executeConfigurationIntent({ action: "add_etf", symbol: "XYZ" }, context, deps);
    expect(result).toEqual({ code: "added_no_adapter", symbol: "XYZ", field: null, adapterKey: null, detectionReason: "no_match", changed: true });
  });

  it("add_etf: reactivated", async () => {
    vi.mocked(addEtf).mockResolvedValue({ ok: true, action: "reactivated", symbol: "PTENGETF" });
    const result = await executeConfigurationIntent({ action: "add_etf", symbol: "PTENGETF" }, context, deps);
    expect(result).toEqual({ code: "reactivated", symbol: "PTENGETF", field: null, adapterKey: null, detectionReason: null, changed: true });
  });

  it("add_etf: already_monitored", async () => {
    vi.mocked(addEtf).mockResolvedValue({ ok: false, error: "already_monitored" });
    const result = await executeConfigurationIntent({ action: "add_etf", symbol: "BTBETRETF" }, context, deps);
    expect(result).toEqual({ code: "already_monitored", symbol: "BTBETRETF", field: null, adapterKey: null, detectionReason: null, changed: false });
  });

  it("add_etf: invalid_symbol -> add_rejected (defensive, unreachable through grounding)", async () => {
    vi.mocked(addEtf).mockResolvedValue({ ok: false, error: "invalid_symbol" });
    const result = await executeConfigurationIntent({ action: "add_etf", symbol: "XYZ" }, context, deps);
    expect(result.code).toBe("add_rejected");
  });

  it("remove_etf: not_found (defensive; grounding pre-empts this in practice)", async () => {
    vi.mocked(setEtfActive).mockResolvedValue({ ok: false, error: "not_found" });
    const result = await executeConfigurationIntent({ action: "remove_etf", symbol: "ZZZETF" }, context, deps);
    expect(result).toEqual({ code: "not_found", symbol: "ZZZETF", field: null, adapterKey: null, detectionReason: null, changed: false });
  });

  it("remove_etf: ok on an active ETF -> removed, changed", async () => {
    vi.mocked(setEtfActive).mockResolvedValue({ ok: true });
    const result = await executeConfigurationIntent({ action: "remove_etf", symbol: "BTBETRETF" }, context, deps);
    expect(result).toEqual({ code: "removed", symbol: "BTBETRETF", field: null, adapterKey: null, detectionReason: null, changed: true });
  });

  it("remove_etf: ok on an already-inactive ETF -> already_inactive, not changed (tech-lead point 4)", async () => {
    vi.mocked(setEtfActive).mockResolvedValue({ ok: true });
    const inactiveContext = buildTestContext({
      etfs: buildTestContext().etfs.map((e) => (e.symbol === "BTBETRETF" ? { ...e, isActive: false } : e)),
    });
    const result = await executeConfigurationIntent({ action: "remove_etf", symbol: "BTBETRETF" }, inactiveContext, deps);
    expect(result).toEqual({ code: "already_inactive", symbol: "BTBETRETF", field: null, adapterKey: null, detectionReason: null, changed: false });
  });

  it("track_field: tracked, already_tracked, not_found, field_not_available all carry the context field labels", async () => {
    vi.mocked(trackField).mockResolvedValue({ ok: true, action: "tracked", symbol: "BTBETRETF" });
    let result = await executeConfigurationIntent({ action: "track_field", symbol: "BTBETRETF", field: "net_asset" }, context, deps);
    expect(result).toEqual({ code: "tracked", symbol: "BTBETRETF", field: { fieldKey: "net_asset", labelRo: "Activ net", labelEn: "Net asset" }, adapterKey: null, detectionReason: null, changed: true });

    vi.mocked(trackField).mockResolvedValue({ ok: true, action: "already_tracked", symbol: "BTBETRETF" });
    result = await executeConfigurationIntent({ action: "track_field", symbol: "BTBETRETF", field: "units_in_circulation" }, context, deps);
    expect(result.code).toBe("already_tracked");
    expect(result.changed).toBe(false);

    vi.mocked(trackField).mockResolvedValue({ ok: false, error: "not_found" });
    result = await executeConfigurationIntent({ action: "track_field", symbol: "ZZZETF", field: "net_asset" }, context, deps);
    expect(result.code).toBe("not_found");

    vi.mocked(trackField).mockResolvedValue({ ok: false, error: "field_not_available" });
    result = await executeConfigurationIntent({ action: "track_field", symbol: "NOADPETF", field: "net_asset" }, context, deps);
    expect(result.code).toBe("field_not_available");
  });

  it("untrack_field: untracked, not_found, not_tracked", async () => {
    vi.mocked(untrackField).mockResolvedValue({ ok: true, symbol: "BTBETRETF" });
    let result = await executeConfigurationIntent({ action: "untrack_field", symbol: "BTBETRETF", field: "units_in_circulation" }, context, deps);
    expect(result.code).toBe("untracked");
    expect(result.changed).toBe(true);

    vi.mocked(untrackField).mockResolvedValue({ ok: false, error: "not_found" });
    result = await executeConfigurationIntent({ action: "untrack_field", symbol: "ZZZETF", field: "net_asset" }, context, deps);
    expect(result.code).toBe("not_found");

    vi.mocked(untrackField).mockResolvedValue({ ok: false, error: "not_tracked" });
    result = await executeConfigurationIntent({ action: "untrack_field", symbol: "BTBETRETF", field: "net_asset" }, context, deps);
    expect(result.code).toBe("not_tracked");
  });

  it("EX-5: a field key present in neither available nor tracked falls back to the key as its own labels", async () => {
    vi.mocked(trackField).mockResolvedValue({ ok: true, action: "tracked", symbol: "BTBETRETF" });
    const result = await executeConfigurationIntent({ action: "track_field", symbol: "BTBETRETF", field: "ghost_field" }, context, deps);
    expect(result.field).toEqual({ fieldKey: "ghost_field", labelRo: "ghost_field", labelEn: "ghost_field" });
  });

  it("EX-3: the full result table produces every ExecutionCode at least once (not a vacuous set)", () => {
    const covered = new Set<ExecutionCode>([
      "added", "added_no_adapter", "reactivated", "already_monitored", "add_rejected",
      "removed", "already_inactive", "not_found",
      "tracked", "already_tracked", "field_not_available",
      "untracked", "not_tracked",
    ]);
    expect(covered).toEqual(new Set(EXECUTION_CODES));
  });
});
