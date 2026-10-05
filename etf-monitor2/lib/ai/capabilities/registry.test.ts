import { beforeEach, describe, expect, it, vi } from "vitest";
import { CAPABILITY_REGISTRY, getCapability } from "./registry";
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
    expect(Object.keys(CAPABILITY_REGISTRY)).toEqual(["configuration", "widgets"]);
    expect(Object.keys(CAPABILITY_REGISTRY)).toHaveLength(2);
    expect(getCapability("configuration").actions).toEqual(CONFIGURATION_ACTIONS);
    expect(getCapability("widgets").actions).toEqual(WIDGET_ACTIONS);
    expect(WIDGET_ACTIONS).toEqual(["widget_add", "widget_update", "widget_clear", "widget_replace"]);
  });

});
