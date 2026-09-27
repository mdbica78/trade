import { beforeEach, describe, expect, it, vi } from "vitest";
import { bindGenerate } from "./generate";
import { createFakeProvider, fakeCallInput } from "../../../test/helpers/ai-fakes";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("real network forbidden");
    }),
  );
});

const REQUEST = { system: "s", user: "u", json: false, maxOutputTokens: 100 };

describe("bindGenerate (CG)", () => {
  it("CG-1: forwards exactly the request once, with the bound model and an AbortSignal", async () => {
    const fake = createFakeProvider("fake", [{ ok: true, text: "hi" }]);
    const generate = bindGenerate(fake, fakeCallInput({ model: "m-9" }));

    const result = await generate(REQUEST);

    expect(result).toEqual({ ok: true, text: "hi" });
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]!.request).toEqual(REQUEST);
    expect(fake.calls[0]!.ctx.model).toBe("m-9");
    expect(fake.calls[0]!.ctx.signal).toBeInstanceOf(AbortSignal);
  });

  it("CG-2: a hanging provider times out through runGeneration", async () => {
    const fake = createFakeProvider("fake", ["hang"]);
    const generate = bindGenerate(fake, fakeCallInput(), { timeoutMs: 20 });

    const result = await generate(REQUEST);

    expect(result).toEqual({ ok: false, error: "timeout" });
  });

  it("CG-3: a throwing provider becomes provider_error", async () => {
    const fake = createFakeProvider("fake", [{ throwsSync: new Error("boom") }]);
    const generate = bindGenerate(fake, fakeCallInput());

    const result = await generate(REQUEST);

    expect(result).toEqual({ ok: false, error: "provider_error" });
  });
});
