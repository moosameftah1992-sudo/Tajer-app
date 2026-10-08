import Link from "next/link";
import { db } from "@/db";
import { subscriptionInvoices, plans } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireStaffPage, getActivePlans, getPlatformSettings } from "@/lib/tenant";
import { getT } from "@/lib/server-i18n";
import { formatDate, formatMoney } from "@/lib/utils";
import { Logo, Badge } from "@/components/ui";
import { LanguageSwitcher } from "@/components/locale-provider";
import { RenewalPlans, StaffLogoutButton } from "@/components/dashboard/forms";

export const dynamic = "force-dynamic";

export default async function SubscriptionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, staff, base, sub } = await requireStaffPage(slug, undefined, { allowLocked: true });
  const { t, locale } = await getT();
  const [activePlans, settings, invoices] = await Promise.all([getActivePlans(), getPlatformSettings(), db.select({ inv: subscriptionInvoices, plan: plans }).from(subscriptionInvoices).innerJoin(plans, eq(plans.id, subscriptionInvoices.planId)).where(eq(subscriptionInvoices.tenantId, tenant.id)).orderBy(desc(subscriptionInvoices.createdAt)).limit(10)]);
  const pending = invoices.find((i) => i.inv.status === "pending");
  const currentPlan = activePlans.find((p) => p.id === tenant.planId);
  const canRenew = staff.role === "owner" || staff.role === "admin";
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4"><Link href={`${base}/dashboard`}><Logo /></Link><div className="flex items-center gap-2"><LanguageSwitcher /><div className="w-32"><StaffLogoutButton slug={slug} /></div></div></header>
      <main className="mx-auto max-w-5xl space-y-6 px-4 pb-16">
        {!sub.active ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
            <div className="text-5xl">🔒</div>
            <h1 className="mt-3 text-3xl font-extrabold text-rose-700">{t("subscription_expired_title")}</h1>
            <p className="mx-auto mt-2 max-w-2xl text-rose-700/80">{t("subscription_expired_sub")}</p>
            {sub.suspended && <p className="mt-2 font-semibold text-rose-700">{t("suspended")}</p>}
          </div>
        ) : (
          <div className="card flex flex-wrap items-center justify-between gap-3">
            <div><h1 className="text-2xl font-extrabold">{t("nav_subscription")}</h1><p className="text-sm text-slate-500">{sub.isTrial ? t("trial_active") : t("subscription_active")} · {t("expires_on")} {formatDate(tenant.subscriptionEndsAt, locale, true)}</p></div>
            <div className="flex items-center gap-2"><Badge tone="green">{t("days_left", { n: sub.daysLeft })}</Badge>{currentPlan && <Badge tone="blue">{t("current_plan")}: {locale === "ar" ? currentPlan.nameAr : currentPlan.name}</Badge>}<Link href={`${base}/dashboard`} className="btn-outline">{t("dashboard")}</Link></div>
          </div>
        )}
        {pending && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{t("renewal_pending")} — {locale === "ar" ? pending.plan.nameAr : pending.plan.name} · {formatMoney(pending.inv.amount, pending.inv.currency, locale)}</div>}
        <section>
          <h2 className="mb-3 text-xl font-bold">{t("choose_plan")}</h2>
          <RenewalPlans slug={slug} plans={activePlans} canRenew={canRenew && !pending} />
          <p className="mt-3 text-sm text-slate-500">{t("bank_transfer_hint")}{settings.bankDetails && <span className="mt-1 block whitespace-pre-line rounded-lg bg-white p-3 text-slate-700">{settings.bankDetails}</span>}</p>
        </section>
        <section className="card">
          <h2 className="mb-3 font-bold">{t("your_invoices")}</h2>
          <table className="table"><thead><tr><th>#</th><th>{t("plan")}</th><th>{t("period")}</th><th>{t("amount")}</th><th>{t("status")}</th><th>{t("date")}</th></tr></thead>
            <tbody>{invoices.map(({ inv, plan }) => <tr key={inv.id}><td>{inv.id}</td><td>{locale === "ar" ? plan.nameAr : plan.name}</td><td>{t(inv.period === "yearly" ? "billing_yearly" : "billing_monthly")}</td><td>{formatMoney(inv.amount, inv.currency, locale)}</td><td><Badge tone={inv.status === "paid" ? "green" : inv.status === "pending" ? "amber" : "slate"}>{t(inv.status as "paid")}</Badge></td><td>{formatDate(inv.createdAt, locale, true)}</td></tr>)}{!invoices.length && <tr><td colSpan={6} className="text-center text-slate-500">{t("none")}</td></tr>}</tbody></table>
        </section>
      </main>
    </div>
  );
}
