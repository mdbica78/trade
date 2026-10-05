import { describe, expect, it } from "vitest";
import { comparePanelColumns } from "./panel-order";

describe("PO-1 (US-050 B1): comparePanelColumns", () => {
  it("positioned columns sort before unpositioned ones, then by position, then by catalogueOrder", () => {
    const list = [
      { position: null, catalogueOrder: 0 },
      { position: 1, catalogueOrder: 5 },
      { position: 0, catalogueOrder: 3 },
      { position: null, catalogueOrder: -1 },
    ];
    const sorted = [...list].sort(comparePanelColumns);
    expect(sorted).toEqual([
      { position: 0, catalogueOrder: 3 },
      { position: 1, catalogueOrder: 5 },
      { position: null, catalogueOrder: -1 },
      { position: null, catalogueOrder: 0 },
    ]);
  });
});
