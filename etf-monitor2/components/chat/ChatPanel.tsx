"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ChatReply } from "./ChatReply";
import { ChatPlanControls } from "./ChatPlanControls";
import { pendingPlanToken } from "./confirm";
import { chatTurn } from "./transcript";
import type { ChatReplyState, TranscriptEntry } from "./chat-state";

export type ChatPanelProps = {
  action: (formData: FormData) => Promise<ChatReplyState>;
  maxLength: number;
  historyMessages?: number;
  confirmAction?: (formData: FormData) => Promise<ChatReplyState>;
};

export function ChatPanel({ action, maxLength, historyMessages, confirmAction }: ChatPanelProps) {
  const t = useTranslations("Chat");

  const [transcript, formAction, pending] = useActionState(
    (prev: readonly TranscriptEntry[], formData: FormData) =>
      chatTurn(
        prev,
        formData,
        action,
        t("keyRequestHidden"),
        historyMessages,
        confirmAction === undefined ? undefined : { action: confirmAction, confirmLabel: t("confirm"), cancelLabel: t("cancel") },
      ),
    [] as TranscriptEntry[],
  );
  const hasPendingPlan = pendingPlanToken(transcript) !== null;

  return (
    <div className="flex flex-col gap-4">
      {transcript.length > 0 && (
        <ul className="flex flex-col gap-3">
          {transcript.map((entry) => (
            <li key={entry.id} className="flex flex-col items-end gap-2">
              <p className="max-w-[85%] rounded-lg rounded-br-sm bg-[var(--hover)] px-3 py-2 text-sm text-[var(--text)]">
                <strong className="text-[var(--accent)]">{t("youLabel")}</strong>
                {": "}
                {entry.message}
              </p>
              <div className="max-w-[85%] self-start">
                <ChatReply reply={entry.reply} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <form action={formAction} className="flex flex-col gap-2 border-t border-[var(--line)] pt-4 first:border-t-0 first:pt-0">
        <label>
          {t("messageLabel")}
          <textarea name="message" maxLength={maxLength} required />
        </label>
        <div className="flex gap-2">
          <button type="submit" disabled={pending} className="self-start">
            {t("send")}
          </button>
          <button type="submit" name="intent" value="new" formNoValidate disabled={pending} className="self-start">
            {t("newConversation")}
          </button>
        </div>
        {hasPendingPlan ? <ChatPlanControls pending={pending} /> : null}
      </form>
    </div>
  );
}
