import { useTranslations } from "next-intl";
import Link from "next/link";
import { ADMIN_SECTIONS } from "./sections";

export function AdminNav() {
  const t = useTranslations("Admin.nav");

  return (
    <nav className="flex flex-wrap items-center gap-1 border-b border-[var(--line)] pb-2">
      {ADMIN_SECTIONS.map((section) => (
        <Link
          key={section.href}
          href={section.href}
          className="rounded-md px-3 py-1.5 text-sm font-medium !text-[var(--muted)] hover:bg-[var(--hover)] hover:!text-[var(--text)]"
        >
          {t(section.labelKey)}
        </Link>
      ))}
    </nav>
  );
}
