import { useTranslations } from "next-intl";
import Link from "next/link";
import { ChatPanel, type ChatPanelProps } from "./ChatPanel";
import { ChatReply } from "./ChatReply";
import type { ChatViewState } from "./chat-state";

export type ChatViewProps = {
  state: ChatViewState;
  action: ChatPanelProps["action"];
  maxLength: number;
  historyMessages?: number;
  confirmAction?: ChatPanelProps["confirmAction"];
};

export function ChatView({ state, action, maxLength, historyMessages, confirmAction }: ChatViewProps) {
  const t = useTranslations("Chat");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-10 sm:px-6">
      <div>
        <h1>{t("heading")}</h1>
        <p className="-mt-2 text-sm">{t("intro")}</p>
      </div>
      <section aria-labelledby="chat-instructions-heading" className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4">
        <h2 id="chat-instructions-heading">{t("instructions.heading")}</h2>
        <p className="text-sm">{t("instructions.intro")}</p>
        <ul className="list-disc pl-6 text-sm">
          <li>{t("instructions.addEtf")}</li>
          <li>{t("instructions.removeEtf")}</li>
          <li>{t("instructions.trackField")}</li>
          <li>{t("instructions.untrackField")}</li>
          <li>{t("instructions.widgetAdd")}</li>
          <li>{t("instructions.widgetUpdate")}</li>
          <li>{t("instructions.widgetClear")}</li>
          <li>{t("instructions.widgetReplace")}</li>
        </ul>
        <p className="mt-2 text-sm">{t("instructions.multiAction")}</p>
        <p className="mt-2 text-sm">{t("instructions.setupQuestions")}</p>
        <p className="mt-2 text-sm">{t("instructions.listExamples")}</p>
        <p className="mt-2 text-sm">{t("instructions.conversation")}</p>
        <p className="mt-2 text-sm">
          {t("instructions.keyGuidance")}{" "}
          <Link href="/admin/ai">{t("adminAiLink")}</Link>
        </p>
      </section>
      <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4">
        {state.status === "available" ? (
          <ChatPanel action={action} maxLength={maxLength} historyMessages={historyMessages} confirmAction={confirmAction} />
        ) : null}
        {state.status === "unavailable" ? <ChatReply reply={state.reply} /> : null}
        {state.status === "error" ? <p role="alert">{t("loadError")}</p> : null}
      </div>
    </div>
  );
}
