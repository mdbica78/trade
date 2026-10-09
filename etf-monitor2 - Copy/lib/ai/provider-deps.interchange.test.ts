import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadAiFixture } from "../../test/helpers/ai-http";
import { runGeneration } from "./providers/run-generation";
import { GEMINI_MODELS_BASE_URL } from "./providers/gemini";
import { GROQ_CHAT_COMPLETIONS_URL } from "./providers/groq";
import { createProviderDeps, loadActiveProvider, type ProviderDeps } from "./provider-deps";
import type { AiSettings } from "../config/ai-settings";

const GEMINI_SENTINEL = "SENTINEL-GEMINI-IC-4b2a";
const GROQ_SENTINEL = "SENTINEL-GROQ-IC-4b2a";

vi.mock("../db/index", () => ({ getDb: vi.fn(() => ({})) }));

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", GEMINI_SENTINEL);
  vi.stubEnv("GROQ_API_KEY", GROQ_SENTINEL);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.startsWith(GEMINI_MODELS_BASE_URL)) {
        return new Response(JSON.stringify(loadAiFixture("gemini", "success")), { status: 200 });
      }
      if (url === GROQ_CHAT_COMPLETIONS_URL) {
        return new Response(JSON.stringify(loadAiFixture("groq", "success")), { status: 200 });
      }
      throw new Error(`unexpected URL: ${url}`);
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function depsFor(settings: AiSettings): ProviderDeps {
  return { ...createProviderDeps(), loadSettings: async () => settings };
}

describe("interchangeable providers by settings alone (IC)", () => {
  it("IC-1: gemini settings -> a real call to the Gemini base URL", async () => {
    const deps = depsFor({ provider: "gemini", model: "gemini-test-model" });
    const call = await loadActiveProvider(deps);
    expect(call.ok).toBe(true);
    if (!call.ok) return;
    const result = await runGeneration(call.provider, { system: "s", user: "u", json: false, maxOutputTokens: 10 }, call.input);
    expect(result).toEqual({ ok: true, text: '{"ok":true}' });
    const spy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(spy).toHaveBeenCalledTimes(1);
    expect((spy.mock.calls[0][0] as string).startsWith(GEMINI_MODELS_BASE_URL)).toBe(true);
  });

  it("IC-2: groq settings -> a real call to the Groq chat-completions URL", async () => {
    const deps = depsFor({ provider: "groq", model: "llama-test-model" });
    const call = await loadActiveProvider(deps);
    expect(call.ok).toBe(true);
    if (!call.ok) return;
    const result = await runGeneration(call.provider, { system: "s", user: "u", json: false, maxOutputTokens: 10 }, call.input);
    expect(result).toEqual({ ok: true, text: '{"ok":true}' });
    const spy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBe(GROQ_CHAT_COMPLETIONS_URL);
  });

  it("IC-3: each call carries only its own provider's sentinel key", async () => {
    const geminiDeps = depsFor({ provider: "gemini", model: "gemini-test-model" });
    const geminiCall = await loadActiveProvider(geminiDeps);
    expect(geminiCall.ok && geminiCall.input.apiKey).toBe(GEMINI_SENTINEL);

    const groqDeps = depsFor({ provider: "groq", model: "llama-test-model" });
    const groqCall = await loadActiveProvider(groqDeps);
    expect(groqCall.ok && groqCall.input.apiKey).toBe(GROQ_SENTINEL);
  });
});
