import type { Locale } from "@/i18n/locale";
import { formatNumber } from "./number";

/** True when every digit in a canonical decimal string is `0` (`"0"`, `"0.000"`, `"-0.00"`). */
function isZeroMagnitude(canonical: string): boolean {
  return /^-?0(\.0+)?$/.test(canonical);
}

function withExplicitSign(canonical: string, locale: Locale): string {
  if (isZeroMagnitude(canonical)) {
    const unsigned = canonical.startsWith("-") ? canonical.slice(1) : canonical;
    return formatNumber(unsigned, locale);
  }
  if (canonical.startsWith("-")) {
    return formatNumber(canonical, locale);
  }
  return `+${formatNumber(canonical, locale)}`;
}

/**
 * Renders a `computeDelta().absolute` canonical string with an explicit sign (`+`/`-`, none for
 * zero — including a defensive `"-0.00"` input, which never renders as a signed zero) and the
 * locale's decimal mark (DEC-007). US-017 AC5.
 */
export function formatDeltaAbsolute(canonical: string, locale: Locale): string {
  return withExplicitSign(canonical, locale);
}

/**
 * Renders a `computeDelta().percent` canonical string the same way as `formatDeltaAbsolute`,
 * with `%` immediately after the number, no space (US-017 AC5). Never called with `null` — the
 * caller renders nothing for a `null` percent.
 */
export function formatDeltaPercent(canonical: string, locale: Locale): string {
  return `${withExplicitSign(canonical, locale)}%`;
}
