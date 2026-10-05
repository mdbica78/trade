"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavActive } from "./header-nav";
import { Icon } from "./Icon";

export function HeaderNav() {
  const t = useTranslations();
  const pathname = usePathname();

  const links = [
    { href: "/", label: t("Nav.home"), icon: <Icon><path d="M3 11.5l4-5 3 3 4-6 3 4" /><path d="M3 15h14" /></Icon> },
    { href: "/chat", label: t("Nav.chat"), icon: <Icon><path d="M3 4.5h14v9H8.5l-3 3v-3H3z" /></Icon> },
    { href: "/admin", label: t("Nav.admin"), icon: <Icon><circle cx="10" cy="10" r="2.5" /><path d="M10 2.8v2M10 15.2v2M17.2 10h-2M4.8 10h-2M15 5l-1.4 1.4M6.4 13.6L5 15M15 15l-1.4-1.4M6.4 6.4L5 5" /></Icon> },
    { href: "/health", label: t("Nav.health"), icon: <Icon><path d="M3 10.5h3l2 5 4-11 2 6h3" /></Icon> },
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
