"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ChatReply } from "./ChatReply";
import { appendTranscript } from "./transcript";
import type { ChatReplyState, TranscriptEntry } from "./chat-state";

export type ChatPanelProps = {
  action: (formData: FormData) => Promise<ChatReplyState>;
  maxLength: number;
};

export function ChatPanel({ action, maxLength }: ChatPanelProps) {
  const t = useTranslations("Chat");

  const [transcript, formAction, pending] = useActionState(
    async (prev: readonly TranscriptEntry[], formData: FormData) => {
      const message = String(formData.get("message") ?? "");
      const reply = await action(formData);
      return appendTranscript(prev, message, reply);
    },
    [] as TranscriptEntry[],
  );

  return (
    <div>
      <ul>
        {transcript.map((entry) => (
          <li key={entry.id}>
            <p>
              <strong>{t("youLabel")}</strong>
              {": "}
              {entry.message}
            </p>
            <ChatReply reply={entry.reply} />
          </li>
        ))}
      </ul>
      <form action={formAction}>
        <label>
          {t("messageLabel")}
          <textarea name="message" maxLength={maxLength} required />
        </label>
        <button type="submit" disabled={pending}>
          {t("send")}
        </button>
      </form>
    </div>
  );
}
