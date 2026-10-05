"use client";

import { useTranslations } from "next-intl";
import { toggleTheme } from "@/lib/theme";
import { Icon } from "./Icon";

export function ThemeToggle() {
  const t = useTranslations();

  return (
    <button
      type="button"
      data-theme-toggle
      aria-label={t("Theme.toggleLabel")}
      onClick={() =>
        toggleTheme({
          root: document.documentElement,
          getStorage: () => window.localStorage,
        })
      }
    >
      <Icon className="sm:hidden">
        <path d="M10 3v2M10 15v2M17 10h-2M5 10H3M14.9 5.1l-1.4 1.4M6.5 13.5l-1.4 1.4M14.9 14.9l-1.4-1.4M6.5 6.5L5.1 5.1" />
        <circle cx="10" cy="10" r="3.2" />
      </Icon>
      <span className="hidden sm:inline">{t("Theme.toggleText")}</span>
    </button>
  );
}
