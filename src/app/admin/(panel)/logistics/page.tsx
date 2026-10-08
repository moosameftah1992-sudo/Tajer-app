import { db } from "@/db";
import { shippingProviders, logisticsEvents, tenants } from "@/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { requireAdminPage, getRequestOrigin } from "@/lib/tenant";
import { getT } from "@/lib/server-i18n";
import { formatDate } from "@/lib/utils";
import { ProvidersManager } from "@/components/admin/forms";

export const dynamic = "force-dynamic";

export default async function LogisticsPage() {
  await requireAdminPage("logistics");
  const { t, locale } = await getT();
  const [providers, events, origin] = await Promise.all([
    db.select().from(shippingProviders).orderBy(asc(shippingProviders.id)),
    db.select({ ev: logisticsEvents, tenantName: tenants.name, providerCode: shippingProviders.code }).from(logisticsEvents).leftJoin(tenants, eq(tenants.id, logisticsEvents.tenantId)).innerJoin(shippingProviders, eq(shippingProviders.id, logisticsEvents.providerId)).orderBy(desc(logisticsEvents.createdAt)).limit(30),
    getRequestOrigin(),
  ]);
  return (
    <div className="space-y-6">
      <ProvidersManager providers={providers} webhookBase={origin} />
      <div className="card">
        <h2 className="mb-3 text-lg font-bold">{t("logistics_events")}</h2>
        {events.length ? (
          <table className="table"><thead><tr><th>{t("date")}</th><th>{t("carrier")}</th><th>{t("store_name")}</th><th>{t("tracking")}</th><th>{t("status")}</th></tr></thead>
            <tbody>{events.map((e) => <tr key={e.ev.id}><td>{formatDate(e.ev.createdAt, locale, true)}</td><td>{e.providerCode}</td><td>{e.tenantName ?? "-"}</td><td dir="ltr">{e.ev.tracking}</td><td>{e.ev.event}</td></tr>)}</tbody></table>
        ) : <p className="text-sm text-slate-500">{t("no_events")}</p>}
      </div>
    </div>
  );
}
