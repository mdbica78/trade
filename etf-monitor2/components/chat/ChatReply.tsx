import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import type { Locale } from "@/i18n/locale";
import type { ChatReplyContent, ChatReplyState } from "./chat-state";

export function ChatReply({ reply }: { reply: ChatReplyState }) {
  const t = useTranslations("Chat.replies");
  const tReason = useTranslations("Admin.detectionReason");
  const tAdmin = useTranslations("Chat");
  const locale = useLocale() as Locale;

  function textOf(item: ChatReplyContent): [string, string] {
    const field = item.field !== undefined ? item.field[locale] : undefined;
    const values = { ...item.values, ...(field !== undefined ? { field } : {}) };
    const text = t(item.messageKey, values);
    const reasonText = item.detectionReason !== undefined ? ` (${tReason(item.detectionReason)})` : "";
    return [text, reasonText];
  }

  const [text, reasonText] = textOf(reply);
  const actionStatuses = {
    done: t("actionStatus.done"),
    failed: t("actionStatus.failed"),
    not_run: t("actionStatus.not_run"),
  };

  return (
    <div
      role={reply.tone === "error" ? "alert" : "status"}
      className="rounded-lg rounded-bl-sm bg-[var(--head)] px-3 py-2 text-sm"
    >
      <p>{text}{reasonText}
      {reply.adminLink === true ? (
        <>
          {" "}
          <Link href="/admin/ai">{tAdmin("adminAiLink")}</Link>
        </>
      ) : null}
      </p>
      {reply.actions !== undefined ? (
        <ul className="mt-2 list-disc pl-5">
          {reply.actions.map((action, index) => {
            const [actionText, actionReason] = textOf(action);
            return (
              <li key={`${index}-${action.messageKey}`}>
                <span>{action.index}{"."} </span>
                <strong>{actionStatuses[action.status]}{":"} </strong>
                {actionText}{actionReason}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
