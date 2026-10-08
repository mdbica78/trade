import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callCtx, respondWith } from "../../../test/helpers/ai-http";
import { createOpenAiCompatibleProvider, customChatCompletionsUrl } from "./openai-compatible";
import type { GenerateRequest } from "./types";

function request(overrides: Partial<GenerateRequest> = {}): GenerateRequest {
  return { system: "sys", messages: [{ role: "user" as const, content: "user" }], format: "none" as const, maxOutputTokens: 100, ...overrides };
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

describe("createOpenAiCompatibleProvider (OC)", () => {
  it("OC-1: posts to the given URL with the shared body shape; a 400 json_validate_failed with no rule gives provider_error, not bad_response", async () => {
    const provider = createOpenAiCompatibleProvider({ id: "groq", chatCompletionsUrl: "https://example.test/v1/chat/completions" });
    expect(provider.id).toBe("groq");

    const okMock = respondWith(200, { choices: [{ message: { content: "hi" } }] });
    await provider.generate(request(), callCtx({ model: "m", fetch: okMock }));
    const [url] = okMock.mock.calls[0];
    expect(url).toBe("https://example.test/v1/chat/completions");

    const errMock = respondWith(400, { error: { code: "json_validate_failed", message: "bad" } });
    const result = await provider.generate(request(), callCtx({ fetch: errMock }));
    expect(result).toEqual({ ok: false, error: "provider_error" });
  });

  it("OC-2 (US-056 T-2): default writes max_tokens; tokenLimitField: max_completion_tokens writes only that key", async () => {
    const defaultProvider = createOpenAiCompatibleProvider({ id: "x", chatCompletionsUrl: "https://example.test/v1/chat/completions" });
    const defaultMock = respondWith(200, { choices: [{ message: { content: "hi" } }] });
    await defaultProvider.generate(request({ maxOutputTokens: 99 }), callCtx({ model: "m", fetch: defaultMock }));
    const [, defaultInit] = defaultMock.mock.calls[0];
    const defaultBody = JSON.parse(defaultInit.body as string);
    expect(defaultBody.max_tokens).toBe(99);
    expect(defaultBody.max_completion_tokens).toBeUndefined();

    const mctProvider = createOpenAiCompatibleProvider({
      id: "y",
      chatCompletionsUrl: "https://example.test/v1/chat/completions",
      tokenLimitField: "max_completion_tokens",
    });
    const mctMock = respondWith(200, { choices: [{ message: { content: "hi" } }] });
    await mctProvider.generate(request({ maxOutputTokens: 99 }), callCtx({ model: "m", fetch: mctMock }));
    const [, mctInit] = mctMock.mock.calls[0];
    const mctBody = JSON.parse(mctInit.body as string);
    expect(mctBody.max_completion_tokens).toBe(99);
    expect(mctBody.max_tokens).toBeUndefined();
  });

  it("OC-3 (US-057): customChatCompletionsUrl appends the path once, with or without a trailing slash", () => {
    expect(customChatCompletionsUrl("https://a.example.com/v1")).toBe("https://a.example.com/v1/chat/completions");
    expect(customChatCompletionsUrl("https://a.example.com/v1/")).toBe("https://a.example.com/v1/chat/completions");
  });

  it("OC-H1 (US-055 T-1): the messages array is [system, ...history, final user message], in order", async () => {
    const provider = createOpenAiCompatibleProvider({ id: "x", chatCompletionsUrl: "https://example.test/v1/chat/completions" });
    const mock = respondWith(200, { choices: [{ message: { content: "hi" } }] });
    const req: GenerateRequest = {
      system: "sys prompt",
      messages: [
        { role: "user", content: "first" },
        { role: "assistant", content: "[done]" },
        { role: "user", content: "final" },
      ],
      format: "json_object",
      maxOutputTokens: 100,
    };
    await provider.generate(req, callCtx({ model: "m", fetch: mock }));
    const [, init] = mock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.messages).toEqual([
      { role: "system", content: "sys prompt" },
      { role: "user", content: "first" },
      { role: "assistant", content: "[done]" },
      { role: "user", content: "final" },
    ]);
    expect(body.response_format).toEqual({ type: "json_object" });
  });
});
