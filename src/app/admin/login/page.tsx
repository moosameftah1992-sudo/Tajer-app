import { redirect } from "next/navigation";
import { getT } from "@/lib/server-i18n";
import { getAdminSession } from "@/lib/auth";
import { adminCount } from "@/actions/platform";
import { Logo } from "@/components/ui";
import { LanguageSwitcher } from "@/components/locale-provider";
import { AdminAuthForm } from "@/components/admin/auth-forms";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await getAdminSession()) redirect("/admin");
  const { t } = await getT();
  const setup = (await adminCount()) === 0;
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between"><Logo light /><LanguageSwitcher /></div>
        <h1 className="text-2xl font-extrabold text-white">{setup ? t("admin_setup_title") : t("admin_login_title")}</h1>
        <p className="mb-6 mt-1 text-sm text-slate-400">{setup ? t("admin_setup_sub") : t("admin_login_sub")}</p>
        <AdminAuthForm setup={setup} />
      </div>
    </div>
  );
}
