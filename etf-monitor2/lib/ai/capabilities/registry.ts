import { configurationCapability } from "./configuration/capability";
import { widgetsCapability } from "./widgets/capability";
import type { Capability } from "./types";

export const CAPABILITY_REGISTRY = {
  configuration: configurationCapability,
  widgets: widgetsCapability,
} as const satisfies Record<string, Capability>;

export type CapabilityId = keyof typeof CAPABILITY_REGISTRY;

export function getCapability<Id extends CapabilityId>(id: Id): (typeof CAPABILITY_REGISTRY)[Id] {
  return CAPABILITY_REGISTRY[id];
}

export function isCapabilityId(value: unknown): value is CapabilityId {
  return typeof value === "string" && Object.hasOwn(CAPABILITY_REGISTRY, value);
}
