import { db } from "@/db";
import { subscriptionInvoices, tenants, plans } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireAdminPage } from "@/lib/tenant";
import { getT } from "@/lib/server-i18n";
import { formatDate, formatMoney } from "@/lib/utils";
import { Badge } from "@/components/ui";
import { InvoiceActions } from "@/components/admin/forms";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  await requireAdminPage("billing");
  const { t, locale } = await getT();
  const rows = await db.select({ inv: subscriptionInvoices, tenant: tenants, plan: plans }).from(subscriptionInvoices).innerJoin(tenants, eq(tenants.id, subscriptionInvoices.tenantId)).innerJoin(plans, eq(plans.id, subscriptionInvoices.planId)).orderBy(desc(subscriptionInvoices.createdAt)).limit(200);
  return (
    <div className="card">
      <h1 className="mb-4 text-2xl font-extrabold">{t("admin_invoices")}</h1>
      <table className="table">
        <thead><tr><th>#</th><th>{t("store_name")}</th><th>{t("plan")}</th><th>{t("period")}</th><th>{t("amount")}</th><th>{t("method")}</th><th>{t("status")}</th><th>{t("date")}</th><th></th></tr></thead>
        <tbody>
          {rows.map(({ inv, tenant, plan }) => (
            <tr key={inv.id}>
              <td>{inv.id}</td><td className="font-medium">{locale === "ar" ? tenant.nameAr : tenant.name}</td><td>{locale === "ar" ? plan.nameAr : plan.name}</td>
              <td>{t(inv.period === "yearly" ? "billing_yearly" : "billing_monthly")}</td><td>{formatMoney(inv.amount, inv.currency, locale)}</td><td>{inv.method}</td>
              <td><Badge tone={inv.status === "paid" ? "green" : inv.status === "pending" ? "amber" : "slate"}>{t(inv.status as "paid")}</Badge></td>
              <td>{formatDate(inv.createdAt, locale, true)}</td>
              <td>{inv.status === "pending" && <InvoiceActions id={inv.id} />}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={9} className="py-6 text-center text-slate-500">{t("none")}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
