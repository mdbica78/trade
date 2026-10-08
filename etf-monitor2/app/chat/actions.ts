"use server";

import { revalidatePath } from "next/cache";
import { confirmChatPlan, handleChatMessage, type ChatOutcome } from "@/lib/ai/chat";
import type { ChatReplyState } from "@/components/chat/chat-state";
import { buildChatReply, changedActions, GENERIC_ERROR_REPLY } from "./reply-messages";

function revalidateChanged(outcome: ChatOutcome): void {
  const changed = changedActions(outcome);
  const paths = new Set<string>();
  for (const action of changed) {
    if (action.capability === "configuration") {
      paths.add("/");
      paths.add("/admin/etfs");
      paths.add(`/admin/etfs/${action.symbol}/fields`);
    }
    paths.add(`/etf/${action.symbol}`);
  }
  for (const path of paths) revalidatePath(path);
}

export async function sendChatMessageAction(formData: FormData): Promise<ChatReplyState> {
  const raw = formData.get("message");
  const history = formData.get("history");
  try {
    const outcome = await handleChatMessage(typeof raw === "string" ? raw : "", undefined, { history });
    revalidateChanged(outcome);
    return buildChatReply(outcome);
  } catch {
    return GENERIC_ERROR_REPLY;
  }
}

/** Reads only `token`: a confirmation action never needs the message text or history (DEC-027 §4). */
export async function confirmChatPlanAction(formData: FormData): Promise<ChatReplyState> {
  const token = formData.get("token");
  try {
    const outcome = await confirmChatPlan(typeof token === "string" ? token : "");
    revalidateChanged(outcome);
    return buildChatReply(outcome);
  } catch {
    return GENERIC_ERROR_REPLY;
  }
}
