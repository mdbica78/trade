import { describe, expect, it, vi } from "vitest";
import { hangingFetch, rejectingFetch, respondWith } from "../../test/helpers/ai-http";
import { createDefaultProviderRegistry } from "./providers/default-registry";
import { createProviderRegistry } from "./providers/registry";
import { GEMINI_MODELS_BASE_URL } from "./providers/gemini";
import { OPENAI_CHAT_COMPLETIONS_URL } from "./providers/openai-compatible";
import {
  CONNECTION_TEST_CODES,
  CONNECTION_TEST_MAX_OUTPUT_TOKENS,
  testProviderConnection,
  type ConnectionTestCode,
} from "./connection-test";
import type { ProviderDeps } from "./provider-deps";
import type { AiSettings } from "../config/ai-settings";
import { ACTIVE_PROVIDER_FAILURE_REASONS } from "./providers/resolve";
import { PROVIDER_ERROR_CODES } from "./providers/types";

const SENTINEL_KEY = "SENTINEL-CT-KEY-7af1";
const SENTINEL_RAW_BODY = "RAW-MODEL-SENTINEL";

function baseDeps(overrides: Partial<ProviderDeps> = {}): ProviderDeps {
  return {
    loadSettings: async () => ({ provider: "openai", model: "gpt-4.1" }) as AiSettings,
    loadStoredKeys: async () => new Map(),
    registry: createDefaultProviderRegistry(),
    readApiKey: () => SENTINEL_KEY,
    fetch: rejectingFetch(new Error("real network forbidden")),
    ...overrides,
  };
}

describe("testProviderConnection (CT)", () => {
  it("CT-1: ok path (openai preset, real registry, fake fetch 200)", async () => {
    const mock = respondWith(200, { choices: [{ message: { content: SENTINEL_RAW_BODY } }] });
    const deps = baseDeps({ fetch: mock });
    const result = await testProviderConnection(deps);
    expect(result).toEqual({ ok: true });
    expect(mock).toHaveBeenCalledTimes(1);
    const [url, init] = mock.mock.calls[0];
    expect(url).toBe(OPENAI_CHAT_COMPLETIONS_URL);
    const body = JSON.parse(init.body as string);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.max_completion_tokens).toBe(CONNECTION_TEST_MAX_OUTPUT_TOKENS);
    expect(body.messages[0].content).toContain("JSON");
  });

  it.each([
    [401, "auth_failed"],
    [404, "model_not_found"],
    [429, "rate_limited"],
    [500, "provider_error"],
  ] as const)("CT-2: HTTP %i -> exact closed result, no raw-body/key sentinel", async (status, code) => {
    const mock = respondWith(status, { error: SENTINEL_RAW_BODY });
    const result = await testProviderConnection(baseDeps({ fetch: mock }));
    expect(result).toEqual({ ok: false, code });
    expect(Object.keys(result).sort()).toEqual(["code", "ok"]);
    const json = JSON.stringify(result);
    expect(json).not.toContain(SENTINEL_RAW_BODY);
    expect(json).not.toContain(SENTINEL_KEY);
  });

  it("CT-3: invalid JSON / empty content -> bad_response; rejecting fetch -> network; hanging fetch with timeoutMs -> timeout", async () => {
    const badJsonMock = vi.fn(async () => new Response("not json", { status: 200 }));
    expect(await testProviderConnection(baseDeps({ fetch: badJsonMock }))).toEqual({ ok: false, code: "bad_response" });

    const emptyMock = respondWith(200, { choices: [{ message: { content: "" } }] });
    expect(await testProviderConnection(baseDeps({ fetch: emptyMock }))).toEqual({ ok: false, code: "bad_response" });

    const rejecting = rejectingFetch(new Error("boom"));
    expect(await testProviderConnection(baseDeps({ fetch: rejecting }))).toEqual({ ok: false, code: "network" });

    const hanging = hangingFetch({ honoursAbort: true });
    expect(await testProviderConnection(baseDeps({ fetch: hanging }), { timeoutMs: 5 })).toEqual({ ok: false, code: "timeout" });
  });

  it("CT-4: not_configured, unknown_provider, not_implemented, no_api_key, no_model -- fetch never called", async () => {
    const mock = respondWith(200, { choices: [{ message: { content: "x" } }] });

    expect(await testProviderConnection(baseDeps({ fetch: mock, loadSettings: async () => ({ provider: null, model: null }) }))).toEqual({
      ok: false,
      code: "not_configured",
    });
    expect(mock).not.toHaveBeenCalled();

    expect(
      await testProviderConnection(baseDeps({ fetch: mock, loadSettings: async () => ({ provider: "unknown-vendor", model: "m" }) })),
    ).toEqual({ ok: false, code: "unknown_provider" });
    expect(mock).not.toHaveBeenCalled();

    expect(
      await testProviderConnection(
        baseDeps({ fetch: mock, registry: createProviderRegistry([]), loadSettings: async () => ({ provider: "openai", model: "m" }) }),
      ),
    ).toEqual({ ok: false, code: "not_implemented" });
    expect(mock).not.toHaveBeenCalled();

    expect(await testProviderConnection(baseDeps({ fetch: mock, readApiKey: () => null }))).toEqual({ ok: false, code: "no_api_key" });
    expect(mock).not.toHaveBeenCalled();

    expect(
      await testProviderConnection(baseDeps({ fetch: mock, loadSettings: async () => ({ provider: "openai", model: "  " }) })),
    ).toEqual({ ok: false, code: "no_model" });
    expect(mock).not.toHaveBeenCalled();
  });

  it("CT-5: a stored key wins over the environment fake in the authorization header", async () => {
    const mock = respondWith(200, { choices: [{ message: { content: "x" } }] });
    const storedKey = "SENTINEL-STORED-CT-7af1";
    const deps = baseDeps({
      fetch: mock,
      readApiKey: () => "SENTINEL-ENV-CT-should-not-be-used",
      loadStoredKeys: async () => new Map([["openai", { key: storedKey, keySource: "master" as const, updatedAt: new Date() }]]),
    });
    await testProviderConnection(deps);
    const [, init] = mock.mock.calls[0];
    expect(init.headers.authorization).toBe(`Bearer ${storedKey}`);
  });

  it("CT-6: gemini settings -> URL starts with GEMINI_MODELS_BASE_URL", async () => {
    const mock = respondWith(200, { candidates: [{ content: { parts: [{ text: "x" }] } }] });
    const deps = baseDeps({ fetch: mock, loadSettings: async () => ({ provider: "gemini", model: "gemini-test" }) });
    await testProviderConnection(deps);
    const [url] = mock.mock.calls[0];
    expect((url as string).startsWith(GEMINI_MODELS_BASE_URL)).toBe(true);
  });

  it("CT-7: exactly one fetch call for success and for every failure", async () => {
    for (const status of [200, 401, 404, 429, 500]) {
      const mock =
        status === 200 ? respondWith(200, { choices: [{ message: { content: "x" } }] }) : respondWith(status, { error: "x" });
      await testProviderConnection(baseDeps({ fetch: mock }));
      expect(mock).toHaveBeenCalledTimes(1);
    }
  });

  it("CT-8: a rejecting loadSettings rejects (propagates) and calls no fetch", async () => {
    const mock = respondWith(200, { choices: [{ message: { content: "x" } }] });
    const deps = baseDeps({
      fetch: mock,
      loadSettings: async () => {
        throw new Error("db down");
      },
    });
    await expect(testProviderConnection(deps)).rejects.toThrow("db down");
    expect(mock).not.toHaveBeenCalled();
  });

  it("CT-9: CONNECTION_TEST_CODES has 13 unique entries equal to failure reasons union provider error codes", () => {
    const expected = new Set<ConnectionTestCode>([...ACTIVE_PROVIDER_FAILURE_REASONS, ...PROVIDER_ERROR_CODES]);
    expect(new Set(CONNECTION_TEST_CODES)).toEqual(expected);
    expect(CONNECTION_TEST_CODES.length).toBe(13);
    expect(new Set(CONNECTION_TEST_CODES).size).toBe(CONNECTION_TEST_CODES.length);
  });
});
