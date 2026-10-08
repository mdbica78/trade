import type ro from "@/messages/ro.json";
import type { DetectionReason } from "@/lib/config/detect-adapter";
import type { WidgetDefinition } from "@/lib/config/widgets";

type WidgetOperation = WidgetDefinition["operation"];
type WidgetPeriodUnit = WidgetDefinition["periodUnit"];

export type ChatReplyKey = Exclude<keyof (typeof ro)["Chat"]["replies"], "actionStatus">;
export type ChatReasonKey = keyof (typeof ro)["Chat"]["reasons"];

export type ChatReplyValues = { symbol?: string; adapter?: string; max?: number; index?: number; slot?: number };

/** A type-only mirror of `lib/ai/chat-results.ts`'s `ActionDetail` (CV-4: components/chat never imports lib/ai). */
export type WhatDescription = {
  operation?: WidgetOperation;
  fieldKey?: string;
  field?: { ro: string; en: string };
  periodUnit?: WidgetPeriodUnit;
  periodAmount?: number;
  slot?: number | "all";
  count?: number;
  to?: { operation?: WidgetOperation; fieldKey?: string; field?: { ro: string; en: string }; periodUnit?: WidgetPeriodUnit; periodAmount?: number };
};

export type ChatReplyContent = {
  messageKey: ChatReplyKey;
  values?: ChatReplyValues;
  field?: { ro: string; en: string };
  detectionReason?: Exclude<DetectionReason, "detected">;
  what?: WhatDescription;
};

export type ChatPlanState = { token?: string; status: "pending" | "confirmed" | "cancelled" | "discarded" };

export type ChatReplyState = ChatReplyContent & {
  tone: "success" | "info" | "error";
  adminLink?: true;
  actions?: readonly ChatActionReplyState[];
  modelText?: string;
  warning?: true;
  reason?: { key: ChatReasonKey; symbol?: string; field?: { ro: string; en: string } };
  memo?: string;
  plan?: ChatPlanState;
};

export type ChatActionReplyState = ChatReplyContent & {
  index: number;
  status: "done" | "failed" | "not_run" | "proposed";
};

export type TranscriptEntry = { id: number; message: string; reply: ChatReplyState };

export type ChatViewState =
  | { status: "available" }
  | { status: "unavailable"; reply: ChatReplyState }
  | { status: "error" };
