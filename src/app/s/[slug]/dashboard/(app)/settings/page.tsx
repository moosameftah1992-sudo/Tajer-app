import { db } from "@/db";
import { shippingProviders, tenantShippingProviders, domains } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { requireStaffPage, publicStoreUrl } from "@/lib/tenant";
import { getT } from "@/lib/server-i18n";
import { SettingsPanel } from "@/components/dashboard/settings-forms";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant } = await requireStaffPage(slug, "settings");
  const { t } = await getT();
  const [providers, bindings, doms, storeUrl] = await Promise.all([
    db.select().from(shippingProviders).orderBy(asc(shippingProviders.id)),
    db.select().from(tenantShippingProviders).where(eq(tenantShippingProviders.tenantId, tenant.id)),
    db.select().from(domains).where(eq(domains.tenantId, tenant.id)),
    publicStoreUrl(slug),
  ]);
  return <div className="space-y-4"><h1 className="text-2xl font-extrabold">{t("settings_title")}</h1><SettingsPanel slug={slug} tenant={tenant} providers={providers} bindings={bindings} domains={doms} storeUrl={storeUrl} /></div>;
}
