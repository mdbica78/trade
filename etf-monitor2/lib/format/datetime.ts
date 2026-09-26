import type { Locale } from "@/i18n/locale";

const TIME_ZONE = "Europe/Bucharest";

const FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * A timestamp shown in Europe/Bucharest, 24-hour, independent of the process time zone
 * (`sprint-05.md` decision #16). `ro` `DD.MM.YYYY HH:mm`, `en` `YYYY-MM-DD HH:mm`. An invalid
 * date is returned as the input string, never throws.
 */
export function formatDateTime(iso: string, locale: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  const parts = FORMATTER.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");

  return locale === "ro" ? `${day}.${month}.${year} ${hour}:${minute}` : `${year}-${month}-${day} ${hour}:${minute}`;
}
