import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import ro from "../../../messages/ro.json";
import {
  aiSettingsResultToState,
  connectionTestResultToState,
  customProviderResultToState,
  providerKeyResultToState,
} from "./result-messages";
import { CONNECTION_TEST_CODES } from "@/lib/ai/connection-test";

describe("aiSettingsResultToState (RM-1)", () => {
  it("ok with a provider -> aiSaved", () => {
    expect(aiSettingsResultToState({ ok: true, provider: "groq", model: "m" })).toEqual({
      status: "success",
      messageKey: "aiSaved",
    });
  });

  it("ok with no provider -> aiCleared", () => {
    expect(aiSettingsResultToState({ ok: true, provider: null, model: null })).toEqual({
      status: "success",
      messageKey: "aiCleared",
    });
  });

  it("unknown_provider", () => {
    expect(aiSettingsResultToState({ ok: false, error: "unknown_provider" })).toEqual({
      status: "error",
      messageKey: "unknownProvider",
    });
  });

  it("invalid_model", () => {
    expect(aiSettingsResultToState({ ok: false, error: "invalid_model" })).toEqual({
      status: "error",
      messageKey: "invalidModel",
    });
  });

  it("RM-1: every message key exists in both catalogues", () => {
    const keys = ["aiSaved", "aiCleared", "unknownProvider", "invalidModel"] as const;
    for (const key of keys) {
      expect(typeof ro.Admin.messages[key]).toBe("string");
      expect(typeof en.Admin.messages[key]).toBe("string");
    }
  });

  it("RM-2: invalidModel states the length limit (200) in both catalogues", () => {
    expect(ro.Admin.messages.invalidModel).toContain("200");
    expect(en.Admin.messages.invalidModel).toContain("200");
  });

  it("provider-key success results map to saved and cleared messages", () => {
    expect(providerKeyResultToState({ ok: true }, "save")).toEqual({
      status: "success",
      messageKey: "providerKeySaved",
    });
    expect(providerKeyResultToState({ ok: true }, "clear")).toEqual({
      status: "success",
      messageKey: "providerKeyCleared",
    });
  });

  it.each([
    ["unknown_provider", "unknownProvider"],
    ["key_invalid", "providerKeyInvalid"],
    ["storing_disabled", "providerKeyStorageDisabled"],
    ["write_failed", "providerKeyWriteFailed"],
  ] as const)("provider-key error %s maps to the closed translated result", (error, messageKey) => {
    expect(providerKeyResultToState({ ok: false, error }, "save")).toEqual({
      status: "error",
      messageKey,
    });
  });

  it("RM-3: all provider-key action messages exist in Romanian and English", () => {
    const keys = [
      "providerKeySaved",
      "providerKeyCleared",
      "providerKeyInvalid",
      "providerKeyStorageDisabled",
      "providerKeyWriteFailed",
    ] as const;
    for (const key of keys) {
      expect(typeof ro.Admin.messages[key]).toBe("string");
      expect(typeof en.Admin.messages[key]).toBe("string");
    }
  });

  it("RM-C1 (US-056): an ok connection test result maps to connectionOk", () => {
    expect(connectionTestResultToState({ ok: true })).toEqual({ status: "success", messageKey: "connectionOk" });
  });

  it.each(CONNECTION_TEST_CODES)("RM-C2 (US-056): connection test code %s maps to the exact closed state", (code) => {
    expect(connectionTestResultToState({ ok: false, code })).toEqual({
      status: "error",
      messageKey: "connectionFailed",
      values: { code },
    });
  });

  it("RM-CP1 (US-057): every ok custom-provider result maps to its exact state", () => {
    expect(customProviderResultToState({ ok: true, id: "custom-1", keyRemoved: false }, "add")).toEqual({
      status: "success",
      messageKey: "customProviderAdded",
    });
    expect(customProviderResultToState({ ok: true, id: "custom-1", keyRemoved: false }, "update")).toEqual({
      status: "success",
      messageKey: "customProviderUpdated",
    });
    expect(customProviderResultToState({ ok: true, id: "custom-1", keyRemoved: true }, "update")).toEqual({
      status: "success",
      messageKey: "customProviderUpdatedKeyRemoved",
    });
    expect(customProviderResultToState({ ok: true, id: "custom-1", keyRemoved: true }, "delete")).toEqual({
      status: "success",
      messageKey: "customProviderDeleted",
    });
  });

  it.each([
    ["invalid_name", "customProviderInvalidName"],
    ["invalid_url", "customProviderInvalidUrl"],
    ["limit_reached", "customProviderLimitReached"],
    ["not_found", "customProviderNotFound"],
  ] as const)("RM-CP2 (US-057): custom-provider error %s maps to the closed translated result", (error, messageKey) => {
    expect(customProviderResultToState({ ok: false, error }, "add")).toEqual({ status: "error", messageKey });
  });

  it("RM-CP3 (US-057): every custom-provider message key exists in both catalogues", () => {
    const keys = [
      "customProviderAdded",
      "customProviderUpdated",
      "customProviderUpdatedKeyRemoved",
      "customProviderDeleted",
      "customProviderInvalidName",
      "customProviderInvalidUrl",
      "customProviderLimitReached",
      "customProviderNotFound",
    ] as const;
    for (const key of keys) {
      expect(typeof ro.Admin.messages[key]).toBe("string");
      expect(typeof en.Admin.messages[key]).toBe("string");
    }
  });
});
