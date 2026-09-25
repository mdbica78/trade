import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, resolveLocale } from "./locale";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  const messages = (await import(`../messages/${locale}.json`)).default;
  // Decision 4 (US-016, tech-lead sprint review 2026-09-25): report dates are date-only and
  // formatted without conversion (lib/format/date.ts), but next-intl still needs a fixed zone
  // to avoid depending on the server process's own time zone (Sprint 1 audit N2).
  return { locale, messages, timeZone: "Europe/Bucharest" };
});
