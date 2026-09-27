import type ro from "@/messages/ro.json";
import type { DetectionReason } from "@/lib/config/detect-adapter";

export type ChatReplyKey = keyof (typeof ro)["Chat"]["replies"];

export type ChatReplyState = {
  tone: "success" | "info" | "error";
  messageKey: ChatReplyKey;
  values?: { symbol?: string; adapter?: string; max?: number };
  field?: { ro: string; en: string };
  detectionReason?: Exclude<DetectionReason, "detected">;
  adminLink?: true;
};

export type TranscriptEntry = { id: number; message: string; reply: ChatReplyState };

export type ChatViewState =
  | { status: "available" }
  | { status: "unavailable"; reply: ChatReplyState }
  | { status: "error" };
