import { describe, expect, it } from "vitest";
import { cronHourResultToState } from "./result-messages";

describe("cronHourResultToState (CR-1)", () => {
  it("ok with a number -> cronSaved", () => {
    expect(cronHourResultToState({ ok: true, hour: 7 })).toEqual({ status: "success", messageKey: "cronSaved" });
  });

  it("ok with null -> cronCleared", () => {
    expect(cronHourResultToState({ ok: true, hour: null })).toEqual({ status: "success", messageKey: "cronCleared" });
  });

  it("invalid_hour", () => {
    expect(cronHourResultToState({ ok: false, error: "invalid_hour" })).toEqual({
      status: "error",
      messageKey: "invalidHour",
    });
  });
});
