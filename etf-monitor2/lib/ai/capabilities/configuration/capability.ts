import type { Capability } from "../types";
import { CONFIGURATION_ACTIONS } from "./intent";

export const configurationCapability: Capability = {
  actions: CONFIGURATION_ACTIONS,
};
