import { describe, expect, it } from "vitest";
import { moveResultToState, trackResultToState, untrackResultToState } from "./result-messages";

describe("trackResultToState (RM-1)", () => {
  it("tracked", () => {
    expect(trackResultToState({ ok: true, action: "tracked", symbol: "X" }, "x")).toEqual({
      status: "success",
      messageKey: "fieldTracked",
      values: { symbol: "X" },
    });
  });

  it("already_tracked", () => {
    expect(trackResultToState({ ok: true, action: "already_tracked", symbol: "X" }, "x")).toEqual({
      status: "success",
      messageKey: "fieldAlreadyTracked",
      values: { symbol: "X" },
    });
  });

  it("field_not_available", () => {
    expect(trackResultToState({ ok: false, error: "field_not_available" }, "X")).toEqual({
      status: "error",
      messageKey: "fieldNotAvailable",
      values: { symbol: "X" },
    });
  });

  it("not_found", () => {
    expect(trackResultToState({ ok: false, error: "not_found" }, "X")).toEqual({
      status: "error",
      messageKey: "notFound",
      values: { symbol: "X" },
    });
  });
});

describe("untrackResultToState (RM-1)", () => {
  it("ok", () => {
    expect(untrackResultToState({ ok: true, symbol: "X" }, "x")).toEqual({
      status: "success",
      messageKey: "fieldUntracked",
      values: { symbol: "X" },
    });
  });

  it("not_tracked", () => {
    expect(untrackResultToState({ ok: false, error: "not_tracked" }, "X")).toEqual({
      status: "error",
      messageKey: "fieldNotTracked",
      values: { symbol: "X" },
    });
  });

  it("not_found", () => {
    expect(untrackResultToState({ ok: false, error: "not_found" }, "X")).toEqual({
      status: "error",
      messageKey: "notFound",
      values: { symbol: "X" },
    });
  });
});

describe("moveResultToState (RM-1)", () => {
  it("moved", () => {
    expect(moveResultToState({ ok: true, moved: true, symbol: "X" }, "x")).toEqual({
      status: "success",
      messageKey: "fieldMoved",
      values: { symbol: "X" },
    });
  });

  it("not moved (already at that end)", () => {
    expect(moveResultToState({ ok: true, moved: false, symbol: "X" }, "x")).toEqual({
      status: "success",
      messageKey: "fieldNotMoved",
      values: { symbol: "X" },
    });
  });

  it("not_tracked", () => {
    expect(moveResultToState({ ok: false, error: "not_tracked" }, "X")).toEqual({
      status: "error",
      messageKey: "fieldNotTracked",
      values: { symbol: "X" },
    });
  });

  it("invalid_direction", () => {
    expect(moveResultToState({ ok: false, error: "invalid_direction" }, "X")).toEqual({
      status: "error",
      messageKey: "invalidDirection",
      values: { symbol: "X" },
    });
  });

  it("not_found", () => {
    expect(moveResultToState({ ok: false, error: "not_found" }, "X")).toEqual({
      status: "error",
      messageKey: "notFound",
      values: { symbol: "X" },
    });
  });
});
