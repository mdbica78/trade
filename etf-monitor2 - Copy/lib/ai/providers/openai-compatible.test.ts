import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callCtx, respondWith } from "../../../test/helpers/ai-http";
import { createOpenAiCompatibleProvider } from "./openai-compatible";
import type { GenerateRequest } from "./types";

function request(overrides: Partial<GenerateRequest> = {}): GenerateRequest {
  return { system: "sys", user: "user", json: false, maxOutputTokens: 100, ...overrides };
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
});
