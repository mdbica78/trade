import { useTranslations } from "next-intl";
import Link from "next/link";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function AppHeader() {
  const t = useTranslations();

  return (
    <header className="flex items-center justify-between border-b border-black/[.08] px-6 py-4 dark:border-white/[.145]">
      <span className="font-semibold">{t("App.name")}</span>
      <nav className="flex items-center gap-4">
        <Link href="/">{t("Nav.home")}</Link>
        <Link href="/health">{t("Nav.health")}</Link>
        <LanguageSwitcher />
      </nav>
    </header>
  );
}
