import Link from "next/link";
import { db } from "@/db";
import { orders, products, orderItems } from "@/db/schema";
import { and, count, desc, eq, gte, ne, sql } from "drizzle-orm";
import { requireStaffPage } from "@/lib/tenant";
import { getT } from "@/lib/server-i18n";
import { formatMoney, formatDate, toNum } from "@/lib/utils";
import { StatCard, BarChart, Badge, Alert } from "@/components/ui";
import type { TKey } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function DashboardHome({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ forbidden?: string }> }) {
  const { slug } = await params;
  const { forbidden } = await searchParams;
  const { tenant, base } = await requireStaffPage(slug, "dashboard");
  const { t, locale } = await getT();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const since14 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13);
  const live = and(eq(orders.tenantId, tenant.id), ne(orders.status, "cancelled"));
  const [[today], [month], [pendingCount], [prodStats], series, recent, top] = await Promise.all([
    db.select({ n: count(), total: sql<string>`coalesce(sum(${orders.total}),0)` }).from(orders).where(and(live, gte(orders.createdAt, todayStart))),
    db.select({ n: count(), total: sql<string>`coalesce(sum(${orders.total}),0)` }).from(orders).where(and(live, gte(orders.createdAt, monthStart))),
    db.select({ n: count() }).from(orders).where(and(eq(orders.tenantId, tenant.id), eq(orders.status, "pending"))),
    db.select({ n: count(), low: sql<number>`count(*) filter (where ${products.trackStock} and ${products.stock} > 0 and ${products.stock} <= ${products.lowStockThreshold})::int`, out: sql<number>`count(*) filter (where ${products.trackStock} and ${products.stock} <= 0)::int` }).from(products).where(eq(products.tenantId, tenant.id)),
    db.select({ d: sql<string>`to_char(date_trunc('day', ${orders.createdAt}), 'MM-DD')`, total: sql<string>`coalesce(sum(${orders.total}),0)` }).from(orders).where(and(live, gte(orders.createdAt, since14))).groupBy(sql`1`).orderBy(sql`1`),
    db.select().from(orders).where(eq(orders.tenantId, tenant.id)).orderBy(desc(orders.createdAt)).limit(8),
    db.select({ name: orderItems.name, nameAr: orderItems.nameAr, qty: sql<number>`sum(${orderItems.qty})::int` }).from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId)).where(and(live, gte(orders.createdAt, monthStart))).groupBy(orderItems.name, orderItems.nameAr).orderBy(desc(sql`sum(${orderItems.qty})`)).limit(5),
  ]);
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(since14); d.setDate(d.getDate() + i); return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
  const chart = days.map((d) => ({ label: d, value: toNum(series.find((s) => s.d === d)?.total) }));
  const tone = (s: string) => (s === "fulfilled" ? "green" : s === "cancelled" ? "rose" : s === "pending" ? "amber" : "blue") as "green";
  return (
    <div className="space-y-6">
      {forbidden && <Alert messageKey="forbidden" />}
      <h1 className="text-2xl font-extrabold">{t("nav_home")}</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("revenue_today")} value={formatMoney(today.total, tenant.currency, locale)} sub={`${today.n} ${t("orders")}`} accent />
        <StatCard label={t("revenue_month")} value={formatMoney(month.total, tenant.currency, locale)} sub={`${month.n} ${t("orders")} · ${t("avg_order")} ${formatMoney(month.n ? toNum(month.total) / month.n : 0, tenant.currency, locale)}`} />
        <StatCard label={t("pending_orders")} value={pendingCount.n} />
        <StatCard label={t("products_count")} value={prodStats.n} sub={`${t("low_stock")}: ${prodStats.low} · ${t("out_of_stock")}: ${prodStats.out}`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2"><h2 className="mb-3 font-bold">{t("sales_last_14")}</h2><BarChart data={chart} /></div>
        <div className="card"><h2 className="mb-3 font-bold">{t("top_products")}</h2>{top.length ? <ul className="space-y-2 text-sm">{top.map((p) => <li key={p.name} className="flex justify-between"><span className="truncate">{locale === "ar" ? p.nameAr || p.name : p.name}</span><b>{p.qty}</b></li>)}</ul> : <p className="text-sm text-slate-500">{t("no_data")}</p>}</div>
      </div>
      <div className="card">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">{t("recent_orders")}</h2><Link href={`${base}/dashboard/orders`} className="text-sm font-semibold text-emerald-600">{t("view_all")}</Link></div>
        {recent.length ? (
          <table className="table"><thead><tr><th>{t("order_number")}</th><th>{t("customer")}</th><th>{t("fulfillment")}</th><th>{t("total")}</th><th>{t("status")}</th><th>{t("date")}</th></tr></thead>
            <tbody>{recent.map((o) => <tr key={o.id}><td className="font-mono">{o.orderNumber}</td><td>{o.customerName || t("walk_in")}</td><td>{t(`fulfillment_${o.fulfillmentType}` as TKey)}</td><td>{formatMoney(o.total, o.currency, locale)}</td><td><Badge tone={tone(o.status)}>{t(`status_${o.status}` as TKey)}</Badge></td><td>{formatDate(o.createdAt, locale, true)}</td></tr>)}</tbody></table>
        ) : <p className="text-sm text-slate-500">{t("no_orders_yet")}</p>}
      </div>
    </div>
  );
}
