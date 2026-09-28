import { useTranslations } from "next-intl";
import Link from "next/link";
import { LanguageSwitcher } from "./LanguageSwitcher";

function IconHome() {
  return (
    <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11.5l4-5 3 3 4-6 3 4" />
      <path d="M3 15h14" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 4.5h14v9H8.5l-3 3v-3H3z" />
    </svg>
  );
}

function IconAdmin() {
  return (
    <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 2.8v2M10 15.2v2M17.2 10h-2M4.8 10h-2M15 5l-1.4 1.4M6.4 13.6L5 15M15 15l-1.4-1.4M6.4 6.4L5 5" />
    </svg>
  );
}

function IconHealth() {
  return (
    <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10.5h3l2 5 4-11 2 6h3" />
    </svg>
  );
}

export function AppHeader() {
  const t = useTranslations();

  const links = [
    { href: "/", label: t("Nav.home"), icon: <IconHome /> },
    { href: "/chat", label: t("Nav.chat"), icon: <IconChat /> },
    { href: "/admin", label: t("Nav.admin"), icon: <IconAdmin /> },
    { href: "/health", label: t("Nav.health"), icon: <IconHealth /> },
  ];

  return (
    <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg-panel)] px-4 py-2.5 sm:px-6">
      <Link href="/" className="flex items-center gap-2 !text-[var(--text)]">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
          <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 15.5l4-5.5 3 3 6-9" />
          </svg>
        </span>
        <span className="text-sm font-semibold tracking-tight sm:text-base">{t("App.name")}</span>
      </Link>

      <nav className="flex flex-1 items-center gap-0.5 sm:flex-none">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm !text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:!text-[var(--text)]"
          >
            {link.icon}
            <span className="hidden sm:inline">{link.label}</span>
          </Link>
        ))}
      </nav>

      <LanguageSwitcher />
    </header>
  );
}
