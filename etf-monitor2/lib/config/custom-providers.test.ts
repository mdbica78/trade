import { describe, expect, it, vi } from "vitest";
import type { Db } from "../db/index";
import type { BatchRunner } from "../ingestion/store";
import { PROVIDER_IDS } from "../ai/provider-catalog";
import {
  addCustomProvider,
  customProviderId,
  deleteCustomProvider,
  isCustomProviderId,
  listCustomProviders,
  updateCustomProvider,
  validateCustomProviderBaseUrl,
  validateCustomProviderName,
  type CustomProviderConfigDeps,
  type CustomProviderReadDeps,
} from "./custom-providers";

function fakeDeps(run: BatchRunner): CustomProviderReadDeps & CustomProviderConfigDeps {
  return {
    db: { execute: (q: unknown) => q } as unknown as Db,
    run,
    clearKeyStatement: (providerId: string) => ({ __clearKeyFor: providerId }) as unknown as ReturnType<Db["execute"]>,
  };
}

describe("validateCustomProviderBaseUrl (CPV-1..3)", () => {
  it.each([
    ["https://api.example.com/v1"],
    ["https://api.example.com/v1/"],
    ["  https://API.Example.com/openai/v1  "],
    ["https://llm.example.co.uk"],
    ["https://api.example.com:8443/v1"],
  ])("CPV-1 accepts %s", (input) => {
    expect(validateCustomProviderBaseUrl(input).ok).toBe(true);
  });

  it.each([
    ["http://api.example.com/v1"],
    ["ftp://api.example.com"],
    ["javascript:alert(1)"],
    ["api.example.com/v1"],
    ["https:///v1"],
    ["https://api.exa mple.com"],
    [""],
    ["   "],
    [null],
    [42],
    ["https://user:pass@api.example.com/v1"],
    ["https://user@api.example.com"],
    ["https://api.example.com/v1?x=1"],
    ["https://api.example.com/v1?"],
    ["https://api.example.com/v1#f"],
    ["https://api.example.com/v1#"],
    ["https://127.0.0.1/v1"],
    ["https://10.0.0.5"],
    ["https://192.168.1.10"],
    ["https://169.254.169.254"],
    ["https://2130706433/"],
    ["https://0x7f.0.0.1/"],
    ["https://[::1]/v1"],
    ["https://[2001:db8::1]/"],
    ["https://localhost/v1"],
    ["https://localhost./v1"],
    ["https://api.localhost"],
    ["https://printer.local"],
    ["https://llm.internal/v1"],
    ["https://router.lan"],
    ["https://nas.home.arpa"],
    ["https://box.corp"],
    ["https://intranet/v1"],
    ["https://api.example.com./v1"],
    [`https://${"a".repeat(195)}.com`],
  ])("CPV-1 rejects %s", (input) => {
    expect(validateCustomProviderBaseUrl(input).ok).toBe(false);
  });

  it("CPV-2: normalises case, default port and trailing slashes", () => {
    const result = validateCustomProviderBaseUrl("https://API.Example.com:443/v1//");
    expect(result.ok && result.url).toBe("https://api.example.com/v1");
  });

  it("CPV-3: exactly 200 chars accepted, 201 rejected (measured on the normalised value)", () => {
    const host = "https://api.example.com/";
    const path = "a".repeat(200 - host.length);
    const url200 = `${host}${path}`;
    expect(url200.length).toBe(200);
    expect(validateCustomProviderBaseUrl(url200).ok).toBe(true);

    const url201 = `${host}${path}a`;
    expect(url201.length).toBe(201);
    expect(validateCustomProviderBaseUrl(url201).ok).toBe(false);
  });
});

describe("validateCustomProviderName (CPV-4)", () => {
  it.each([
    ["Groq", "Groq"],
    ["  My LLM  ", "My LLM"],
  ])("CPV-4 accepts %s -> %s", (input, expected) => {
    const result = validateCustomProviderName(input);
    expect(result.ok && result.name).toBe(expected);
  });

  it.each([[""], ["a".repeat(41)], ["a\u0007b"], [null], [42]])("CPV-4 rejects %s", (input) => {
    expect(validateCustomProviderName(input).ok).toBe(false);
  });
});

describe("isCustomProviderId / customProviderId (CPV-5)", () => {
  it("accepts custom-1, rejects malformed ids and never collides with a catalogue id", () => {
    expect(isCustomProviderId("custom-1")).toBe(true);
    expect(isCustomProviderId("custom-0")).toBe(false);
    expect(isCustomProviderId("custom-")).toBe(false);
    expect(isCustomProviderId("custom-1x")).toBe(false);
    expect(isCustomProviderId("gemini")).toBe(false);
    expect(isCustomProviderId("Custom-1")).toBe(false);
    for (const id of PROVIDER_IDS) {
      expect(isCustomProviderId(id)).toBe(false);
    }
  });

  it("customProviderId builds the custom- prefix", () => {
    expect(customProviderId(3)).toBe("custom-3");
  });
});

describe("addCustomProvider (CPC-1)", () => {
  it("CPC-1: calls run with one insert statement and maps a missing row to limit_reached", async () => {
    const run = vi.fn(async (statements: readonly unknown[]) => statements.map(() => []));
    const result = await addCustomProvider({ name: "Groq", baseUrl: "https://api.example.com/v1" }, fakeDeps(run));
    expect(run).toHaveBeenCalledTimes(1);
    expect((run.mock.calls[0]?.[0] as unknown[]).length).toBe(1);
    expect(result).toEqual({ ok: false, error: "limit_reached" });
  });

  it("CPC-1b: a returned id gives an ok result with no key removed", async () => {
    const run = vi.fn(async (statements: readonly unknown[]) => statements.map(() => [{ id: 7 }]));
    const result = await addCustomProvider({ name: "Groq", baseUrl: "https://api.example.com/v1" }, fakeDeps(run));
    expect(result).toEqual({ ok: true, id: "custom-7", keyRemoved: false });
  });
});

describe("updateCustomProvider (CPC-2/CPC-3)", () => {
  it("CPC-2: a URL change gives one run call with 2 statements, the first the key delete", async () => {
    const run = vi.fn(async (statements: readonly unknown[]) => {
      if (statements.length === 1) return [[{ base_url: "https://old.example.com/v1" }]];
      return statements.map(() => [{ id: 3 }]);
    });
    const deps = fakeDeps(run);
    const result = await updateCustomProvider(
      { id: "custom-3", name: "Groq", baseUrl: "https://new.example.com/v1" },
      deps,
    );
    expect(result).toEqual({ ok: true, id: "custom-3", keyRemoved: true });
    const updateCall = run.mock.calls[1]?.[0] as unknown[];
    expect(updateCall.length).toBe(2);
    expect(updateCall[0]).toEqual({ __clearKeyFor: "custom-3" });
  });

  it("CPC-3: a name-only edit, or a URL differing only by case/trailing slash, gives 1 statement and keyRemoved: false", async () => {
    let callIndex = 0;
    const run = vi.fn(async (statements: readonly unknown[]) => {
      callIndex += 1;
      if (callIndex === 1) return [[{ base_url: "https://api.example.com/v1" }]];
      return statements.map(() => [{ id: 3 }]);
    });
    const deps = fakeDeps(run);
    const result = await updateCustomProvider(
      { id: "custom-3", name: "New Name", baseUrl: "https://API.Example.com:443/v1/" },
      deps,
    );
    expect(result).toEqual({ ok: true, id: "custom-3", keyRemoved: false });
    const updateCall = run.mock.calls[1]?.[0] as unknown[];
    expect(updateCall.length).toBe(1);
  });
});

describe("deleteCustomProvider (CPC-4)", () => {
  it("CPC-4: one run call with 2 statements, the first the key delete", async () => {
    const run = vi.fn(async (statements: readonly unknown[]) => statements.map(() => [{ id: 5 }]));
    const result = await deleteCustomProvider("custom-5", fakeDeps(run));
    expect(result).toEqual({ ok: true, id: "custom-5", keyRemoved: true });
    expect(run).toHaveBeenCalledTimes(1);
    const call = run.mock.calls[0]?.[0] as unknown[];
    expect(call.length).toBe(2);
    expect(call[0]).toEqual({ __clearKeyFor: "custom-5" });
  });

  it("CPC-4b: an unknown id returns not_found without calling run", async () => {
    const run = vi.fn();
    const result = await deleteCustomProvider("custom-9999999999999", fakeDeps(run));
    expect(result).toEqual({ ok: false, error: "not_found" });
    expect(run).not.toHaveBeenCalled();
  });
});

describe("invalid input never calls run or clearKeyStatement (CPC-5)", () => {
  it("add: invalid name/url", async () => {
    const run = vi.fn();
    expect(await addCustomProvider({ name: "", baseUrl: "https://a.example.com" }, fakeDeps(run))).toEqual({
      ok: false,
      error: "invalid_name",
    });
    expect(await addCustomProvider({ name: "ok", baseUrl: "http://a.example.com" }, fakeDeps(run))).toEqual({
      ok: false,
      error: "invalid_url",
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("update: invalid id/name/url", async () => {
    const run = vi.fn();
    expect(
      await updateCustomProvider({ id: "not-an-id", name: "ok", baseUrl: "https://a.example.com" }, fakeDeps(run)),
    ).toEqual({ ok: false, error: "not_found" });
    expect(
      await updateCustomProvider({ id: "custom-1", name: "", baseUrl: "https://a.example.com" }, fakeDeps(run)),
    ).toEqual({ ok: false, error: "invalid_name" });
    expect(
      await updateCustomProvider({ id: "custom-1", name: "ok", baseUrl: "http://a.example.com" }, fakeDeps(run)),
    ).toEqual({ ok: false, error: "invalid_url" });
    expect(run).not.toHaveBeenCalled();
  });

  it("delete: invalid id", async () => {
    const run = vi.fn();
    expect(await deleteCustomProvider("gemini", fakeDeps(run))).toEqual({ ok: false, error: "not_found" });
    expect(run).not.toHaveBeenCalled();
  });
});

describe("listCustomProviders error handling (CPC-6)", () => {
  it("CPC-6: a 42P01 failure returns [] silently; any other error propagates", async () => {
    const run42 = vi.fn(async () => {
      throw Object.assign(new Error("missing relation"), { code: "42P01" });
    });
    expect(await listCustomProviders(fakeDeps(run42))).toEqual([]);

    const runOther = vi.fn(async () => {
      throw new Error("connection reset");
    });
    await expect(listCustomProviders(fakeDeps(runOther))).rejects.toThrow("connection reset");
  });

  it("lists only rows that pass validation and whose normalised URL equals the stored value", async () => {
    const run = vi.fn(async () => [
      [
        { id: 1, name: "Groq", base_url: "https://api.example.com/v1" },
        { id: 2, name: "Bad", base_url: "http://api.example.com/v1" },
        { id: 3, name: "", base_url: "https://api.example.com/v1" },
        { id: 4, name: "Reencoded", base_url: "https://API.example.com:443/v1/" },
      ],
    ]);
    const result = await listCustomProviders(fakeDeps(run));
    expect(result).toEqual([{ id: "custom-1", name: "Groq", baseUrl: "https://api.example.com/v1" }]);
  });
});
