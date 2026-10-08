import { getChatAvailability, CHAT_MESSAGE_MAX_LENGTH } from "@/lib/ai/chat";
import { HISTORY_MESSAGES } from "@/lib/ai/chat-history";
import { ChatView } from "@/components/chat/ChatView";
import type { ChatViewState } from "@/components/chat/chat-state";
import { confirmChatPlanAction, sendChatMessageAction } from "./actions";
import { unavailableReplyKey } from "./reply-messages";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";
export const metadata = {
  robots: { index: false, follow: false },
};

async function loadViewState(): Promise<ChatViewState> {
  const availability = await getChatAvailability();
  if (availability.status === "available") return { status: "available" };
  if (availability.status === "unavailable") {
    return {
      status: "unavailable",
      reply: { tone: "info", messageKey: unavailableReplyKey(availability.reason), adminLink: true },
    };
  }
  return { status: "error" };
}

export default async function ChatPage() {
  const state = await loadViewState();
  return (
    <ChatView
      state={state}
      action={sendChatMessageAction}
      maxLength={CHAT_MESSAGE_MAX_LENGTH}
      historyMessages={HISTORY_MESSAGES}
      confirmAction={confirmChatPlanAction}
    />
  );
}
