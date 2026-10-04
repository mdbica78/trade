import type ro from "@/messages/ro.json";
import type { DetectionReason } from "@/lib/config/detect-adapter";

export type ChatReplyKey = Exclude<keyof (typeof ro)["Chat"]["replies"], "actionStatus">;

export type ChatReplyState = {
  tone: "success" | "info" | "error";
  messageKey: ChatReplyKey;
  values?: { symbol?: string; adapter?: string; max?: number; index?: number; slot?: number };
  field?: { ro: string; en: string };
  detectionReason?: Exclude<DetectionReason, "detected">;
  adminLink?: true;
  actions?: readonly ChatActionReplyState[];
};

export type ChatActionReplyState = {
  index: number;
  status: "done" | "failed" | "not_run";
  messageKey: ChatReplyKey;
  values?: { symbol?: string; adapter?: string; slot?: number };
  field?: { ro: string; en: string };
  detectionReason?: Exclude<DetectionReason, "detected">;
};

export type TranscriptEntry = { id: number; message: string; reply: ChatReplyState };

export type ChatViewState =
  | { status: "available" }
  | { status: "unavailable"; reply: ChatReplyState }
  | { status: "error" };
