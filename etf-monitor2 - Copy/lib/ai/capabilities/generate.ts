import { runGeneration } from "../providers/run-generation";
import type { AiProvider, ProviderCallInput } from "../providers/types";
import type { CapabilityGenerate } from "./types";

/** Binds a resolved provider + call input to a `CapabilityGenerate`, through `runGeneration` (timeout, no retry). */
export function bindGenerate(
  provider: AiProvider,
  input: ProviderCallInput,
  options: { timeoutMs?: number } = {},
): CapabilityGenerate {
  return (request) => runGeneration(provider, request, input, options);
}
