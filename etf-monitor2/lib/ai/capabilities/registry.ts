import { configurationCapability } from "./configuration/capability";
import { widgetsCapability } from "./widgets/capability";
import type { Capability } from "./types";

export const CAPABILITY_REGISTRY = {
  configuration: configurationCapability,
  widgets: widgetsCapability,
} as const satisfies Record<string, Capability>;

export type CapabilityId = keyof typeof CAPABILITY_REGISTRY;

export const CAPABILITY_IDS = Object.keys(CAPABILITY_REGISTRY) as CapabilityId[];

export function getCapability<Id extends CapabilityId>(id: Id): (typeof CAPABILITY_REGISTRY)[Id] {
  return CAPABILITY_REGISTRY[id];
}
