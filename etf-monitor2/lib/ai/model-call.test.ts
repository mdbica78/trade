import { describe, expect, it } from "vitest";
import { ANSWER_JSON_SCHEMA } from "./capabilities/action-list";
import {
  createFormatCache,
  createModelCaller,
  formatCacheKey,
  MAX_MODEL_CALLS_PER_MESSAGE,
  MAX_MODEL_CALLS_WITH_DOWNGRADE,
} from "./model-call";
import { createFakeProvider, fakeCallInput } from "../../test/helpers/ai-fakes";
import type { GenerateRequest } from "./providers/types";

const request: GenerateRequest = {
  system: "system",
  messages: [{ role: "user", content: "hello" }],
  format: "json_object",
  maxOutputTokens: 100,
};

describe("structured model caller", () => {
  it("starts with schema output and falls back once, caching only a successful downgrade", async () => {
    const cache = createFormatCache();
    const provider = createFakeProvider("groq", [
      { ok: false, error: "unsupported_format" },
      { ok: true, text: '{"reply":null,"actions":[],"question":null}' },
    ]);
    const options = { provider, input: fakeCallInput(), mode: "json_schema" as const, cache };
    const caller = createModelCaller(options);
    expect(await caller.call(request)).toMatchObject({ ok: true });
    expect(provider.calls.map((call) => call.request.format)).toEqual(["json_schema", "json_object"]);
    expect(provider.calls[0]?.request.schema).toEqual(ANSWER_JSON_SCHEMA);
    expect(caller.remaining()).toBe(1);
    expect(cache.isDowngraded(formatCacheKey("groq", "m-1"))).toBe(true);
    expect(await caller.call(request)).toMatchObject({ ok: true });
    expect(caller.remaining()).toBe(0);
    expect(await caller.call(request)).toEqual({ ok: false, error: "timeout" });
    expect(provider.calls).toHaveLength(MAX_MODEL_CALLS_WITH_DOWNGRADE);

    const next = createFakeProvider("groq", [{ ok: true, text: "{}" }]);
    await createModelCaller({ ...options, provider: next }).call(request);
    expect(next.calls[0]?.request.format).toBe("json_object");
  });

  it("does not cache a failed downgrade and never exposes unsupported_format", async () => {
    const cache = createFormatCache();
    const provider = createFakeProvider("groq", [
      { ok: false, error: "unsupported_format" },
      { ok: false, error: "unsupported_format" },
    ]);
    const caller = createModelCaller({ provider, input: fakeCallInput(), mode: "json_schema", cache });
    expect(await caller.call(request)).toEqual({ ok: false, error: "provider_error" });
    expect(provider.calls).toHaveLength(2);
    expect(cache.isDowngraded(formatCacheKey("groq", "m-1"))).toBe(false);
  });

  it("caps ordinary calls and refuses to start below the minimum remaining time", async () => {
    const provider = createFakeProvider("gemini", [{ ok: true, text: "{}" }]);
    const caller = createModelCaller({ provider, input: fakeCallInput(), mode: "json_object" });
    await caller.call(request);
    await caller.call(request);
    expect(provider.calls).toHaveLength(MAX_MODEL_CALLS_PER_MESSAGE);
    expect(await caller.call(request)).toEqual({ ok: false, error: "timeout" });

    let now = 0;
    const noTime = createModelCaller({
      provider: createFakeProvider("gemini"),
      input: fakeCallInput(),
      mode: "none",
      now: () => now,
    });
    now = 41_000;
    expect(await noTime.call(request)).toEqual({ ok: false, error: "timeout" });
  });
});
