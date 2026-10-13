import { describe, expect, it } from "vitest";
import { cronHourResultToState } from "./result-messages";

describe("cronHourResultToState (CR)", () => {
  it("CR-1: ok with apply:unchanged -> cronSaved", () => {
    expect(cronHourResultToState({ ok: true, hour: 7, apply: "unchanged" })).toEqual({
      status: "success",
      messageKey: "cronSaved",
    });
  });

  it("invalid_hour", () => {
    expect(cronHourResultToState({ ok: false, error: "invalid_hour" })).toEqual({
      status: "error",
      messageKey: "invalidHour",
    });
  });

  it("CR-2: ok with apply:applying -> cronSavedApplying", () => {
    expect(cronHourResultToState({ ok: true, hour: 7, apply: "applying" })).toEqual({
      status: "success",
      messageKey: "cronSavedApplying",
    });
  });

  it("CR-3: ok with apply:not_configured -> cronSavedNotConfigured", () => {
    expect(cronHourResultToState({ ok: true, hour: 7, apply: "not_configured" })).toEqual({
      status: "success",
      messageKey: "cronSavedNotConfigured",
    });
  });

  it("CR-4: ok with apply:failed -> cronSavedApplyFailed", () => {
    expect(cronHourResultToState({ ok: true, hour: 7, apply: "failed" })).toEqual({
      status: "success",
      messageKey: "cronSavedApplyFailed",
    });
  });
});
