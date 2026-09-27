import { useTranslations } from "next-intl";
import { ChatPanel, type ChatPanelProps } from "./ChatPanel";
import { ChatReply } from "./ChatReply";
import type { ChatViewState } from "./chat-state";

export type ChatViewProps = {
  state: ChatViewState;
  action: ChatPanelProps["action"];
  maxLength: number;
};

export function ChatView({ state, action, maxLength }: ChatViewProps) {
  const t = useTranslations("Chat");

  return (
    <div>
      <h1>{t("heading")}</h1>
      <p>{t("intro")}</p>
      {state.status === "available" ? <ChatPanel action={action} maxLength={maxLength} /> : null}
      {state.status === "unavailable" ? <ChatReply reply={state.reply} /> : null}
      {state.status === "error" ? <p role="alert">{t("loadError")}</p> : null}
    </div>
  );
}
