import { useTranslations } from "next-intl";
import { AdminNav } from "@/components/admin/AdminNav";

export default function AdminIndexPage() {
  const t = useTranslations("Admin.index");

  return (
    <div>
      <p>{t("intro")}</p>
      <AdminNav />
    </div>
  );
}
