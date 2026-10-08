import Link from "next/link";
import { db } from "@/db";
import { orders, orderItems } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { mustTenant, getStoreBase } from "@/lib/tenant";
import { getT } from "@/lib/server-i18n";
import { formatDate, formatMoney } from "@/lib/utils";
import type { TKey } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params, searchParams }: { params: Promise<{ slug: string; number: string }>; searchParams: Promise<{ payment?: string }> }) {
  const { slug, number } = await params;
  const { payment } = await searchParams;
  const tenant = await mustTenant(slug);
  const { t, locale } = await getT();
  const base = await getStoreBase(slug);
  const [order] = await db.select().from(orders).where(and(eq(orders.tenantId, tenant.id), eq(orders.orderNumber, number))).limit(1);
  if (!order) return <div className="py-20 text-center sf-muted">{t("order_not_found")}</div>;
  const items = await db.select().from(orderItems).where(and(eq(orderItems.tenantId, tenant.id), eq(orderItems.orderId, order.id)));
  const steps = ["pending", "processing", "out_for_delivery", "fulfilled"];
  const idx = steps.indexOf(order.status);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {payment === "success" && <div className="mb-4 rounded-lg bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-600">{t("payment_success")}</div>}
      {(payment === "failed" || payment === "cancelled") && <div className="mb-4 rounded-lg bg-rose-500/15 px-4 py-2 text-sm font-semibold text-rose-600">{t("payment_failed_sf")}</div>}
      <div className="text-center"><div className="text-5xl">{order.status === "cancelled" ? "❌" : "✅"}</div><h1 className="mt-4 text-3xl font-extrabold">{order.status === "cancelled" ? t("status_cancelled") : t("order_placed")}</h1><p className="mt-2 sf-muted">{t("order_placed_sub")}</p><p className="mt-4 text-lg font-bold">#{order.orderNumber}</p><p className="text-xs sf-muted">{formatDate(order.createdAt, locale, true)}</p></div>
      {order.status !== "cancelled" && (
        <ol className="mt-8 grid grid-cols-4 gap-2 text-center text-xs">{steps.map((s, i) => <li key={s} className={`rounded-full px-2 py-1.5 font-semibold ${i <= idx ? "bg-[var(--sf-primary)] text-[var(--sf-primary-fg)]" : "bg-[var(--sf-surface)] sf-muted"}`}>{t(`status_${s}` as TKey)}</li>)}</ol>
      )}
      <div className="mt-8 sf-surface p-5">
        <h3 className="font-bold">{t("order_summary")}</h3>
        <ul className="mt-3 space-y-2 text-sm">{items.map((i) => <li key={i.id} className="flex justify-between"><span>{i.qty} × {locale === "ar" ? i.nameAr || i.name : i.name}{i.variant && <span className="sf-muted"> ({i.variant})</span>}</span><span>{formatMoney(i.total, order.currency, locale)}</span></li>)}</ul>
        <div className="mt-4 space-y-1 border-t border-[var(--sf-border)] pt-3 text-sm">
          <div className="flex justify-between"><span>{t("subtotal")}</span><span>{formatMoney(order.subtotal, order.currency, locale)}</span></div>
          {Number(order.tax) > 0 && <div className="flex justify-between sf-muted"><span>{t("tax")}</span><span>{formatMoney(order.tax, order.currency, locale)}</span></div>}
          {Number(order.deliveryFee) > 0 && <div className="flex justify-between"><span>{t("delivery_fee")}</span><span>{formatMoney(order.deliveryFee, order.currency, locale)}</span></div>}
          {Number(order.discount) > 0 && <div className="flex justify-between"><span>{t("discount")}</span><span>−{formatMoney(order.discount, order.currency, locale)}</span></div>}
          <div className="flex justify-between text-lg font-extrabold"><span>{t("total")}</span><span>{formatMoney(order.total, order.currency, locale)}</span></div>
        </div>
        <div className="mt-4 grid gap-2 text-xs sf-muted sm:grid-cols-2">
          <div>{t("fulfillment")}: <b>{t(`fulfillment_${order.fulfillmentType}` as TKey)}</b></div>
          <div>{t("payment")}: <b>{t(order.paymentMethod as TKey)} · {t(`payment_${order.paymentStatus}` as TKey)}</b></div>
          {order.shippingTracking && <div className="sm:col-span-2">{t("tracking")}: <b dir="ltr">{order.shippingTracking}</b></div>}
        </div>
      </div>
      <div className="mt-6 text-center"><Link href={base || "/"} className="sf-btn">{t("continue_shopping")}</Link></div>
    </div>
  );
}
