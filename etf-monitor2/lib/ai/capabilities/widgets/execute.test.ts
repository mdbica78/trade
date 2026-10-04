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
});
