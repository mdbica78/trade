import type ro from "./messages/ro.json";
import type { Locale } from "./i18n/locale";

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof ro;
  }
}
