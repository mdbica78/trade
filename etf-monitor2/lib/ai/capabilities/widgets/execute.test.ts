import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WidgetConfigDeps } from "../../../config/widgets";

vi.mock("../../../config/widgets", () => ({
  addWidget: vi.fn(async () => ({ ok: true, value: { slot: 1 } })),
  updateWidget: vi.fn(async () => ({ ok: true, value: { slot: 2 } })),
  clearWidget: vi.fn(async () => ({ ok: true, value: 1 })),
  replaceWidgets: vi.fn(async () => ({ ok: true, value: [] })),
}));

import { addWidget, clearWidget, replaceWidgets, updateWidget } from "../../../config/widgets";
import { executeWidgetIntent } from "./execute";

const deps = {} as WidgetConfigDeps;
const definition = { operation: "change", fieldKey: "nav_per_unit", periodUnit: "days", periodAmount: 7 } as const;

beforeEach(() => vi.clearAllMocks());

describe("executeWidgetIntent", () => {
  it("maps every closed operation through its existing config function", async () => {
    const outcomes = await Promise.all([
      executeWidgetIntent({ action: "widget_add", symbol: "ETF", definition }, deps),
      executeWidgetIntent({ action: "widget_update", symbol: "ETF", slot: 2, changes: { title: "x" } }, deps),
      executeWidgetIntent({ action: "widget_clear", symbol: "ETF", slot: "all" }, deps),
      executeWidgetIntent({ action: "widget_replace", symbol: "ETF", definitions: [definition] }, deps),
    ]);
    expect(outcomes.map((outcome) => outcome.ok)).toEqual([true, true, true, true]);
    expect(addWidget).toHaveBeenCalledOnce();
    expect(updateWidget).toHaveBeenCalledOnce();
    expect(clearWidget).toHaveBeenCalledOnce();
    expect(replaceWidgets).toHaveBeenCalledOnce();
    expect(vi.mocked(addWidget).mock.calls[0]?.[1]).toBe(deps);
  });

  it("keeps clear-all changed state honest and closes config failures", async () => {
    vi.mocked(clearWidget).mockResolvedValueOnce({ ok: true, value: 0 });
    vi.mocked(addWidget).mockResolvedValueOnce({ ok: false, error: "unknown_field" });
    await expect(executeWidgetIntent({ action: "widget_clear", symbol: "ETF", slot: "all" }, deps))
      .resolves.toMatchObject({ ok: true, outcome: { changed: false } });
    await expect(executeWidgetIntent({ action: "widget_add", symbol: "ETF", definition }, deps))
      .resolves.toEqual({ ok: false });
  });

  describe("slots (WE-S)", () => {
    it("WE-S1: widget_clear with slots calls clearWidget once per slot in order", async () => {
      vi.mocked(clearWidget).mockResolvedValueOnce({ ok: true, value: 1 }).mockResolvedValueOnce({ ok: true, value: 1 });
      const result = await executeWidgetIntent({ action: "widget_clear", symbol: "ETF", slots: [1, 3] }, deps);
      expect(result).toEqual({ ok: true, outcome: { action: "widget_clear", symbol: "ETF", changed: true, slot: null, matched: 2 } });
      expect(clearWidget).toHaveBeenCalledTimes(2);
      expect(vi.mocked(clearWidget).mock.calls[0]?.[0]).toMatchObject({ slot: 1 });
      expect(vi.mocked(clearWidget).mock.calls[1]?.[0]).toMatchObject({ slot: 3 });
    });

    it("WE-S2: widget_clear with slots:[] makes no config call", async () => {
      const result = await executeWidgetIntent({ action: "widget_clear", symbol: "ETF", slots: [] }, deps);
      expect(result).toEqual({ ok: true, outcome: { action: "widget_clear", symbol: "ETF", changed: false, slot: null, matched: 0 } });
      expect(clearWidget).not.toHaveBeenCalled();
    });

    it("WE-S3: widget_update with slots:[2] calls updateWidget once; matched 1 reports the slot", async () => {
      const result = await executeWidgetIntent({ action: "widget_update", symbol: "ETF", slots: [2], changes: { title: "x" } }, deps);
      expect(result).toEqual({ ok: true, outcome: { action: "widget_update", symbol: "ETF", changed: true, slot: 2, matched: 1 } });
      expect(updateWidget).toHaveBeenCalledOnce();
    });

    it("a config failure on the 2nd slot returns ok:false", async () => {
      vi.mocked(clearWidget).mockResolvedValueOnce({ ok: true, value: 1 }).mockResolvedValueOnce({ ok: false, error: "bad_slot" });
      const result = await executeWidgetIntent({ action: "widget_clear", symbol: "ETF", slots: [1, 3] }, deps);
      expect(result).toEqual({ ok: false });
    });
  });
});
