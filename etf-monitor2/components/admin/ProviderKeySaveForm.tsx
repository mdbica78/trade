"use client";

import { useActionState, useEffect, useRef } from "react";
import { ActionMessage } from "./ActionMessage";
import { IDLE_STATE, type AdminActionState } from "./action-state";

type ProviderKeySaveAction = (prevState: AdminActionState, formData: FormData) => Promise<AdminActionState>;

export function resetFormAfterSuccessfulAction(
  state: AdminActionState,
  form: Pick<HTMLFormElement, "reset"> | null,
): void {
  if (state.status === "success") form?.reset();
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
  const [state, formAction, pending] = useActionState(action, IDLE_STATE);

  useEffect(() => {
    resetFormAfterSuccessfulAction(state, formRef.current);
  }, [state]);

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
