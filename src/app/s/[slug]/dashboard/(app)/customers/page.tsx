import { db } from "@/db";
import { customers, orders } from "@/db/schema";
import { and, count, desc, eq, ne, sql } from "drizzle-orm";
import { requireStaffPage } from "@/lib/tenant";
import { getT } from "@/lib/server-i18n";
import { formatDate, formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CustomersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant } = await requireStaffPage(slug, "customers");
  const { t, locale } = await getT();
  const rows = await db
    .select({ c: customers, n: count(orders.id), total: sql<string>`coalesce(sum(${orders.total}) filter (where ${orders.status} <> 'cancelled'),0)` })
    .from(customers)
    .leftJoin(orders, and(eq(orders.customerId, customers.id), eq(orders.tenantId, tenant.id), ne(orders.status, "cancelled")))
    .where(eq(customers.tenantId, tenant.id))
    .groupBy(customers.id)
    .orderBy(desc(customers.createdAt))
    .limit(500);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">{t("nav_customers")} <span className="text-base font-normal text-slate-400">({rows.length})</span></h1>
      <div className="card overflow-x-auto">
        <table className="table"><thead><tr><th>{t("name")}</th><th>{t("email")}</th><th>{t("phone")}</th><th>{t("city")}</th><th>{t("orders")}</th><th>{t("total")}</th><th>{t("created_at")}</th></tr></thead>
          <tbody>{rows.map(({ c, n, total }) => <tr key={c.id}><td className="font-medium">{c.name}</td><td dir="ltr">{c.email.endsWith("@pos.local") ? "-" : c.email}</td><td dir="ltr">{c.phone || "-"}</td><td>{c.city || "-"}</td><td>{n}</td><td>{formatMoney(total, tenant.currency, locale)}</td><td>{formatDate(c.createdAt, locale)}</td></tr>)}{!rows.length && <tr><td colSpan={7} className="py-6 text-center text-slate-500">{t("none")}</td></tr>}</tbody></table>
      </div>
    </div>
  );
}
