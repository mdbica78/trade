import { useTranslations } from "next-intl";
import { AdminNav } from "@/components/admin/AdminNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Admin");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-6 py-10">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <AdminNav />
      <div className="flex flex-col">{children}</div>
    </div>
  );
}
