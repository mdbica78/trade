import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callInput } from "../../../test/helpers/ai-http";
import { geminiProvider } from "./gemini";
import { groqProvider } from "./groq";
import { AI_PROVIDER_TIMEOUT_MS, runGeneration } from "./run-generation";
import type { AiProvider, GenerateRequest } from "./types";

function request(): GenerateRequest {
  return { system: "sys", user: "user", json: false, maxOutputTokens: 100 };
}

const CASES: { name: "gemini" | "groq"; provider: AiProvider }[] = [
  { name: "gemini", provider: geminiProvider },
  { name: "groq", provider: groqProvider },
];

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe.each(CASES)("$name through runGeneration times out after one request, never retries (OR)", ({ provider }) => {
  it("OR-2a: a fetch that never settles and ignores the signal times out at AI_PROVIDER_TIMEOUT_MS, one call, signal aborted", async () => {
    const mock = vi.fn((_url: string, _init: RequestInit) => new Promise<Response>(() => {}));
    const promise = runGeneration(provider, request(), callInput({ apiKey: "k", fetch: mock }));

    await vi.advanceTimersByTimeAsync(AI_PROVIDER_TIMEOUT_MS - 1);
    let settled = false;
    promise.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    const result = await promise;
    expect(result).toEqual({ ok: false, error: "timeout" });
    expect(mock).toHaveBeenCalledTimes(1);
    const [, init] = mock.mock.calls[0];
    expect((init as RequestInit).signal?.aborted).toBe(true);
  });

  it("OR-2b: a fetch that rejects with AbortError on abort still gives timeout, exactly one call", async () => {
    const mock = vi.fn((_url: string, init: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("The operation was aborted.", "AbortError")));
      });
    });
    const promise = runGeneration(provider, request(), callInput({ apiKey: "k", fetch: mock }));
    await vi.advanceTimersByTimeAsync(AI_PROVIDER_TIMEOUT_MS);
    const result = await promise;
    expect(result).toEqual({ ok: false, error: "timeout" });
    expect(mock).toHaveBeenCalledTimes(1);
  });
});
