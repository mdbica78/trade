import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import type { Locale } from "@/i18n/locale";
import type { ChatReplyState } from "./chat-state";

export function ChatReply({ reply }: { reply: ChatReplyState }) {
  const t = useTranslations("Chat.replies");
  const tReason = useTranslations("Admin.detectionReason");
  const tAdmin = useTranslations("Chat");
  const locale = useLocale() as Locale;

  const field = reply.field !== undefined ? reply.field[locale] : undefined;
  const values = {
    ...reply.values,
    ...(field !== undefined ? { field } : {}),
  };

  const text = t(reply.messageKey, values);
  const reasonText =
    reply.detectionReason !== undefined ? ` (${tReason(reply.detectionReason)})` : "";

  return (
    <p
      role={reply.tone === "error" ? "alert" : "status"}
      className="rounded-lg rounded-bl-sm bg-[var(--head)] px-3 py-2 text-sm"
    >
      {text}
      {reasonText}
      {reply.adminLink === true ? (
        <>
          {" "}
          <Link href="/admin/ai">{tAdmin("adminAiLink")}</Link>
        </>
      ) : null}
    </p>
  );
}
