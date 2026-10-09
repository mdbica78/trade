"use server";

import { revalidatePath } from "next/cache";
import { handleChatMessage } from "@/lib/ai/chat";
import type { ChatReplyState } from "@/components/chat/chat-state";
import { chatOutcomeToReply, changedSymbol, GENERIC_ERROR_REPLY } from "./reply-messages";

export async function sendChatMessageAction(formData: FormData): Promise<ChatReplyState> {
  const raw = formData.get("message");
  try {
    const outcome = await handleChatMessage(typeof raw === "string" ? raw : "");
    const symbol = changedSymbol(outcome);
    if (symbol !== null) {
      revalidatePath("/");
      revalidatePath("/admin/etfs");
      revalidatePath(`/admin/etfs/${symbol}/fields`);
      revalidatePath(`/etf/${symbol}`);
    }
    return chatOutcomeToReply(outcome);
  } catch {
    return GENERIC_ERROR_REPLY;
  }
}
