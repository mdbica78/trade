import { useTranslations } from "next-intl";
import Link from "next/link";
import { ADMIN_SECTIONS } from "./sections";

export function AdminNav() {
  const t = useTranslations("Admin.nav");

  return (
    <nav className="flex items-center gap-4">
      {ADMIN_SECTIONS.map((section) => (
        <Link key={section.href} href={section.href}>
          {t(section.labelKey)}
        </Link>
      ))}
    </nav>
  );
}
