import { beforeEach, describe, expect, it, vi } from "vitest";
import { CAPABILITY_IDS, CAPABILITY_REGISTRY, getCapability } from "./registry";
import { CONFIGURATION_ACTIONS } from "./configuration/intent";
import { WIDGET_ACTIONS } from "./widgets/capability";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("real network forbidden");
    }),
  );
});

describe("capability registry (CR)", () => {
  it("CR-1: registers exactly configuration and widget capabilities with their closed action sets", () => {
    expect(CAPABILITY_IDS).toEqual(["configuration", "widgets"]);
    expect(Object.keys(CAPABILITY_REGISTRY)).toHaveLength(2);
    expect(getCapability("configuration").actions).toEqual(CONFIGURATION_ACTIONS);
    expect(getCapability("widgets").actions).toEqual(WIDGET_ACTIONS);
    expect(WIDGET_ACTIONS).toEqual(["widget_add", "widget_update", "widget_clear", "widget_replace"]);
  });

  it("CR-2: every registry key equals its capability's id", () => {
    for (const [key, capability] of Object.entries(CAPABILITY_REGISTRY)) {
      expect(capability.id).toBe(key);
    }
  });

});
