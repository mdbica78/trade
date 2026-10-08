import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadAiFixture } from "../../test/helpers/ai-http";
import { runGeneration } from "./providers/run-generation";
import { GEMINI_MODELS_BASE_URL } from "./providers/gemini";
import { GROQ_CHAT_COMPLETIONS_URL } from "./providers/groq";
import { createProviderDeps, loadActiveProvider, type ProviderDeps } from "./provider-deps";
import { OPENAI_COMPATIBLE_PRESETS } from "./providers/openai-compatible";
import { PROVIDER_CATALOG } from "./provider-catalog";
import type { AiSettings } from "../config/ai-settings";

const GEMINI_SENTINEL = "SENTINEL-GEMINI-IC-4b2a";
const GROQ_SENTINEL = "SENTINEL-GROQ-IC-4b2a";

vi.mock("../db/index", () => ({ getDb: vi.fn(() => ({})) }));

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", GEMINI_SENTINEL);
  vi.stubEnv("GROQ_API_KEY", GROQ_SENTINEL);
  for (const preset of OPENAI_COMPATIBLE_PRESETS) {
    const descriptor = PROVIDER_CATALOG.find((p) => p.id === preset.id);
    if (descriptor) vi.stubEnv(descriptor.apiKeyEnvVar, `SENTINEL-${preset.id.toUpperCase()}-IC-4b2a`);
  }
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.startsWith(GEMINI_MODELS_BASE_URL)) {
        return new Response(JSON.stringify(loadAiFixture("gemini", "success")), { status: 200 });
      }
      if (url === GROQ_CHAT_COMPLETIONS_URL) {
        return new Response(JSON.stringify(loadAiFixture("groq", "success")), { status: 200 });
      }
      const preset = OPENAI_COMPATIBLE_PRESETS.find((p) => p.chatCompletionsUrl === url);
      if (preset) {
        return new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 });
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
  return { ...createProviderDeps(), loadSettings: async () => settings, loadStoredKeys: async () => new Map() };
}

describe("interchangeable providers by settings alone (IC)", () => {
  it("IC-1: gemini settings -> a real call to the Gemini base URL", async () => {
    const deps = depsFor({ provider: "gemini", model: "gemini-test-model" });
    const call = await loadActiveProvider(deps);
    expect(call.ok).toBe(true);
    if (!call.ok) return;
    const result = await runGeneration(call.provider, { system: "s", messages: [{ role: "user" as const, content: "u" }], format: "none" as const, maxOutputTokens: 10 }, call.input);
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
    const result = await runGeneration(call.provider, { system: "s", messages: [{ role: "user" as const, content: "u" }], format: "none" as const, maxOutputTokens: 10 }, call.input);
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

  it.each(OPENAI_COMPATIBLE_PRESETS)("IC-4 (%s): settings alone -> a real call to its own URL carrying only its own sentinel", async (preset) => {
    const sentinel = `SENTINEL-${preset.id.toUpperCase()}-IC-4b2a`;
    const deps = depsFor({ provider: preset.id, model: "preset-test-model" });
    const call = await loadActiveProvider(deps);
    expect(call.ok).toBe(true);
    if (!call.ok) return;
    expect(call.input.apiKey).toBe(sentinel);
    const result = await runGeneration(call.provider, { system: "s", messages: [{ role: "user" as const, content: "u" }], format: "none" as const, maxOutputTokens: 10 }, call.input);
    expect(result).toEqual({ ok: true, text: "{}" });
    const spy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBe(preset.chatCompletionsUrl);
    const init = spy.mock.calls[0][1] as RequestInit & { headers: Record<string, string> };
    expect(init.headers.authorization).toBe(`Bearer ${sentinel}`);
  });
});
