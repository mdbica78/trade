import { readFileSync } from "node:fs";
import path from "node:path";
import { vi } from "vitest";
import type { ProviderCallContext, ProviderCallInput, ProviderFetch } from "../../lib/ai/providers/types";

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures", "ai");

/** Loads a committed fixture body, e.g. `loadAiFixture("gemini", "success")`. */
export function loadAiFixture(provider: "gemini" | "groq", name: string): unknown {
  const raw = readFileSync(path.join(FIXTURES_DIR, provider, `${name}.json`), "utf8");
  return JSON.parse(raw);
}

/** A recording `ProviderFetch` mock that answers every call with the same status/body. */
export function respondWith(status: number, body: unknown): ReturnType<typeof vi.fn> & ProviderFetch {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as ReturnType<typeof vi.fn> & ProviderFetch;
}

/** A `ProviderFetch` mock that always rejects with the given error. */
export function rejectingFetch(error: Error): ReturnType<typeof vi.fn> & ProviderFetch {
  return vi.fn(async () => {
    throw error;
  }) as ReturnType<typeof vi.fn> & ProviderFetch;
}

/** A `ProviderFetch` mock whose promise never settles; `honoursAbort` rejects it once the signal aborts. */
export function hangingFetch(options: { honoursAbort?: boolean } = {}): ReturnType<typeof vi.fn> & ProviderFetch {
  return vi.fn((_url: string, init: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      if (options.honoursAbort) {
        init.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      }
    });
  }) as unknown as ReturnType<typeof vi.fn> & ProviderFetch;
}

export function fetchCallCount(mock: ReturnType<typeof vi.fn>): number {
  return mock.mock.calls.length;
}

/** A `ProviderCallContext` with a fresh (non-aborted) signal and a sentinel key by default. */
export function callCtx(overrides: Partial<ProviderCallContext> = {}): ProviderCallContext {
  return {
    apiKey: "SENTINEL-KEY-4b2a",
    model: "test-model",
    fetch: rejectingFetch(new Error("real network forbidden")),
    signal: new AbortController().signal,
    ...overrides,
  };
}

export function callInput(overrides: Partial<ProviderCallInput> = {}): ProviderCallInput {
  return {
    apiKey: "SENTINEL-KEY-4b2a",
    model: "test-model",
    fetch: rejectingFetch(new Error("real network forbidden")),
    ...overrides,
  };
}
