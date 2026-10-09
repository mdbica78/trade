import { describe, expect, it, vi } from "vitest";
import { createAdapterRegistry } from "../extraction/adapters/registry";
import { availableFieldKeys, moveField, trackField, untrackField, type TrackedFieldDeps } from "./tracked-fields";

function fakeDeps(overrides: Partial<TrackedFieldDeps> = {}): TrackedFieldDeps {
  const run = vi.fn(async () => {
    throw new Error("runner should not be called for invalid input");
  });
  return {
    db: {} as TrackedFieldDeps["db"],
    run,
    registry: createAdapterRegistry([]),
    ...overrides,
  };
}

describe("availableFieldKeys (decision 7)", () => {
  it("intersects the registered adapter's fieldKeys with the catalogue keys", () => {
    const registry = createAdapterRegistry([
      { key: "a", fieldKeys: ["x", "y"], canHandle: () => false, extract: () => ({ ok: false, error: "n/a" }) },
    ]);
    expect(availableFieldKeys("a", ["x", "z"], registry)).toEqual(["x"]);
  });

  it("returns empty for a null or unregistered adapter key", () => {
    const registry = createAdapterRegistry([]);
    expect(availableFieldKeys(null, ["x"], registry)).toEqual([]);
    expect(availableFieldKeys("missing", ["x"], registry)).toEqual([]);
  });
});

describe("input validation makes zero runner calls", () => {
  it("trackField: invalid symbol / empty fieldKey", async () => {
    const deps = fakeDeps();
    expect(await trackField({ symbol: "not valid!", fieldKey: "x" }, deps)).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(await trackField({ symbol: "AAA", fieldKey: "" }, deps)).toEqual({
      ok: false,
      error: "field_not_available",
    });
    expect(deps.run).not.toHaveBeenCalled();
  });

  it("untrackField: invalid symbol / empty fieldKey", async () => {
    const deps = fakeDeps();
    expect(await untrackField({ symbol: "not valid!", fieldKey: "x" }, deps)).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(await untrackField({ symbol: "AAA", fieldKey: "" }, deps)).toEqual({
      ok: false,
      error: "not_tracked",
    });
    expect(deps.run).not.toHaveBeenCalled();
  });

  it("moveField: invalid direction is checked before symbol/fieldKey, zero runner calls", async () => {
    const deps = fakeDeps();
    expect(await moveField({ symbol: "AAA", fieldKey: "x", direction: "sideways" }, deps)).toEqual({
      ok: false,
      error: "invalid_direction",
    });
    expect(await moveField({ symbol: "not valid!", fieldKey: "x", direction: "up" }, deps)).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(deps.run).not.toHaveBeenCalled();
  });
});
