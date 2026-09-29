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
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-10 sm:px-6">
      <div>
        <h1>{t("heading")}</h1>
        <p className="-mt-2 text-sm">{t("intro")}</p>
      </div>
      <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4">
        {state.status === "available" ? <ChatPanel action={action} maxLength={maxLength} /> : null}
        {state.status === "unavailable" ? <ChatReply reply={state.reply} /> : null}
        {state.status === "error" ? <p role="alert">{t("loadError")}</p> : null}
      </div>
    </div>
  );
}
