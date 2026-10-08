import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callCtx, respondWith } from "../../../test/helpers/ai-http";
import { GROQ_CHAT_COMPLETIONS_URL, groqProvider } from "./groq";
import type { GenerateRequest } from "./types";

const SENTINEL_KEY = "SENTINEL-GROQ-KEY-4b2a";
const MODEL = "llama-test-model";

function request(
  overrides: { system?: string; content?: string; format?: GenerateRequest["format"]; maxOutputTokens?: number } = {},
): GenerateRequest {
  return {
    system: overrides.system ?? "sys prompt",
    messages: [{ role: "user", content: overrides.content ?? "user prompt" }],
    format: overrides.format ?? "none",
    maxOutputTokens: overrides.maxOutputTokens ?? 256,
  };
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("real network forbidden");
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("groqProvider (GQ)", () => {
  it("GQ-1: one POST to the chat-completions URL, no query string, no sentinel in the URL", async () => {
    const mock = respondWith(200, { choices: [{ message: { content: "hi" } }] });
    const ctx = callCtx({ apiKey: SENTINEL_KEY, model: MODEL, fetch: mock });
    await groqProvider.generate(request(), ctx);
    expect(mock).toHaveBeenCalledTimes(1);
    const [url, init] = mock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(url).toBe(GROQ_CHAT_COMPLETIONS_URL);
    expect(new URL(url).search).toBe("");
    expect(url).not.toContain(SENTINEL_KEY);
    expect(init.signal).toBe(ctx.signal);
    expect(init.redirect).toBe("error");
  });

  it("GQ-2: key goes only in the authorization header", async () => {
    const mock = respondWith(200, { choices: [{ message: { content: "hi" } }] });
    await groqProvider.generate(request(), callCtx({ apiKey: SENTINEL_KEY, model: MODEL, fetch: mock }));
    const [, init] = mock.mock.calls[0];
    expect(init.headers.authorization).toBe(`Bearer ${SENTINEL_KEY}`);
    for (const [key, value] of Object.entries(init.headers)) {
      if (key !== "authorization") expect(String(value)).not.toContain(SENTINEL_KEY);
    }
    expect(String(init.body)).not.toContain(SENTINEL_KEY);
  });

  it("GQ-3: request body shape without json mode", async () => {
    const mock = respondWith(200, { choices: [{ message: { content: "hi" } }] });
    await groqProvider.generate(request({ system: "S", content: "U", maxOutputTokens: 42, format: "none" }), callCtx({ model: MODEL, fetch: mock }));
    const [, init] = mock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe(MODEL);
    expect(body.messages).toEqual([
      { role: "system", content: "S" },
      { role: "user", content: "U" },
    ]);
    expect(body.max_tokens).toBe(42);
    expect(body.response_format).toBeUndefined();
  });

  it("GQ-4: json mode sets response_format to json_object", async () => {
    const mock = respondWith(200, { choices: [{ message: { content: "{}" } }] });
    await groqProvider.generate(request({ format: "json_object" }), callCtx({ fetch: mock }));
    const [, init] = mock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("GQ-5: a null api key gives auth_failed with zero fetch calls", async () => {
    const mock = respondWith(200, {});
    const result = await groqProvider.generate(request(), callCtx({ apiKey: null, fetch: mock }));
    expect(result).toEqual({ ok: false, error: "auth_failed" });
    expect(mock).not.toHaveBeenCalled();
  });

  it("GQ-6 (US-041 AC2): an injected baseUrl on the call context cannot redirect the request", async () => {
    const mock = respondWith(200, { choices: [{ message: { content: "hi" } }] });
    const ctx = { ...callCtx({ apiKey: SENTINEL_KEY, model: MODEL, fetch: mock }), baseUrl: "https://evil.example.com/steal" };
    await groqProvider.generate(request(), ctx);
    const [url] = mock.mock.calls[0];
    expect(url).toBe(GROQ_CHAT_COMPLETIONS_URL);
    expect(url).not.toContain("evil.example.com");
  });
});
