import { describe, expect, it, vi } from "vitest";
import { createAdapterRegistry } from "./registry";
import { REGISTERED_ADAPTERS, defaultAdapterRegistry } from "./default-registry";
import type { ExtractionAdapter, ExtractionResult } from "./types";

function fakeAdapter(opts: { key: string; fieldKeys: readonly string[]; marker: string }): ExtractionAdapter {
  return {
    key: opts.key,
    fieldKeys: opts.fieldKeys,
    canHandle: vi.fn((text: string) => text.includes(opts.marker)),
    extract: vi.fn((): ExtractionResult => ({ ok: false, error: "fake" })),
  };
}

describe("get (AC2)", () => {
  it("returns the registered adapter by exact key identity", () => {
    const fakeA = fakeAdapter({ key: "fake-a", fieldKeys: ["x"], marker: "A" });
    const fakeB = fakeAdapter({ key: "fake-b", fieldKeys: ["y"], marker: "B" });
    const registry = createAdapterRegistry([fakeA, fakeB]);
    expect(registry.get("fake-a")).toBe(fakeA);
    expect(registry.get("fake-b")).toBe(fakeB);
  });

  it.each([null, undefined, "unknown-key", "", "FAKE-A", " fake-a", "fake-a ", "constructor", "__proto__", "toString", "hasOwnProperty"])(
    "returns undefined and never throws for key=%s",
    (key) => {
      const fakeA = fakeAdapter({ key: "fake-a", fieldKeys: ["x"], marker: "A" });
      const registry = createAdapterRegistry([fakeA]);
      expect(() => registry.get(key)).not.toThrow();
      expect(registry.get(key)).toBeUndefined();
    },
  );

  it("returns undefined from an empty registry even for a plausible key", () => {
    const registry = createAdapterRegistry([]);
    expect(registry.get("fake-a")).toBeUndefined();
  });

  it("never calls canHandle or extract", () => {
    const fakeA = fakeAdapter({ key: "fake-a", fieldKeys: ["x"], marker: "A" });
    const registry = createAdapterRegistry([fakeA]);
    registry.get("fake-a");
    registry.get("unknown");
    expect(fakeA.canHandle).not.toHaveBeenCalled();
    expect(fakeA.extract).not.toHaveBeenCalled();
  });
});

describe("duplicate key (AC3)", () => {
  it("throws naming the key when two adapters share it", () => {
    const fakeA = fakeAdapter({ key: "fake-a", fieldKeys: ["x"], marker: "A" });
    const fakeA2 = fakeAdapter({ key: "fake-a", fieldKeys: ["z"], marker: "A2" });
    expect(() => createAdapterRegistry([fakeA, fakeA2])).toThrow(/duplicate.*"fake-a"/i);
  });

  it("throws when the duplicate is in positions 1 and 3", () => {
    const fakeA = fakeAdapter({ key: "fake-a", fieldKeys: ["x"], marker: "A" });
    const fakeB = fakeAdapter({ key: "fake-b", fieldKeys: ["y"], marker: "B" });
    const fakeA2 = fakeAdapter({ key: "fake-a", fieldKeys: ["z"], marker: "A2" });
    expect(() => createAdapterRegistry([fakeA, fakeB, fakeA2])).toThrow(/duplicate.*"fake-a"/i);
  });

  it("throws on an empty key", () => {
    const fakeEmpty = fakeAdapter({ key: "", fieldKeys: ["x"], marker: "A" });
    expect(() => createAdapterRegistry([fakeEmpty])).toThrow();
  });

  it("throws on a whitespace-only key", () => {
    const fakeBlank = fakeAdapter({ key: "   ", fieldKeys: ["x"], marker: "A" });
    expect(() => createAdapterRegistry([fakeBlank])).toThrow();
  });

  it("throws when an adapter's fieldKeys repeats a key", () => {
    const fakeDup = fakeAdapter({ key: "fake-a", fieldKeys: ["x", "x"], marker: "A" });
    expect(() => createAdapterRegistry([fakeDup])).toThrow(/fake-a.*x/i);
  });
});

describe("detect (AC4)", () => {
  it("returns the single claimant", () => {
    const fakeA = fakeAdapter({ key: "fake-a", fieldKeys: ["x"], marker: "A" });
    const fakeB = fakeAdapter({ key: "fake-b", fieldKeys: ["y"], marker: "B" });
    const registry = createAdapterRegistry([fakeA, fakeB]);
    expect(registry.detect("contains A only")).toBe(fakeA);
  });

  it("returns undefined when no adapter claims the text", () => {
    const fakeA = fakeAdapter({ key: "fake-a", fieldKeys: ["x"], marker: "A" });
    const fakeB = fakeAdapter({ key: "fake-b", fieldKeys: ["y"], marker: "B" });
    const registry = createAdapterRegistry([fakeA, fakeB]);
    expect(registry.detect("contains neither")).toBeUndefined();
  });

  it("returns undefined when two adapters both claim the text", () => {
    const fakeA = fakeAdapter({ key: "fake-a", fieldKeys: ["x"], marker: "A" });
    const fakeB = fakeAdapter({ key: "fake-b", fieldKeys: ["y"], marker: "B" });
    const registry = createAdapterRegistry([fakeA, fakeB]);
    expect(registry.detect("contains A and B")).toBeUndefined();
  });

  it("returns undefined when two of three adapters claim the text", () => {
    const fakeA = fakeAdapter({ key: "fake-a", fieldKeys: ["x"], marker: "A" });
    const fakeB = fakeAdapter({ key: "fake-b", fieldKeys: ["y"], marker: "B" });
    const fakeC = fakeAdapter({ key: "fake-c", fieldKeys: ["z"], marker: "C" });
    const registry = createAdapterRegistry([fakeA, fakeB, fakeC]);
    expect(registry.detect("contains A and C")).toBeUndefined();
  });

  it("returns undefined from an empty registry", () => {
    const registry = createAdapterRegistry([]);
    expect(registry.detect("anything")).toBeUndefined();
  });

  it("calls every adapter's canHandle exactly once, even after a match", () => {
    const fakeA = fakeAdapter({ key: "fake-a", fieldKeys: ["x"], marker: "A" });
    const fakeB = fakeAdapter({ key: "fake-b", fieldKeys: ["y"], marker: "B" });
    const fakeC = fakeAdapter({ key: "fake-c", fieldKeys: ["z"], marker: "C" });
    const registry = createAdapterRegistry([fakeA, fakeB, fakeC]);
    registry.detect("contains A only");
    expect(fakeA.canHandle).toHaveBeenCalledTimes(1);
    expect(fakeB.canHandle).toHaveBeenCalledTimes(1);
    expect(fakeC.canHandle).toHaveBeenCalledTimes(1);
    expect(fakeA.canHandle).toHaveBeenCalledWith("contains A only");
  });

  it("never calls extract", () => {
    const fakeA = fakeAdapter({ key: "fake-a", fieldKeys: ["x"], marker: "A" });
    const registry = createAdapterRegistry([fakeA]);
    registry.detect("contains A only");
    expect(fakeA.extract).not.toHaveBeenCalled();
  });
});

describe("default registry", () => {
  it("importing does not throw and list() matches REGISTERED_ADAPTERS", () => {
    expect(defaultAdapterRegistry.list()).toEqual(REGISTERED_ADAPTERS);
  });

  it("get returns undefined for null/undefined/unknown", () => {
    expect(defaultAdapterRegistry.get(null)).toBeUndefined();
    expect(defaultAdapterRegistry.get(undefined)).toBeUndefined();
    expect(defaultAdapterRegistry.get("unknown-key")).toBeUndefined();
  });
});

describe("registry immutability", () => {
  it("mutating the input array after creation does not change the registry", () => {
    const fakeA = fakeAdapter({ key: "fake-a", fieldKeys: ["x"], marker: "A" });
    const input = [fakeA];
    const registry = createAdapterRegistry(input);
    const fakeB = fakeAdapter({ key: "fake-b", fieldKeys: ["y"], marker: "B" });
    input.push(fakeB);
    expect(registry.get("fake-b")).toBeUndefined();
    expect(registry.list()).toHaveLength(1);
  });

  it("list() returns a frozen array", () => {
    const fakeA = fakeAdapter({ key: "fake-a", fieldKeys: ["x"], marker: "A" });
    const registry = createAdapterRegistry([fakeA]);
    expect(Object.isFrozen(registry.list())).toBe(true);
  });
});
