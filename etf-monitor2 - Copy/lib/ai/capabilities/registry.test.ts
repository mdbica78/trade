import { beforeEach, describe, expect, it, vi } from "vitest";
import { CAPABILITY_IDS, CAPABILITY_REGISTRY, getCapability } from "./registry";
import { interpretConfigurationRequest } from "./configuration/interpret";
import { buildTestContext, cannedGenerate } from "../../../test/helpers/ai-config-context";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("real network forbidden");
    }),
  );
});

describe("capability registry (CR)", () => {
  it("CR-1: CAPABILITY_IDS is exactly configuration", () => {
    expect(CAPABILITY_IDS).toEqual(["configuration"]);
    expect(Object.keys(CAPABILITY_REGISTRY)).toHaveLength(1);
  });

  it("CR-2: every registry key equals its capability's id", () => {
    for (const [key, capability] of Object.entries(CAPABILITY_REGISTRY)) {
      expect(capability.id).toBe(key);
    }
  });

  it("CR-3: getCapability('configuration').run matches interpretConfigurationRequest directly, one generate call", async () => {
    const context = buildTestContext();
    const text = '{"action":"add_etf","symbol":"XYZ","name":null}';

    const viaRegistry = await getCapability("configuration").run(
      { message: "add ETF XYZ", context },
      cannedGenerate(text),
    );
    const direct = await interpretConfigurationRequest("add ETF XYZ", context, cannedGenerate(text));

    expect(viaRegistry).toEqual(direct);
    expect(viaRegistry).toEqual({ kind: "intent", intent: { action: "add_etf", symbol: "XYZ", name: null } });
  });
});
