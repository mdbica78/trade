import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";
import { extractModuleSpecifiers } from "../../../test/helpers/module-specifiers";
import { createFakeProvider, fakeCallInput } from "../../../test/helpers/ai-fakes";
import { runGeneration } from "./run-generation";
import { PROVIDER_ERROR_CODES, type AiProvider, type GenerateResult } from "./types";

describe("PT: provider interface types", () => {
  it("PT-1: PROVIDER_ERROR_CODES is exactly the seven DEC-017 codes, no duplicates", () => {
    expect(PROVIDER_ERROR_CODES).toEqual([
      "timeout",
      "network",
      "auth_failed",
      "rate_limited",
      "model_not_found",
      "provider_error",
      "bad_response",
    ]);
    expect(new Set(PROVIDER_ERROR_CODES).size).toBe(PROVIDER_ERROR_CODES.length);
  });

  it("PT-2: types.ts names no concrete provider and has zero module specifiers", () => {
    const source = readFileSync(path.join(__dirname, "types.ts"), "utf8");
    expect(extractModuleSpecifiers(source)).toEqual([]);
    expect(/gemini|groq|openrouter|mistral|openai|google|anthropic/i.test(source)).toBe(false);
  });

  it("PT-3: GenerateResult union members only ever have keys ok/text/error", () => {
    expectTypeOf<keyof Extract<GenerateResult, { ok: true }>>().toEqualTypeOf<"ok" | "text">();
    expectTypeOf<keyof Extract<GenerateResult, { ok: false }>>().toEqualTypeOf<"ok" | "error">();
  });

  it("a fake provider typed against AiProvider compiles and passes the wrapper's tests", async () => {
    const fake: AiProvider = createFakeProvider("fake", [{ ok: true, text: "hi" }]);
    const result = await runGeneration(fake, { system: "s", user: "u", json: false, maxOutputTokens: 10 }, fakeCallInput());
    expect(result).toEqual({ ok: true, text: "hi" });
  });
});
