import Link from "next/link";
import { getT } from "@/lib/server-i18n";
import { Logo } from "@/components/ui";
import { LanguageSwitcher } from "@/components/locale-provider";
import { MerchantLoginForm } from "@/components/platform/merchant-login";

export const dynamic = "force-dynamic";

export default async function MerchantLoginPage() {
  const { t } = await getT();
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="mx-auto flex max-w-md items-center justify-between px-4 py-4">
        <Link href="/"><Logo /></Link>
        <LanguageSwitcher />
      </header>
      <main className="mx-auto max-w-md px-4 pb-16">
        <h1 className="text-3xl font-extrabold">{t("merchant_login_title")}</h1>
        <p className="mb-6 mt-2 text-slate-600">{t("merchant_login_sub")}</p>
        <MerchantLoginForm />
      </main>
    </div>
  );
}
