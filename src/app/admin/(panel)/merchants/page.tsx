import Link from "next/link";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { desc, ilike, or } from "drizzle-orm";
import { requireAdminPage, subscriptionState } from "@/lib/tenant";
import { getT } from "@/lib/server-i18n";
import { formatDate } from "@/lib/utils";
import { getTemplate } from "@/lib/templates";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MerchantsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdminPage("merchants");
  const { t, locale } = await getT();
  const { q = "" } = await searchParams;
  const list = await db.select().from(tenants).where(q ? or(ilike(tenants.name, `%${q}%`), ilike(tenants.slug, `%${q}%`), ilike(tenants.email, `%${q}%`)) : undefined).orderBy(desc(tenants.createdAt)).limit(300);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t("merchant_directory")}</h1>
        <form className="flex gap-2"><input name="q" defaultValue={q} className="input w-64" placeholder={t("search")} /><button className="btn-primary">{t("search")}</button></form>
      </div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>{t("store_name")}</th><th>{t("store_slug")}</th><th>{t("email")}</th><th>{t("currency")}</th><th>{t("template")}</th><th>{t("billing_cycle")}</th><th>{t("subscription_status")}</th><th>{t("subscription_ends")}</th><th></th></tr></thead>
          <tbody>
            {list.map((s) => { const st = subscriptionState(s); const tp = getTemplate(s.templateId); return (
              <tr key={s.id}>
                <td className="font-medium">{locale === "ar" ? s.nameAr : s.name}</td>
                <td dir="ltr">{s.slug}</td><td dir="ltr">{s.email}</td><td>{s.currency}</td>
                <td>{locale === "ar" ? tp.nameAr : tp.name}</td>
                <td>{t(s.billingCycle === "trial" ? "trial" : s.billingCycle === "yearly" ? "billing_yearly" : "billing_monthly")}</td>
                <td>{st.suspended ? <Badge tone="rose">{t("suspended")}</Badge> : st.expired ? <Badge tone="amber">{t("expired_stores")}</Badge> : <Badge tone="green">{t("days_left", { n: st.daysLeft })}</Badge>}</td>
                <td>{formatDate(s.subscriptionEndsAt, locale, true)}</td>
                <td><Link href={`/admin/merchants/${s.id}`} className="btn-outline px-3 py-1">{t("manage")}</Link></td>
              </tr>); })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
