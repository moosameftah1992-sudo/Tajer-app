import Link from "next/link";
import { redirect } from "next/navigation";
import { mustTenant, getStoreBase } from "@/lib/tenant";
import { getStaffSession } from "@/lib/auth";
import { getT } from "@/lib/server-i18n";
import { pick } from "@/lib/i18n";
import { Logo } from "@/components/ui";
import { LanguageSwitcher } from "@/components/locale-provider";
import { StaffLoginForm } from "@/components/dashboard/forms";

export const dynamic = "force-dynamic";

export default async function StaffLoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await mustTenant(slug);
  const base = await getStoreBase(slug);
  if (await getStaffSession(tenant.id)) redirect(`${base}/dashboard`);
  const { t, locale } = await getT();
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between"><Logo /><LanguageSwitcher /></div>
        <h1 className="text-2xl font-extrabold">{t("staff_login_title")}</h1>
        <p className="mb-6 mt-1 text-slate-600">{pick(locale, tenant.name, tenant.nameAr)}</p>
        <StaffLoginForm slug={slug} />
        <p className="mt-4 text-center text-sm text-slate-500"><Link href={base || "/"} className="hover:underline">{t("back_to_store")}</Link></p>
      </div>
    </div>
  );
}
