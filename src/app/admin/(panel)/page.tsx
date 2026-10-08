import Link from "next/link";
import { db } from "@/db";
import { tenants, orders, subscriptionInvoices, plans } from "@/db/schema";
import { and, count, desc, eq, ne, sql } from "drizzle-orm";
import { getT } from "@/lib/server-i18n";
import { getPlatformSettings, getActivePlans, subscriptionState } from "@/lib/tenant";
import { platformStats } from "@/actions/platform";
import { formatMoney, formatDate, toNum } from "@/lib/utils";
import { getTemplate } from "@/lib/templates";
import { StatCard, BarChart, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const { t, locale } = await getT();
  const [stats, settings, activePlans] = await Promise.all([platformStats(), getPlatformSettings(), getActivePlans()]);
  const [[rev], [gmv], recent, byTemplate, revSeries] = await Promise.all([
    db.select({ total: sql<string>`coalesce(sum(${subscriptionInvoices.amount}),0)` }).from(subscriptionInvoices).where(eq(subscriptionInvoices.status, "paid")),
    db.select({ total: sql<string>`coalesce(sum(${orders.total}),0)`, n: count() }).from(orders).where(ne(orders.status, "cancelled")),
    db.select().from(tenants).orderBy(desc(tenants.createdAt)).limit(8),
    db.select({ templateId: tenants.templateId, n: count() }).from(tenants).groupBy(tenants.templateId).orderBy(desc(count())).limit(6),
    db
      .select({ m: sql<string>`to_char(date_trunc('month', ${subscriptionInvoices.paidAt}), 'YYYY-MM')`, total: sql<string>`coalesce(sum(${subscriptionInvoices.amount}),0)` })
      .from(subscriptionInvoices)
      .where(and(eq(subscriptionInvoices.status, "paid"), sql`${subscriptionInvoices.paidAt} > now() - interval '12 months'`))
      .groupBy(sql`1`)
      .orderBy(sql`1`),
  ]);
  const planRows = await db.select().from(plans).orderBy(plans.sort);
  const commission = (toNum(gmv.total) * toNum(settings.commissionRate)) / 100;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">{t("admin_dashboard")}</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("total_stores")} value={stats.total} />
        <StatCard label={t("active_stores")} value={stats.active} accent />
        <StatCard label={t("trial_stores")} value={stats.trial} />
        <StatCard label={t("expired_stores")} value={stats.expired} />
        <StatCard label={t("platform_revenue")} value={formatMoney(rev.total, "USD", locale)} accent />
        <StatCard label={t("gross_merchandise")} value={formatMoney(gmv.total, "USD", locale)} sub={`${gmv.n} ${t("total_orders")}`} />
        <StatCard label={t("commissions")} value={formatMoney(commission, "USD", locale)} sub={`${settings.commissionRate}%`} />
        <StatCard label={t("admin_plans")} value={activePlans.length} sub={planRows.map((p) => `${p.name}: ${p.monthlyPrice}/${p.yearlyPrice} ${p.currency}`).join(" · ")} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="mb-3 font-bold">{t("platform_revenue")}</h2>
          {revSeries.length ? <BarChart data={revSeries.map((r) => ({ label: r.m, value: toNum(r.total) }))} /> : <p className="text-sm text-slate-500">{t("no_data")}</p>}
        </div>
        <div className="card">
          <h2 className="mb-3 font-bold">{t("stores_by_template")}</h2>
          <ul className="space-y-2 text-sm">
            {byTemplate.map((r) => { const tp = getTemplate(r.templateId); return <li key={r.templateId} className="flex justify-between"><span>{locale === "ar" ? tp.nameAr : tp.name}</span><b>{r.n}</b></li>; })}
          </ul>
        </div>
      </div>
      <div className="card">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">{t("recent_stores")}</h2><Link href="/admin/merchants" className="text-sm font-semibold text-emerald-600">{t("view_all")}</Link></div>
        <table className="table">
          <thead><tr><th>{t("store_name")}</th><th>{t("store_slug")}</th><th>{t("currency")}</th><th>{t("subscription_status")}</th><th>{t("subscription_ends")}</th></tr></thead>
          <tbody>
            {recent.map((s) => { const st = subscriptionState(s); return (
              <tr key={s.id}>
                <td><Link href={`/admin/merchants/${s.id}`} className="font-medium text-slate-900 hover:underline">{locale === "ar" ? s.nameAr : s.name}</Link></td>
                <td dir="ltr">{s.slug}</td><td>{s.currency}</td>
                <td>{st.suspended ? <Badge tone="rose">{t("suspended")}</Badge> : st.expired ? <Badge tone="amber">{t("expired_stores")}</Badge> : st.isTrial ? <Badge tone="blue">{t("trial")}</Badge> : <Badge tone="green">{t("active")}</Badge>}</td>
                <td>{formatDate(s.subscriptionEndsAt, locale)}</td>
              </tr>); })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
