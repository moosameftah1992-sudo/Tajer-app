import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { mustTenant, getStoreBase, subscriptionState } from "@/lib/tenant";
import { getCustomerSession } from "@/lib/auth";
import { resolveTheme } from "@/lib/templates";
import { getT } from "@/lib/server-i18n";
import { pick } from "@/lib/i18n";
import { StoreProvider } from "@/components/storefront/store-provider";
import { StoreShell } from "@/components/storefront/shell";
import { LanguageSwitcher } from "@/components/locale-provider";

export const dynamic = "force-dynamic";

export default async function ShopLayout({ params, children }: { params: Promise<{ slug: string }>; children: ReactNode }) {
  const { slug } = await params;
  const tenant = await mustTenant(slug);
  const { t, locale } = await getT();
  const sub = subscriptionState(tenant);
  if (!sub.active) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] px-4 text-center">
        <div className="text-6xl">🛠️</div>
        <h1 className="mt-6 text-3xl font-extrabold text-slate-900">{t("maintenance_title")}</h1>
        <p className="mt-2 text-slate-600">{t("maintenance_sub")}</p>
        <p className="mt-6 text-sm font-semibold text-slate-500">{pick(locale, tenant.name, tenant.nameAr)}</p>
        <div className="mt-6"><LanguageSwitcher /></div>
      </div>
    );
  }
  const base = await getStoreBase(slug);
  const { tpl, vars } = resolveTheme(tenant);
  const customer = await getCustomerSession(tenant.id);
  const jar = await cookies();
  const tableCode = tenant.dineInEnabled ? jar.get(`tajer_table_${tenant.id}`)?.value ?? null : null;
  return (
    <StoreProvider info={{ slug, base, tenantId: tenant.id, currency: tenant.currency, name: tenant.name, nameAr: tenant.nameAr, tableCode, customerName: customer?.name ?? null }}>
      <StoreShell tenant={tenant} tpl={tpl} base={base} vars={vars} customer={customer?.name ?? null}>{children}</StoreShell>
    </StoreProvider>
  );
}
