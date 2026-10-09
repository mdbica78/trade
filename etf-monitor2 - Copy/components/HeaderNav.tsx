"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavActive } from "./header-nav";

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

export function HeaderNav() {
  const t = useTranslations();
  const pathname = usePathname();

  const links = [
    { href: "/", label: t("Nav.home"), icon: <IconHome /> },
    { href: "/chat", label: t("Nav.chat"), icon: <IconChat /> },
    { href: "/admin", label: t("Nav.admin"), icon: <IconAdmin /> },
    { href: "/health", label: t("Nav.health"), icon: <IconHealth /> },
  ];

  return (
    <nav data-app-nav className="flex items-center justify-center gap-0.5">
      {links.map((link) => {
        const active = isNavActive(link.href, pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-label={link.label}
            aria-current={active ? "page" : undefined}
            className="flex items-center gap-1.5 text-sm"
          >
            {link.icon}
            <span className="hidden sm:inline">{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
