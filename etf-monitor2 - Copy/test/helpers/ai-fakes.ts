import { vi } from "vitest";
import type { AiProvider, GenerateRequest, GenerateResult, ProviderCallContext, ProviderCallInput } from "../../lib/ai/providers/types";

export type FakeStep = GenerateResult | { throws: Error } | { throwsSync: Error } | "hang" | unknown;

/**
 * A test double, never shipped code (LB-2(a) forbids any `test/` import target from `lib/ai`).
 * Each `generate` call consumes the next step in order; the last one repeats. `"hang"` returns a
 * promise that never settles and ignores the abort signal, proving the wrapper's timeout does not
 * depend on adapter cooperation.
 */
export function createFakeProvider(
  id: string,
  steps: FakeStep[] = [{ ok: true, text: "{}" }],
): AiProvider & { calls: { request: GenerateRequest; ctx: ProviderCallContext }[] } {
  const calls: { request: GenerateRequest; ctx: ProviderCallContext }[] = [];
  let index = 0;

  return {
    id,
    calls,
    async generate(request, ctx) {
      calls.push({ request, ctx });
      const step = steps[Math.min(index, steps.length - 1)];
      index += 1;

      if (step === "hang") {
        return new Promise<GenerateResult>(() => {});
      }
      if (typeof step === "object" && step !== null && "throwsSync" in step) {
        throw (step as { throwsSync: Error }).throwsSync;
      }
      if (typeof step === "object" && step !== null && "throws" in step) {
        throw (step as { throws: Error }).throws;
      }
      return step as GenerateResult;
    },
  };
}

export function fakeCallInput(overrides: Partial<ProviderCallInput> = {}): ProviderCallInput {
  return {
    apiKey: "k",
    model: "m-1",
    fetch: vi.fn(async () => {
      throw new Error("real network forbidden");
    }),
    ...overrides,
  };
}
