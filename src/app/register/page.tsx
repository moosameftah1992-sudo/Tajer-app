import Link from "next/link";
import { getT } from "@/lib/server-i18n";
import { rootDomain } from "@/lib/tenant";
import { Logo } from "@/components/ui";
import { LanguageSwitcher } from "@/components/locale-provider";
import { OnboardingWizard } from "@/components/platform/onboarding-wizard";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const { t } = await getT();
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
        <Link href="/"><Logo /></Link>
        <div className="flex items-center gap-2"><LanguageSwitcher /><Link href="/login" className="btn-outline">{t("cta_merchant_login")}</Link></div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16">
        <h1 className="text-3xl font-extrabold">{t("onboarding_title")}</h1>
        <p className="mb-6 mt-2 text-slate-600">{t("onboarding_subtitle")}</p>
        <OnboardingWizard rootDomain={rootDomain()} />
      </main>
    </div>
  );
}
