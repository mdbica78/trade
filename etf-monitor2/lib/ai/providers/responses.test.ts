import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callCtx, loadAiFixture, respondWith } from "../../../test/helpers/ai-http";
import { geminiProvider } from "./gemini";
import { groqProvider } from "./groq";
import type { AiProvider, GenerateRequest } from "./types";

function request(): GenerateRequest {
  return { system: "sys", messages: [{ role: "user" as const, content: "user" }], format: "none" as const, maxOutputTokens: 100 };
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

const CASES: { name: "gemini" | "groq"; provider: AiProvider }[] = [
  { name: "gemini", provider: geminiProvider },
  { name: "groq", provider: groqProvider },
];

describe.each(CASES)("$name responses (RS)", ({ name, provider }) => {
  it("RS-1: success fixture -> ok with the fixture's text, exact keys", async () => {
    const body = loadAiFixture(name, "success");
    const mock = respondWith(200, body);
    const result = await provider.generate(request(), callCtx({ fetch: mock }));
    expect(result).toEqual({ ok: true, text: '{"ok":true}' });
    expect(Object.keys(result)).toEqual(["ok", "text"]);
  });

  it("RS-2: no-candidates/no-choices fixture -> bad_response", async () => {
    const body = loadAiFixture(name, name === "gemini" ? "no-candidates" : "no-choices");
    const mock = respondWith(200, body);
    const result = await provider.generate(request(), callCtx({ fetch: mock }));
    expect(result).toEqual({ ok: false, error: "bad_response" });
  });

  it("RS-3: non-JSON 200 body -> bad_response", async () => {
    const mock = vi.fn(async () => new Response("<html>upstream error</html>", { status: 200 }));
    const result = await provider.generate(request(), callCtx({ fetch: mock }));
    expect(result).toEqual({ ok: false, error: "bad_response" });
  });

  it("RS-4: no-text shapes -> bad_response", async () => {
    const noTextBodies =
      name === "gemini"
        ? [
            { candidates: [{ content: { parts: [] } }] },
            { candidates: [{ content: { parts: [{ text: "thinking", thought: true }] } }] },
            { candidates: [{ content: { parts: [{ text: "" }] } }] },
          ]
        : [
            { choices: [{ message: { content: null } }] },
            { choices: [{ message: { content: "" } }] },
            { choices: [{ message: { content: "   " } }] },
          ];
    for (const body of noTextBodies) {
      const mock = respondWith(200, body);
      const result = await provider.generate(request(), callCtx({ fetch: mock }));
      expect(result).toEqual({ ok: false, error: "bad_response" });
    }
  });

  if (name === "gemini") {
    it("RS-5: Gemini joins multiple text parts", async () => {
      const body = { candidates: [{ content: { parts: [{ text: '{"a":' }, { text: "1}" }] } }] };
      const mock = respondWith(200, body);
      const result = await provider.generate(request(), callCtx({ fetch: mock }));
      expect(result).toEqual({ ok: true, text: '{"a":1}' });
    });
  }

  it("RS-6: a 2xx body read that rejects gives network, or timeout if the signal is already aborted", async () => {
    const rejectingResponse = { ok: true, status: 200, text: () => Promise.reject(new Error("read failed")) } as unknown as Response;
    const mock = vi.fn(async () => rejectingResponse);
    const notAbortedResult = await provider.generate(request(), callCtx({ fetch: mock }));
    expect(notAbortedResult).toEqual({ ok: false, error: "network" });

    const controller = new AbortController();
    controller.abort();
    const abortedResult = await provider.generate(request(), callCtx({ fetch: mock, signal: controller.signal }));
    expect(abortedResult).toEqual({ ok: false, error: "timeout" });
  });
});
