import { useTranslations } from "next-intl";
import Link from "next/link";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { HeaderNav } from "./HeaderNav";
import { ThemeToggle } from "./ThemeToggle";

export function AppHeader() {
  const t = useTranslations();

  return (
    <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2.5 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:px-6">
      <Link href="/" className="flex items-center !text-[var(--text)]">
        <span className="text-sm font-semibold tracking-tight sm:text-base">{t("App.name")}</span>
      </Link>

      <div className="order-3 w-full sm:order-none sm:w-auto">
        <HeaderNav />
      </div>

      <div data-header-controls className="flex items-center justify-end gap-2 sm:w-auto">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>
    </header>
  );
}
