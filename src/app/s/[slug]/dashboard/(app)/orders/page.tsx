import { db } from "@/db";
import { shippingProviders, tenantShippingProviders, diningTables } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireStaffPage } from "@/lib/tenant";
import { getT } from "@/lib/server-i18n";
import { ordersFeed } from "@/actions/store";
import { OrdersBoard } from "@/components/dashboard/orders-board";

export const dynamic = "force-dynamic";

export default async function OrdersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant } = await requireStaffPage(slug, "orders");
  const { t } = await getT();
  const [initial, carriers, tables] = await Promise.all([
    ordersFeed(slug),
    db.select({ id: shippingProviders.id, name: shippingProviders.name, nameAr: shippingProviders.nameAr, trackingUrlTemplate: shippingProviders.trackingUrlTemplate }).from(tenantShippingProviders).innerJoin(shippingProviders, eq(shippingProviders.id, tenantShippingProviders.providerId)).where(and(eq(tenantShippingProviders.tenantId, tenant.id), eq(tenantShippingProviders.enabledByAdmin, true), eq(tenantShippingProviders.active, true), eq(shippingProviders.active, true))),
    db.select({ id: diningTables.id, name: diningTables.name }).from(diningTables).where(eq(diningTables.tenantId, tenant.id)),
  ]);
  return <div className="space-y-4"><h1 className="text-2xl font-extrabold">{t("nav_orders")}</h1><OrdersBoard slug={slug} initial={initial} currency={tenant.currency} carriers={carriers} tables={Object.fromEntries(tables.map((x) => [x.id, x.name]))} /></div>;
}
