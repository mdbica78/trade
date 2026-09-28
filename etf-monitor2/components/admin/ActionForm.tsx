"use client";

import { useActionState } from "react";
import { ActionMessage } from "./ActionMessage";
import { IDLE_STATE, type AdminActionState } from "./action-state";

export function ActionForm({
  action,
  submitLabel,
  children,
}: {
  action: (prevState: AdminActionState, formData: FormData) => Promise<AdminActionState>;
  submitLabel: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, IDLE_STATE);

  return (
    <form action={formAction} className="mb-2 flex flex-wrap items-end gap-2 last:mb-0">
      {children}
      <button type="submit" disabled={pending}>
        {submitLabel}
      </button>
      <ActionMessage state={state} />
    </form>
  );
}
