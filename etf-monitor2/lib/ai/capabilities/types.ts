import type { GenerateRequest, GenerateResult } from "../providers/types";

/** `generate`, already bound to the active provider through `runGeneration` (US-025). */
export type CapabilityGenerate = (request: GenerateRequest) => Promise<GenerateResult>;

/** Requirements §2.2: each capability owns an explicitly closed action set. */
export interface Capability {
  readonly id: string;
  readonly actions: readonly string[];
}
