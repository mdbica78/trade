import { useTranslations } from "next-intl";

export default function AdminIndexPage() {
  const t = useTranslations("Admin.index");

  return (
    <div>
      <p>{t("intro")}</p>
    </div>
  );
}
