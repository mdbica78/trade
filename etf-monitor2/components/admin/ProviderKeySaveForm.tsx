"use client";

import { useActionState, useRef } from "react";
import { ActionMessage } from "./ActionMessage";
import { IDLE_STATE, type AdminActionState } from "./action-state";

type ProviderKeySaveAction = (prevState: AdminActionState, formData: FormData) => Promise<AdminActionState>;

export function resetAfterSuccessfulAction(
  action: ProviderKeySaveAction,
  reset: () => void,
): ProviderKeySaveAction {
  return async (previous, formData) => {
    const state = await action(previous, formData);
    if (state.status === "success") reset();
    return state;
  };
}

export function ProviderKeySaveForm({
  action,
  providerId,
  inputLabel,
  submitLabel,
}: {
  action: ProviderKeySaveAction;
  providerId: string;
  inputLabel: string;
  submitLabel: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    resetAfterSuccessfulAction(action, () => formRef.current?.reset()),
    IDLE_STATE,
  );

  return (
    <form ref={formRef} action={formAction} className="mb-2 flex flex-wrap items-end gap-2 last:mb-0">
      <input type="hidden" name="providerId" value={providerId} />
      <label>
        {inputLabel}
        <input type="password" name="key" autoComplete="off" />
      </label>
      <button type="submit" disabled={pending}>
        {submitLabel}
      </button>
      <ActionMessage state={state} />
    </form>
  );
}
