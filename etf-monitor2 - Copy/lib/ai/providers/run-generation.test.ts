import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeProvider, fakeCallInput } from "../../../test/helpers/ai-fakes";
import { AI_PROVIDER_TIMEOUT_MS, runGeneration } from "./run-generation";
import { PROVIDER_ERROR_CODES } from "./types";

const request = { system: "s", user: "u", json: false, maxOutputTokens: 10 };

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RG: runGeneration never throws", () => {
  it("RG-1: an ok result passes through unchanged; exactly one call with the request/input intact", async () => {
    const provider = createFakeProvider("fake", [{ ok: true, text: "hello" }]);
    const input = fakeCallInput();
    const result = await runGeneration(provider, request, input);
    expect(result).toEqual({ ok: true, text: "hello" });
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0].request).toEqual(request);
    expect(provider.calls[0].ctx.model).toBe(input.model);
    expect(provider.calls[0].ctx.apiKey).toBe(input.apiKey);
    expect(provider.calls[0].ctx.fetch).toBe(input.fetch);
    expect(provider.calls[0].ctx.signal.aborted).toBe(false);
  });

  it("RG-2: an async rejection gives provider_error, never leaking the message", async () => {
    const provider = createFakeProvider("fake", [{ throws: new Error("boom SENTINEL-X") }]);
    const result = await runGeneration(provider, request, fakeCallInput());
    expect(result).toEqual({ ok: false, error: "provider_error" });
    expect(JSON.stringify(result)).not.toContain("boom");
    expect(JSON.stringify(result)).not.toContain("SENTINEL");
  });

  it("RG-3: a synchronous throw resolves to provider_error, not a rejection out of runGeneration", async () => {
    const provider = createFakeProvider("fake", [{ throwsSync: new Error("sync boom") }]);
    await expect(runGeneration(provider, request, fakeCallInput())).resolves.toEqual({ ok: false, error: "provider_error" });
  });

  it("RG-4: a never-settling adapter times out at AI_PROVIDER_TIMEOUT_MS, signal aborted", async () => {
    const provider = createFakeProvider("fake", ["hang"]);
    const input = fakeCallInput();
    const resultPromise = runGeneration(provider, request, input);

    await vi.advanceTimersByTimeAsync(AI_PROVIDER_TIMEOUT_MS - 1);
    let settled = false;
    resultPromise.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    const result = await resultPromise;
    expect(result).toEqual({ ok: false, error: "timeout" });
    expect(provider.calls[0].ctx.signal.aborted).toBe(true);
  });

  it("RG-5: every error code passes through unchanged", async () => {
    for (const code of PROVIDER_ERROR_CODES) {
      const provider = createFakeProvider("fake", [{ ok: false, error: code }]);
      const result = await runGeneration(provider, request, fakeCallInput());
      expect(result).toEqual({ ok: false, error: code });
    }
  });

  it("RG-6: malformed results all become provider_error, with extra fields dropped", async () => {
    const cases: unknown[] = [
      undefined,
      { ok: true },
      { ok: true, text: 42 },
      { ok: false, error: "weird" },
    ];
    for (const malformed of cases) {
      const provider = createFakeProvider("fake", [malformed]);
      const result = await runGeneration(provider, request, fakeCallInput());
      expect(result).toEqual({ ok: false, error: "provider_error" });
    }

    const withExtra = createFakeProvider("fake", [{ ok: false, error: "network", detail: "https://x?key=SENTINEL" } as never]);
    const result = await runGeneration(withExtra, request, fakeCallInput());
    expect(result).toEqual({ ok: false, error: "network" });
  });

  it("RG-7: no pending timer after a settled call, signal not aborted on success", async () => {
    const provider = createFakeProvider("fake", [{ ok: true, text: "hello" }]);
    await runGeneration(provider, request, fakeCallInput());
    expect(vi.getTimerCount()).toBe(0);
    expect(provider.calls[0].ctx.signal.aborted).toBe(false);
  });

  it("RG-8: AI_PROVIDER_TIMEOUT_MS is exactly 20000", () => {
    expect(AI_PROVIDER_TIMEOUT_MS).toBe(20000);
  });

  it("every result in RG-1..RG-6 has keys within {ok, text, error}", async () => {
    const provider = createFakeProvider("fake", [{ ok: true, text: "hello" }]);
    const result = await runGeneration(provider, request, fakeCallInput());
    expect(Object.keys(result).every((k) => ["ok", "text", "error"].includes(k))).toBe(true);
  });
});
