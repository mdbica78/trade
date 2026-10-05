import type { Capability } from "../types";

export const WIDGET_ACTIONS = ["widget_add", "widget_update", "widget_clear", "widget_replace"] as const;

/** Registry entry for the closed widget action set; generation is shared across capabilities. */
export const widgetsCapability: Capability = {
  actions: WIDGET_ACTIONS,
};
