import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callCtx, respondWith } from "../../../test/helpers/ai-http";
import { GEMINI_MODELS_BASE_URL, geminiProvider } from "./gemini";
import type { GenerateRequest } from "./types";

const SENTINEL_KEY = "SENTINEL-GEMINI-KEY-4b2a";
const MODEL = "gemini-test-model";

function request(overrides: Partial<GenerateRequest> = {}): GenerateRequest {
  return { system: "sys prompt", user: "user prompt", json: false, maxOutputTokens: 256, ...overrides };
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

describe("geminiProvider (GM)", () => {
  it("GM-1: one POST to the models base URL + model + :generateContent, no query string", async () => {
    const mock = respondWith(200, { candidates: [{ content: { parts: [{ text: "hi" }] } }] });
    await geminiProvider.generate(request(), callCtx({ apiKey: SENTINEL_KEY, model: MODEL, fetch: mock }));
    expect(mock).toHaveBeenCalledTimes(1);
    const [url, init] = mock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(url).toBe(`${GEMINI_MODELS_BASE_URL}${MODEL}:generateContent`);
    expect(new URL(url).search).toBe("");
    expect(url).not.toContain(SENTINEL_KEY);
  });

  it("GM-2: key goes only in x-goog-api-key; signal and redirect are forwarded", async () => {
    const mock = respondWith(200, { candidates: [{ content: { parts: [{ text: "hi" }] } }] });
    const ctx = callCtx({ apiKey: SENTINEL_KEY, model: MODEL, fetch: mock });
    await geminiProvider.generate(request(), ctx);
    const [, init] = mock.mock.calls[0];
    expect(init.headers["x-goog-api-key"]).toBe(SENTINEL_KEY);
    for (const [key, value] of Object.entries(init.headers)) {
      if (key !== "x-goog-api-key") expect(String(value)).not.toContain(SENTINEL_KEY);
    }
    expect(String(init.body)).not.toContain(SENTINEL_KEY);
    expect(init.signal).toBe(ctx.signal);
    expect(init.redirect).toBe("error");
  });

  it("GM-3: request body shape without json mode", async () => {
    const mock = respondWith(200, { candidates: [{ content: { parts: [{ text: "hi" }] } }] });
    await geminiProvider.generate(request({ system: "S", user: "U", maxOutputTokens: 42, json: false }), callCtx({ fetch: mock }));
    const [, init] = mock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.systemInstruction.parts[0].text).toBe("S");
    expect(body.contents).toEqual([{ role: "user", parts: [{ text: "U" }] }]);
    expect(body.generationConfig.maxOutputTokens).toBe(42);
    expect(body.generationConfig.responseMimeType).toBeUndefined();
  });

  it("GM-4: json mode sets responseMimeType to application/json", async () => {
    const mock = respondWith(200, { candidates: [{ content: { parts: [{ text: "{}" }] } }] });
    await geminiProvider.generate(request({ json: true }), callCtx({ fetch: mock }));
    const [, init] = mock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
  });

  it("GM-5: model name is URL-encoded, no fragment, no extra path segment", async () => {
    const mock = respondWith(200, { candidates: [{ content: { parts: [{ text: "hi" }] } }] });
    await geminiProvider.generate(request(), callCtx({ model: "../x?key=y", fetch: mock }));
    const [url] = mock.mock.calls[0];
    expect(url).toBe(`${GEMINI_MODELS_BASE_URL}..%2Fx%3Fkey%3Dy:generateContent`);
    const parsed = new URL(url);
    expect(parsed.search).toBe("");
    expect(parsed.hostname).toBe("generativelanguage.googleapis.com");
    expect(parsed.pathname.startsWith("/v1beta/models/")).toBe(true);

    mock.mockClear();
    await geminiProvider.generate(request(), callCtx({ model: "a/b#c", fetch: mock }));
    const [url2] = mock.mock.calls[0];
    expect(url2).not.toContain("#");
    expect(new URL(url2).pathname.split("/")).toHaveLength(4);
  });

  it("GM-6: a null api key gives auth_failed with zero fetch calls", async () => {
    const mock = respondWith(200, {});
    const result = await geminiProvider.generate(request(), callCtx({ apiKey: null, fetch: mock }));
    expect(result).toEqual({ ok: false, error: "auth_failed" });
    expect(mock).not.toHaveBeenCalled();
  });

  it("GM-7 (US-041 AC2): an injected baseUrl on the call context cannot redirect the request", async () => {
    const mock = respondWith(200, { candidates: [{ content: { parts: [{ text: "hi" }] } }] });
    const ctx = { ...callCtx({ apiKey: SENTINEL_KEY, model: MODEL, fetch: mock }), baseUrl: "https://evil.example.com/steal" };
    await geminiProvider.generate(request(), ctx);
    const [url] = mock.mock.calls[0];
    expect(url).toBe(`${GEMINI_MODELS_BASE_URL}${MODEL}:generateContent`);
    expect(url).not.toContain("evil.example.com");
  });
});
