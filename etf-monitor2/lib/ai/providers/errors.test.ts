import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callCtx, loadAiFixture, respondWith } from "../../../test/helpers/ai-http";
import { geminiProvider } from "./gemini";
import { groqProvider } from "./groq";
import type { AiProvider, GenerateRequest, ProviderErrorCode } from "./types";

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

const SENTINEL = "SENTINEL-KEY-4b2a";

describe.each(CASES)("$name errors never leak (HE)", ({ name, provider }) => {
  it("HE-1: status table with a generic error body", async () => {
    const table: [number, ProviderErrorCode][] = [
      [400, "provider_error"],
      [401, "auth_failed"],
      [403, "auth_failed"],
      [404, "model_not_found"],
      [429, "rate_limited"],
      [500, "provider_error"],
      [502, "provider_error"],
      [503, "provider_error"],
    ];
    for (const [status, expected] of table) {
      const mock = respondWith(status, { error: { message: "x" } });
      const result = await provider.generate(request(), callCtx({ apiKey: SENTINEL, fetch: mock }));
      expect(result).toEqual({ ok: false, error: expected });
      expect(mock).toHaveBeenCalledTimes(1);
    }
  });

  it("HE-1b: a non-JSON error body with 401 still gives auth_failed", async () => {
    const mock = vi.fn(async () => new Response("not json", { status: 401 }));
    const result = await provider.generate(request(), callCtx({ apiKey: SENTINEL, fetch: mock }));
    expect(result).toEqual({ ok: false, error: "auth_failed" });
  });

  it("HE-2: committed fixtures for 429 and 404", async () => {
    const rate = loadAiFixture(name, "error-429");
    const rateMock = respondWith(429, rate);
    expect(await provider.generate(request(), callCtx({ apiKey: SENTINEL, fetch: rateMock }))).toEqual({ ok: false, error: "rate_limited" });

    const notFound = loadAiFixture(name, "error-404-model");
    const notFoundMock = respondWith(404, notFound);
    expect(await provider.generate(request(), callCtx({ apiKey: SENTINEL, fetch: notFoundMock }))).toEqual({
      ok: false,
      error: "model_not_found",
    });

    if (name === "groq") {
      const invalidKey = loadAiFixture(name, "error-401-invalid-key");
      const invalidKeyMock = respondWith(401, invalidKey);
      expect(await provider.generate(request(), callCtx({ apiKey: SENTINEL, fetch: invalidKeyMock }))).toEqual({
        ok: false,
        error: "auth_failed",
      });
    }
  });

  it("HE-3: fetch rejects with a URL-shaped message -> network", async () => {
    const mock = vi.fn(async () => {
      throw new TypeError("fetch failed: https://example.test?key=SENTINEL");
    });
    const result = await provider.generate(request(), callCtx({ apiKey: SENTINEL, fetch: mock }));
    expect(result).toEqual({ ok: false, error: "network" });
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("HE-4: aborted before generate -> timeout, one call", async () => {
    const controller = new AbortController();
    controller.abort();
    const mock = vi.fn(async (_url: string, init: RequestInit) => {
      if (init.signal?.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError");
      }
      throw new Error("unexpected");
    });
    const result = await provider.generate(request(), callCtx({ apiKey: SENTINEL, fetch: mock, signal: controller.signal }));
    expect(result).toEqual({ ok: false, error: "timeout" });
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("HE-7: no case throws; extractText surprises give bad_response", async () => {
    for (const body of ['null', "[]"]) {
      const mock = vi.fn(async () => new Response(body, { status: 200 }));
      const result = await provider.generate(request(), callCtx({ apiKey: SENTINEL, fetch: mock }));
      expect(result).toEqual({ ok: false, error: "bad_response" });
    }
  });

  it("HE-8: sentinel echo through every error fixture and the rejecting-fetch case", async () => {
    const echo = `echo ${SENTINEL} https://example.test/request BODY-MARKER-77`;
    const fixtureCases: { status: number; fixture: string }[] =
      name === "gemini"
        ? [
            { status: 429, fixture: "error-429" },
            { status: 400, fixture: "error-400-api-key-invalid" },
            { status: 400, fixture: "error-400-invalid-argument" },
            { status: 404, fixture: "error-404-model" },
          ]
        : [
            { status: 429, fixture: "error-429" },
            { status: 401, fixture: "error-401-invalid-key" },
            { status: 404, fixture: "error-404-model" },
            { status: 400, fixture: "error-400-json-validate-failed" },
          ];

    for (const { status, fixture } of fixtureCases) {
      const body = loadAiFixture(name, fixture) as { error: { message: string; failed_generation?: string } };
      body.error.message = echo;
      if (fixture === "error-400-json-validate-failed") body.error.failed_generation = echo;
      const mock = respondWith(status, body);
      const result = await provider.generate(request(), callCtx({ apiKey: SENTINEL, fetch: mock }));
      const json = JSON.stringify(result);
      expect(json).not.toContain(SENTINEL);
      expect(json).not.toContain("https://example.test");
      expect(json).not.toContain("example.test");
      expect(json).not.toContain("BODY-MARKER-77");
      expect(Object.keys(result).sort()).toEqual(result.ok ? ["ok", "text"] : ["error", "ok"]);
    }

    const rejectMock = vi.fn(async () => {
      throw new Error(echo);
    });
    const rejectResult = await provider.generate(request(), callCtx({ apiKey: SENTINEL, fetch: rejectMock }));
    const rejectJson = JSON.stringify(rejectResult);
    expect(rejectJson).not.toContain(SENTINEL);
    expect(rejectJson).not.toContain("example.test");
    expect(rejectJson).not.toContain("BODY-MARKER-77");
  });
});

describe("gemini-specific error-body rule (HE-5)", () => {
  it("the API_KEY_INVALID fixture gives auth_failed; INVALID_ARGUMENT without that reason gives provider_error; non-array details gives provider_error", async () => {
    const invalidKey = loadAiFixture("gemini", "error-400-api-key-invalid");
    const invalidKeyMock = respondWith(400, invalidKey);
    expect(await geminiProvider.generate(request(), callCtx({ apiKey: SENTINEL, fetch: invalidKeyMock }))).toEqual({
      ok: false,
      error: "auth_failed",
    });

    const invalidArgument = loadAiFixture("gemini", "error-400-invalid-argument");
    const invalidArgumentMock = respondWith(400, invalidArgument);
    expect(await geminiProvider.generate(request(), callCtx({ apiKey: SENTINEL, fetch: invalidArgumentMock }))).toEqual({
      ok: false,
      error: "provider_error",
    });

    const nonArrayDetails = { error: { code: 400, status: "INVALID_ARGUMENT", details: "not-an-array" } };
    const nonArrayMock = respondWith(400, nonArrayDetails);
    expect(await geminiProvider.generate(request(), callCtx({ apiKey: SENTINEL, fetch: nonArrayMock }))).toEqual({
      ok: false,
      error: "provider_error",
    });
  });
});

describe("groq-specific error-body rule (HE-6)", () => {
  it("the json_validate_failed fixture gives bad_response; another error.code gives provider_error", async () => {
    const jsonValidateFailed = loadAiFixture("groq", "error-400-json-validate-failed");
    const jsonValidateFailedMock = respondWith(400, jsonValidateFailed);
    expect(await groqProvider.generate(request(), callCtx({ apiKey: SENTINEL, fetch: jsonValidateFailedMock }))).toEqual({
      ok: false,
      error: "bad_response",
    });

    const otherCode = { error: { message: "x", type: "invalid_request_error", code: "something_else" } };
    const otherCodeMock = respondWith(400, otherCode);
    expect(await groqProvider.generate(request(), callCtx({ apiKey: SENTINEL, fetch: otherCodeMock }))).toEqual({
      ok: false,
      error: "provider_error",
    });
  });
});
