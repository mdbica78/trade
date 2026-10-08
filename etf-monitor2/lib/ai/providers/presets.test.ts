import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { callCtx, respondWith } from "../../../test/helpers/ai-http";
import { PROVIDER_IDS } from "../provider-catalog";
import {
  OPENAI_COMPATIBLE_PRESETS,
  OPENAI_COMPATIBLE_PRESET_ADAPTERS,
} from "./openai-compatible";
import type { GenerateRequest } from "./types";

const SENTINEL_KEY = "SENTINEL-PRESET-KEY-9c1f";
const MODEL = "preset-test-model";

function request(overrides: { maxOutputTokens?: number } = {}): GenerateRequest {
  return {
    system: "sys prompt",
    messages: [{ role: "user", content: "user prompt" }],
    format: "none",
    maxOutputTokens: overrides.maxOutputTokens ?? 256,
  };
}

describe("OPENAI_COMPATIBLE_PRESETS (PS)", () => {
  it("PS-0: preset ids equal PROVIDER_IDS minus gemini/groq, same order", () => {
    const presetIds = OPENAI_COMPATIBLE_PRESETS.map((p) => p.id);
    const expected = PROVIDER_IDS.filter((id) => id !== "gemini" && id !== "groq");
    expect(presetIds).toEqual(expected);
  });

  it("PS-1: each preset's URL is https, no credentials, no query/fragment, hostname not an IP/localhost, path ends /chat/completions", () => {
    for (const preset of OPENAI_COMPATIBLE_PRESETS) {
      const url = new URL(preset.chatCompletionsUrl);
      expect(url.protocol).toBe("https:");
      expect(url.username).toBe("");
      expect(url.password).toBe("");
      expect(url.search).toBe("");
      expect(url.hash).toBe("");
      expect(url.hostname).not.toMatch(/^(\d{1,3}\.){3}\d{1,3}$/);
      expect(url.hostname).not.toBe("localhost");
      expect(url.pathname.endsWith("/chat/completions")).toBe(true);
    }
  });

  it("PS-2: exactly 6 https:// literals in openai-compatible.ts, each the value of an exported *_CHAT_COMPLETIONS_URL constant", () => {
    const source = readFileSync(path.join(__dirname, "openai-compatible.ts"), "utf8");
    const literalMatches = source.match(/https:\/\/[^"'\s]+/g) ?? [];
    expect(literalMatches).toHaveLength(6);
    const exportedConstants = source.match(/export const \w+_CHAT_COMPLETIONS_URL = "(https:\/\/[^"]+)"/g) ?? [];
    expect(exportedConstants).toHaveLength(6);
    for (const literal of literalMatches) {
      expect(exportedConstants.some((c) => c.includes(literal))).toBe(true);
    }
  });

  it.each(OPENAI_COMPATIBLE_PRESET_ADAPTERS.map((adapter, i) => [adapter, OPENAI_COMPATIBLE_PRESETS[i]] as const))(
    "PS-3 (%s): one POST to its own constant, authorization-only header, model/messages in body, injected baseUrl/url ignored",
    async (adapter, preset) => {
      const mock = respondWith(200, { choices: [{ message: { content: "hi" } }] });
      const ctx = {
        ...callCtx({ apiKey: SENTINEL_KEY, model: MODEL, fetch: mock }),
        baseUrl: "https://evil.example.com/steal",
        url: "https://evil.example.com/steal",
      };
      await adapter.generate(request(), ctx);
      expect(mock).toHaveBeenCalledTimes(1);
      const [url, init] = mock.mock.calls[0];
      expect(url).toBe(preset.chatCompletionsUrl);
      expect(url).not.toContain("evil.example.com");
      expect(init.headers.authorization).toBe(`Bearer ${SENTINEL_KEY}`);
      const body = JSON.parse(init.body as string);
      expect(body.model).toBe(MODEL);
      expect(Array.isArray(body.messages)).toBe(true);
    },
  );

  it.each(OPENAI_COMPATIBLE_PRESET_ADAPTERS)("PS-4 (%s): a null api key gives auth_failed with zero fetch calls", async (adapter) => {
    const mock = respondWith(200, {});
    const result = await adapter.generate(request(), callCtx({ apiKey: null, fetch: mock }));
    expect(result).toEqual({ ok: false, error: "auth_failed" });
    expect(mock).not.toHaveBeenCalled();
  });

  it("PS-5: the openai preset body has max_completion_tokens and no max_tokens; every other preset the reverse", async () => {
    for (let i = 0; i < OPENAI_COMPATIBLE_PRESET_ADAPTERS.length; i++) {
      const adapter = OPENAI_COMPATIBLE_PRESET_ADAPTERS[i];
      const preset = OPENAI_COMPATIBLE_PRESETS[i];
      const mock = respondWith(200, { choices: [{ message: { content: "hi" } }] });
      await adapter.generate(request({ maxOutputTokens: 77 }), callCtx({ apiKey: SENTINEL_KEY, model: MODEL, fetch: mock }));
      const [, init] = mock.mock.calls[0];
      const body = JSON.parse(init.body as string);
      if (preset.id === "openai") {
        expect(body.max_completion_tokens).toBe(77);
        expect(body.max_tokens).toBeUndefined();
      } else {
        expect(body.max_tokens).toBe(77);
        expect(body.max_completion_tokens).toBeUndefined();
      }
    }
  });

  it.each(OPENAI_COMPATIBLE_PRESET_ADAPTERS)(
    "PS-6 (%s): 401/404/429/500 map to closed codes; a 200 with no choices is bad_response; raw body sentinel never leaks",
    async (adapter) => {
      const SENTINEL_BODY = "RAW-PRESET-BODY-SENTINEL";
      const cases: [number, unknown, string][] = [
        [401, { error: SENTINEL_BODY }, "auth_failed"],
        [404, { error: SENTINEL_BODY }, "model_not_found"],
        [429, { error: SENTINEL_BODY }, "rate_limited"],
        [500, { error: SENTINEL_BODY }, "provider_error"],
      ];
      for (const [status, body, expectedCode] of cases) {
        const mock = respondWith(status, body);
        const result = await adapter.generate(request(), callCtx({ apiKey: SENTINEL_KEY, model: MODEL, fetch: mock }));
        expect(result).toEqual({ ok: false, error: expectedCode });
        expect(JSON.stringify(result)).not.toContain(SENTINEL_BODY);
      }
      const noChoicesMock = respondWith(200, { choices: [] });
      const noChoicesResult = await adapter.generate(request(), callCtx({ apiKey: SENTINEL_KEY, model: MODEL, fetch: noChoicesMock }));
      expect(noChoicesResult).toEqual({ ok: false, error: "bad_response" });
    },
  );
});
