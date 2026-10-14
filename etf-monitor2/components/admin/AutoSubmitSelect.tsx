"use client";

import type { SelectHTMLAttributes } from "react";

/**
 * A <select> that submits its enclosing form as soon as the user picks an
 * option, instead of requiring a separate "show"/"save" button press
 * (design fix: choosing a value should act immediately). The fallback
 * submit button next to it stays in the markup (progressive enhancement)
 * and is hidden purely via CSS — see `label[data-autosubmit] + button`
 * in globals.css.
 */
export function AutoSubmitSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { onChange, ...rest } = props;
  return (
    <select
      {...rest}
      onChange={(event) => {
        onChange?.(event);
        event.currentTarget.form?.requestSubmit();
      }}
    />
  );
}
