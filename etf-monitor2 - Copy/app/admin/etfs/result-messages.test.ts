import { describe, expect, it } from "vitest";
import {
  addResultToState,
  detectResultToState,
  setActiveResultToState,
  setAdapterResultToState,
} from "./result-messages";

describe("addResultToState (AR-1)", () => {
  it("added with an adapter", () => {
    expect(
      addResultToState({ ok: true, action: "added", symbol: "X", adapterKey: "brd-depositary", reason: "detected" }, "X"),
    ).toEqual({ status: "success", messageKey: "added", values: { symbol: "X", adapter: "brd-depositary" } });
  });

  it("added with no adapter", () => {
    expect(
      addResultToState({ ok: true, action: "added", symbol: "X", adapterKey: null, reason: "no_match" }, "X"),
    ).toEqual({ status: "success", messageKey: "addedNoAdapter", values: { symbol: "X" } });
  });

  it("reactivated", () => {
    expect(addResultToState({ ok: true, action: "reactivated", symbol: "X" }, "X")).toEqual({
      status: "success",
      messageKey: "reactivated",
      values: { symbol: "X" },
    });
  });

  it("invalid_symbol", () => {
    expect(addResultToState({ ok: false, error: "invalid_symbol" }, "bad symbol")).toEqual({
      status: "error",
      messageKey: "invalidSymbol",
      values: undefined,
    });
  });

  it("invalid_name", () => {
    expect(addResultToState({ ok: false, error: "invalid_name" }, "X")).toEqual({
      status: "error",
      messageKey: "invalidName",
      values: undefined,
    });
  });

  it("already_monitored carries the symbol", () => {
    expect(addResultToState({ ok: false, error: "already_monitored" }, "X")).toEqual({
      status: "error",
      messageKey: "alreadyMonitored",
      values: { symbol: "X" },
    });
  });
});

describe("setActiveResultToState", () => {
  it("deactivated", () => {
    expect(setActiveResultToState({ ok: true }, "X", false)).toEqual({
      status: "success",
      messageKey: "deactivated",
      values: { symbol: "X" },
    });
  });
  it("activated", () => {
    expect(setActiveResultToState({ ok: true }, "X", true)).toEqual({
      status: "success",
      messageKey: "activated",
      values: { symbol: "X" },
    });
  });
  it("not_found", () => {
    expect(setActiveResultToState({ ok: false, error: "not_found" }, "X", true)).toEqual({
      status: "error",
      messageKey: "notFound",
      values: { symbol: "X" },
    });
  });
});

describe("setAdapterResultToState", () => {
  it("ok", () => {
    expect(setAdapterResultToState({ ok: true }, "X")).toEqual({
      status: "success",
      messageKey: "adapterSet",
      values: { symbol: "X" },
    });
  });
  it("unknown_adapter", () => {
    expect(setAdapterResultToState({ ok: false, error: "unknown_adapter" }, "X")).toEqual({
      status: "error",
      messageKey: "unknownAdapter",
      values: { symbol: "X" },
    });
  });
  it("not_found", () => {
    expect(setAdapterResultToState({ ok: false, error: "not_found" }, "X")).toEqual({
      status: "error",
      messageKey: "notFound",
      values: { symbol: "X" },
    });
  });
});

describe("detectResultToState", () => {
  it("detected", () => {
    expect(detectResultToState({ ok: true, adapterKey: "brd-depositary", reason: "detected" }, "X")).toEqual({
      status: "success",
      messageKey: "detected",
      values: { symbol: "X", adapter: "brd-depositary" },
      reason: undefined,
    });
  });
  it("cleared to null with a reason", () => {
    expect(detectResultToState({ ok: true, adapterKey: null, reason: "fetch_error" }, "X")).toEqual({
      status: "success",
      messageKey: "notDetected",
      values: { symbol: "X" },
      reason: "fetch_error",
    });
  });
  it("not_found", () => {
    expect(detectResultToState({ ok: false, error: "not_found" }, "X")).toEqual({
      status: "error",
      messageKey: "notFound",
      values: { symbol: "X" },
    });
  });
});
