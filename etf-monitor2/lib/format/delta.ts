import type { Locale } from "@/i18n/locale";
import { formatNumber } from "./number";
import { deltaDirection } from "./delta-direction";

/**
 * Renders a `computeDelta().absolute` canonical string with an explicit sign (`+`/`-`, none for
 * zero — including a defensive `"-0.00"` input, which never renders as a signed zero) and the
 * locale's decimal mark (DEC-007). US-017 AC5.
 */
export function formatDeltaAbsolute(canonical: string, locale: Locale): string {
  switch (deltaDirection(canonical)) {
    case "flat":
      return formatNumber(canonical.replace(/^-/, ""), locale);
    case "loss":
      return formatNumber(canonical, locale);
    case "gain":
      return `+${formatNumber(canonical, locale)}`;
  }
}

/**
 * Renders a `computeDelta().percent` canonical string the same way as `formatDeltaAbsolute`,
 * with `%` immediately after the number, no space (US-017 AC5). Never called with `null` — the
 * caller renders nothing for a `null` percent.
 */
export function formatDeltaPercent(canonical: string, locale: Locale): string {
  return `${formatDeltaAbsolute(canonical, locale)}%`;
}
