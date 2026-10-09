import type ro from "@/messages/ro.json";
import type { DetectionReason } from "@/lib/config/detect-adapter";

export type AdminMessageKey = keyof (typeof ro)["Admin"]["messages"];

export type AdminActionState =
  | { status: "idle" }
  | {
      status: "success" | "error";
      messageKey: AdminMessageKey;
      values?: { symbol?: string; adapter?: string };
      reason?: Exclude<DetectionReason, "detected">;
    };

export const IDLE_STATE: AdminActionState = { status: "idle" };
