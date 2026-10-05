import type ro from "@/messages/ro.json";
import type { DetectionReason } from "@/lib/config/detect-adapter";

export type ChatReplyKey = Exclude<keyof (typeof ro)["Chat"]["replies"], "actionStatus">;

export type ChatReplyValues = { symbol?: string; adapter?: string; max?: number; index?: number; slot?: number };

export type ChatReplyContent = {
  messageKey: ChatReplyKey;
  values?: ChatReplyValues;
  field?: { ro: string; en: string };
  detectionReason?: Exclude<DetectionReason, "detected">;
};

export type ChatReplyState = ChatReplyContent & {
  tone: "success" | "info" | "error";
  adminLink?: true;
  actions?: readonly ChatActionReplyState[];
};

export type ChatActionReplyState = ChatReplyContent & {
  index: number;
  status: "done" | "failed" | "not_run";
};

export type TranscriptEntry = { id: number; message: string; reply: ChatReplyState };

export type ChatViewState =
  | { status: "available" }
  | { status: "unavailable"; reply: ChatReplyState }
  | { status: "error" };
