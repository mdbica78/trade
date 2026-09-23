import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchOnce } from "./http";

describe("fetchOnce", () => {
  let networkGuard: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    networkGuard = vi.fn(() => {
      throw new Error("network disabled in tests");
    });
    vi.stubGlobal("fetch", networkGuard);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("returns ok with the parsed value on a 2xx response", async () => {
    const fetchImpl = vi.fn(async () => new Response("hello", { status: 200, headers: { "content-type": "text/plain" } }));
    const result = await fetchOnce("https://example.test/a", (res) => res.text(), {
      fetchImpl,
      timeoutMs: 1000,
    });
    expect(result).toEqual({ ok: true, value: "hello", status: 200, finalUrl: "https://example.test/a" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(networkGuard).not.toHaveBeenCalled();
  });

  it("uses res.url as finalUrl when set (redirects)", async () => {
    const res = new Response("x", { status: 200 });
    Object.defineProperty(res, "url", { value: "https://example.test/final" });
    const fetchImpl = vi.fn(async () => res);
    const result = await fetchOnce("https://example.test/start", (r) => r.text(), {
      fetchImpl,
      timeoutMs: 1000,
    });
    expect(result).toEqual({ ok: true, value: "x", status: 200, finalUrl: "https://example.test/final" });
  });

  it("classifies non-2xx as http_error with httpStatus, without reading the body", async () => {
    const read = vi.fn(async () => "should not be called");
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 404 }));
    const result = await fetchOnce("https://example.test/missing", read, { fetchImpl, timeoutMs: 1000 });
    expect(result).toEqual({ ok: false, kind: "http_error", httpStatus: 404, message: expect.any(String) });
    expect(read).not.toHaveBeenCalled();
  });

  it("classifies 500 as http_error", async () => {
    const fetchImpl = vi.fn(async () => new Response("boom", { status: 500 }));
    const result = await fetchOnce("https://example.test/err", (r) => r.text(), { fetchImpl, timeoutMs: 1000 });
    expect(result).toEqual({ ok: false, kind: "http_error", httpStatus: 500, message: expect.any(String) });
  });

  it("classifies a rejected fetch promise as network", async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new TypeError("fetch failed")));
    const result = await fetchOnce("https://example.test/a", (r) => r.text(), { fetchImpl, timeoutMs: 1000 });
    expect(result).toEqual({ ok: false, kind: "network", message: expect.stringContaining("fetch failed") });
  });

  it("classifies a synchronous throw from fetchImpl as network", async () => {
    const fetchImpl = vi.fn(() => {
      throw new Error("sync boom");
    });
    const result = await fetchOnce("https://example.test/a", (r) => r.text(), { fetchImpl, timeoutMs: 1000 });
    expect(result).toEqual({ ok: false, kind: "network", message: expect.stringContaining("sync boom") });
  });

  it("times out when the fetch mock ignores the signal and never settles", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(() => new Promise<Response>(() => {}));
    const promise = fetchOnce("https://example.test/slow", (r) => r.text(), { fetchImpl, timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;
    expect(result).toEqual({ ok: false, kind: "timeout", message: expect.any(String) });
  });

  it("times out when the fetch mock rejects with an AbortError on abort", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );
    const promise = fetchOnce("https://example.test/slow", (r) => r.text(), { fetchImpl, timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;
    expect(result).toEqual({ ok: false, kind: "timeout", message: expect.any(String) });
  });

  it("classifies a body-read failure as network", async () => {
    const res = new Response("x", { status: 200 });
    const read = vi.fn(async () => {
      throw new Error("read failed");
    });
    const fetchImpl = vi.fn(async () => res);
    const result = await fetchOnce("https://example.test/a", read, { fetchImpl, timeoutMs: 1000 });
    expect(result).toEqual({ ok: false, kind: "network", message: expect.stringContaining("read failed") });
  });

  it("passes the given headers and an AbortSignal to fetchImpl", async () => {
    const fetchImpl = vi.fn(async () => new Response("ok", { status: 200 }));
    await fetchOnce("https://example.test/a", (r) => r.text(), {
      fetchImpl,
      timeoutMs: 1000,
      headers: { "X-Test": "1" },
    });
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[1]).toMatchObject({
      headers: { "X-Test": "1" },
      signal: expect.any(AbortSignal),
    });
  });

  it("defaults fetchImpl to globalThis.fetch read at call time", async () => {
    const stub = vi.fn(async () => new Response("stubbed", { status: 200 }));
    vi.stubGlobal("fetch", stub);
    const result = await fetchOnce("https://example.test/a", (r) => r.text(), { timeoutMs: 1000 });
    expect(result).toEqual({ ok: true, value: "stubbed", status: 200, finalUrl: "https://example.test/a" });
    expect(stub).toHaveBeenCalledTimes(1);
  });
});
