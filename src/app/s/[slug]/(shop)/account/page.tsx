import Link from "next/link";
import { mustTenant, getStoreBase } from "@/lib/tenant";
import { getCustomerSession } from "@/lib/auth";
import { getT } from "@/lib/server-i18n";
import { customerOrders } from "@/actions/storefront";
import { formatDate, formatMoney } from "@/lib/utils";
import { AccountAuth, ProfileForm } from "@/components/storefront/client-pages";
import type { TKey } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function AccountPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ next?: string }> }) {
  const { slug } = await params;
  const { next } = await searchParams;
  const tenant = await mustTenant(slug);
  const { t, locale } = await getT();
  const customer = await getCustomerSession(tenant.id);
  const base = await getStoreBase(slug);
  if (!customer) return <div className="mx-auto max-w-5xl px-4 py-10"><h1 className="mb-6 text-center text-3xl font-extrabold">{t("my_account")}</h1><AccountAuth next={next} /></div>;
  const orders = await customerOrders(slug);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-extrabold">{t("welcome")}, {customer.name}</h1>
      <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
        <ProfileForm customer={customer} />
        <section>
          <h2 className="mb-3 text-xl font-bold">{t("my_orders")}</h2>
          {orders.length ? (
            <ul className="space-y-3">{orders.map((o) => (
              <li key={o.id} className="sf-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><Link href={`${base}/order/${o.orderNumber}`} className="font-bold sf-primary">#{o.orderNumber}</Link><span className="sf-chip">{t(`status_${o.status}` as TKey)}</span></div>
                <div className="mt-1 text-xs sf-muted">{formatDate(o.createdAt, locale, true)} · {o.items.length} {t("items")} · {formatMoney(o.total, o.currency, locale)}</div>
              </li>))}</ul>
          ) : <p className="sf-muted">{t("no_orders_yet")}</p>}
        </section>
      </div>
    </div>
  );
}
