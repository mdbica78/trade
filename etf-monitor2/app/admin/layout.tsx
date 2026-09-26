import { useTranslations } from "next-intl";
import { AdminNav } from "@/components/admin/AdminNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Admin");

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <AdminNav />
      {children}
    </div>
  );
}
