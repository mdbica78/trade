import { useLocale, useTranslations } from "next-intl";
import { setLocale } from "@/i18n/actions";
import { locales } from "@/i18n/locale";

export function LanguageSwitcher() {
  const t = useTranslations("LanguageSwitcher");
  const currentLocale = useLocale();

  return (
    <form action={setLocale} aria-label={t("label")} className="flex gap-1">
      {locales.map((locale) => {
        const isCurrent = locale === currentLocale;
        return (
          <button
            key={locale}
            type="submit"
            name="locale"
            value={locale}
            disabled={isCurrent}
            aria-current={isCurrent ? "true" : undefined}
            className="rounded px-2 py-1 text-sm font-medium disabled:opacity-50"
          >
            {t(locale)}
          </button>
        );
      })}
    </form>
  );
}
