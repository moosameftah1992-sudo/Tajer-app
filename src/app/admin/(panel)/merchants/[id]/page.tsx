import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { tenants, domains, staffUsers, shippingProviders, tenantShippingProviders, subscriptionInvoices, orders, products } from "@/db/schema";
import { and, count, desc, eq, ne, sql } from "drizzle-orm";
import { requireAdminPage, subscriptionState, getActivePlans } from "@/lib/tenant";
import { getT } from "@/lib/server-i18n";
import { formatDate, formatMoney } from "@/lib/utils";
import { getTemplate } from "@/lib/templates";
import { Badge, StatCard } from "@/components/ui";
import { SubscriptionControls, DomainsManager, TenantCarrierToggles } from "@/components/admin/forms";

export const dynamic = "force-dynamic";

export default async function MerchantDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage("merchants");
  const { id } = await params;
  const tenantId = Number(id);
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant) notFound();
  const { t, locale } = await getT();
  const [plans, doms, owner, providers, bindings, invoices, [ordersAgg], [prodCount]] = await Promise.all([
    getActivePlans(),
    db.select().from(domains).where(eq(domains.tenantId, tenantId)),
    db.select().from(staffUsers).where(and(eq(staffUsers.tenantId, tenantId), eq(staffUsers.role, "owner"))).limit(1),
    db.select().from(shippingProviders).where(eq(shippingProviders.active, true)),
    db.select().from(tenantShippingProviders).where(eq(tenantShippingProviders.tenantId, tenantId)),
    db.select().from(subscriptionInvoices).where(eq(subscriptionInvoices.tenantId, tenantId)).orderBy(desc(subscriptionInvoices.createdAt)).limit(10),
    db.select({ n: count(), total: sql<string>`coalesce(sum(${orders.total}),0)` }).from(orders).where(and(eq(orders.tenantId, tenantId), ne(orders.status, "cancelled"))),
    db.select({ n: count() }).from(products).where(eq(products.tenantId, tenantId)),
  ]);
  const st = subscriptionState(tenant);
  const tp = getTemplate(tenant.templateId);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/merchants" className="text-sm text-slate-500 hover:underline">← {t("merchant_directory")}</Link>
          <h1 className="text-2xl font-extrabold">{locale === "ar" ? tenant.nameAr : tenant.name} <span className="text-base font-normal text-slate-400" dir="ltr">/{tenant.slug}</span></h1>
        </div>
        <div className="flex items-center gap-2">
          {st.suspended ? <Badge tone="rose">{t("suspended")}</Badge> : st.expired ? <Badge tone="amber">{t("expired_stores")}</Badge> : <Badge tone="green">{st.isTrial ? t("trial_active") : t("subscription_active")} · {t("days_left", { n: st.daysLeft })}</Badge>}
          <Link href={`/s/${tenant.slug}`} className="btn-outline" target="_blank">{t("nav_storefront")}</Link>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("total_orders")} value={ordersAgg.n} />
        <StatCard label={t("gross_merchandise")} value={formatMoney(ordersAgg.total, tenant.currency, locale)} />
        <StatCard label={t("products_count")} value={prodCount.n} />
        <StatCard label={t("subscription_ends")} value={formatDate(tenant.subscriptionEndsAt, locale)} sub={`${t("template")}: ${locale === "ar" ? tp.nameAr : tp.name}`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card space-y-2 text-sm">
          <h3 className="text-lg font-bold">{t("store_info")}</h3>
          <div><span className="text-slate-500">{t("owner")}:</span> {owner[0]?.name} <span dir="ltr">({owner[0]?.email})</span></div>
          <div><span className="text-slate-500">{t("email")}:</span> <span dir="ltr">{tenant.email}</span></div>
          <div><span className="text-slate-500">{t("phone")}:</span> <span dir="ltr">{tenant.phone || "-"}</span></div>
          <div><span className="text-slate-500">{t("business_type")}:</span> {tenant.businessType}</div>
          <div><span className="text-slate-500">{t("currency")}:</span> {tenant.currency}</div>
          <div><span className="text-slate-500">{t("created_at")}:</span> {formatDate(tenant.createdAt, locale, true)}</div>
          <div><span className="text-slate-500">{t("trial_ends")}:</span> {formatDate(tenant.trialEndsAt, locale, true)}</div>
        </div>
        <SubscriptionControls tenant={tenant} plans={plans} />
        <DomainsManager tenant={tenant} domains={doms} />
        <TenantCarrierToggles tenantId={tenant.id} providers={providers} bindings={bindings} />
      </div>
      <div className="card">
        <h3 className="mb-3 text-lg font-bold">{t("invoices")}</h3>
        <table className="table">
          <thead><tr><th>#</th><th>{t("plan")}</th><th>{t("period")}</th><th>{t("amount")}</th><th>{t("status")}</th><th>{t("date")}</th></tr></thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.id}><td>{i.id}</td><td>{plans.find((p) => p.id === i.planId)?.name ?? i.planId}</td><td>{t(i.period === "yearly" ? "billing_yearly" : "billing_monthly")}</td><td>{formatMoney(i.amount, i.currency, locale)}</td><td><Badge tone={i.status === "paid" ? "green" : i.status === "pending" ? "amber" : "slate"}>{t(i.status as "paid")}</Badge></td><td>{formatDate(i.createdAt, locale, true)}</td></tr>
            ))}
            {!invoices.length && <tr><td colSpan={6} className="text-center text-slate-500">{t("none")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
