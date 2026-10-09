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
        <button type="submit" disabled={pending} className="self-start">
          {t("send")}
        </button>
      </form>
    </div>
  );
}
