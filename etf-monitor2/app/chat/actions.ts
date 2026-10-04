"use server";

import { revalidatePath } from "next/cache";
import { handleChatMessage } from "@/lib/ai/chat";
import type { ChatReplyState } from "@/components/chat/chat-state";
import { chatOutcomeToReply, changedActions, GENERIC_ERROR_REPLY } from "./reply-messages";

export async function sendChatMessageAction(formData: FormData): Promise<ChatReplyState> {
  const raw = formData.get("message");
  try {
    const outcome = await handleChatMessage(typeof raw === "string" ? raw : "");
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
    return chatOutcomeToReply(outcome);
  } catch {
    return GENERIC_ERROR_REPLY;
  }
}
