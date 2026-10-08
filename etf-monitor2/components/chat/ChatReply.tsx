import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import type { Locale } from "@/i18n/locale";
import type { ChatReplyContent, ChatReplyState, WhatDescription } from "./chat-state";

export function ChatReply({ reply }: { reply: ChatReplyState }) {
  const t = useTranslations("Chat.replies");
  const tWhat = useTranslations("Chat.what");
  const tReasons = useTranslations("Chat.reasons");
  const tReason = useTranslations("Admin.detectionReason");
  const tAdmin = useTranslations("Chat");
  const locale = useLocale() as Locale;

  function whatText(detail: WhatDescription | undefined): string {
    if (detail === undefined) return "";
    const parts: string[] = [];
    if (detail.operation !== undefined) parts.push(tWhat(`operations.${detail.operation}`));
    if (detail.field !== undefined) parts.push(detail.field[locale]);
    else if (detail.fieldKey !== undefined) parts.push(detail.fieldKey);
    if (detail.periodAmount !== undefined && detail.periodUnit !== undefined) {
      parts.push(tWhat(detail.periodUnit, { count: detail.periodAmount }));
    }
    if (detail.slot === "all") parts.push(tWhat("allSlots"));
    else if (detail.slot !== undefined) parts.push(tWhat("slot", { slot: detail.slot }));
    if (detail.count !== undefined) parts.push(tWhat("definitions", { count: detail.count }));
    if (parts.length === 0) return "";
    const base = ` (${parts.join(", ")})`;
    if (detail.to === undefined) return base;
    const toParts: string[] = [];
    if (detail.to.operation !== undefined) toParts.push(tWhat(`operations.${detail.to.operation}`));
    if (detail.to.field !== undefined) toParts.push(detail.to.field[locale]);
    else if (detail.to.fieldKey !== undefined) toParts.push(detail.to.fieldKey);
    if (detail.to.periodAmount !== undefined && detail.to.periodUnit !== undefined) {
      toParts.push(tWhat(detail.to.periodUnit, { count: detail.to.periodAmount }));
    }
    if (toParts.length === 0) return base;
    return `${base} → ${toParts.join(", ")}`;
  }

  function textOf(item: ChatReplyContent): [string, string, string] {
    const field = item.field !== undefined ? item.field[locale] : undefined;
    const values = { ...item.values, ...(field !== undefined ? { field } : {}) };
    const text = t(item.messageKey, values);
    const reasonText = item.detectionReason !== undefined ? ` (${tReason(item.detectionReason)})` : "";
    return [text, reasonText, whatText(item.what)];
  }

  const [text, reasonText] = textOf(reply);
  const actionStatuses = {
    done: t("actionStatus.done"),
    failed: t("actionStatus.failed"),
    not_run: t("actionStatus.not_run"),
    proposed: t("actionStatus.proposed"),
  };

  const reasonLine = reply.reason !== undefined
    ? ` ${reply.reason.symbol !== undefined ? `${reply.reason.symbol}: ` : ""}${tReasons(
        reply.reason.key,
        reply.reason.field !== undefined ? { field: reply.reason.field[locale] } : {},
      )}`
    : "";

  return (
    <div
      role={reply.tone === "error" ? "alert" : "status"}
      className="rounded-lg rounded-bl-sm bg-[var(--head)] px-3 py-2 text-sm"
    >
      {reply.modelText !== undefined ? (
        <p className="whitespace-pre-line">{reply.modelText}</p>
      ) : reply.plan === undefined ? (
        <p>{text}{reasonText}{reasonLine}
        {reply.adminLink === true ? (
          <>
            {" "}
            <Link href="/admin/ai">{tAdmin("adminAiLink")}</Link>
          </>
        ) : null}
        </p>
      ) : null}
      {reply.warning === true ? <p>{tAdmin("partialWarning")}</p> : null}
      {reply.actions !== undefined ? (
        <>
          {reply.modelText !== undefined ? (
            <p className="mt-2 font-medium">{tAdmin(reply.plan !== undefined ? "proposedHeading" : "resultsHeading")}</p>
          ) : null}
          <ul className="mt-2 list-disc pl-5">
            {reply.actions.map((action, index) => {
              const [actionText, actionReason, actionWhat] = textOf(action);
              return (
                <li key={`${index}-${action.messageKey}`}>
                  <span>{action.index}{"."} </span>
                  <strong>{actionStatuses[action.status]}{":"} </strong>
                  {actionText}{actionReason}{actionWhat}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
      {reply.plan !== undefined ? <p className="mt-2">{text}</p> : null}
    </div>
  );
}
