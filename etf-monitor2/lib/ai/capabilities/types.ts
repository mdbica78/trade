import type { GenerateRequest, GenerateResult } from "../providers/types";

/** `generate`, already bound to the active provider through `runGeneration` (US-025). */
export type CapabilityGenerate = (request: GenerateRequest) => Promise<GenerateResult>;

/** Requirements §2.2: each capability is a separate plugin on top of the chosen AI provider. */
export interface Capability<Input, Output> {
  readonly id: string;
  run(input: Input, generate: CapabilityGenerate): Promise<Output>;
}
