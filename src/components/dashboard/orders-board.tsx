"use client";

import { useEffect, useState, useTransition } from "react";
import { updateOrderStatus, updatePaymentStatus, sendToCarrier } from "@/actions/store";
import { useT } from "@/components/locale-provider";
import { Badge, Modal } from "@/components/ui";
import { formatMoney, formatDate, ORDER_STATUSES, type OrderStatus, cn } from "@/lib/utils";
import type { Order, OrderItem } from "@/db/schema";
import type { TKey } from "@/lib/i18n";

type Feed = Omit<Order, "total"> & { items: OrderItem[]; total: number };
type Carrier = { id: number; name: string; nameAr: string; trackingUrlTemplate: string };

export function OrdersBoard({ slug, initial, currency, carriers, tables }: { slug: string; initial: Feed[]; currency: string; carriers: Carrier[]; tables: Record<number, string> }) {
  const { t, locale } = useT();
  const [orders, setOrders] = useState<Feed[]>(initial);
  const [view, setView] = useState<"board" | "list">("board");
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState<Feed | null>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch(`/api/store/${slug}/orders`, { cache: "no-store" });
        const j = await r.json();
        if (alive && j.ok) setOrders(j.orders);
      } catch { /* retry on next tick */ }
    };
    const id = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(id); };
  }, [slug]);

  const refresh = async () => { const r = await fetch(`/api/store/${slug}/orders`, { cache: "no-store" }); const j = await r.json(); if (j.ok) setOrders(j.orders); };
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { const r = await fn(); if (!r.ok) setMsg(t((r.error ?? "error_generic") as TKey)); else setMsg(""); await refresh(); });
  const next: Record<string, OrderStatus | null> = { pending: "processing", processing: "out_for_delivery", out_for_delivery: "fulfilled", fulfilled: null, cancelled: null };
  const tone = (s: string) => (s === "fulfilled" ? "green" : s === "cancelled" ? "rose" : s === "pending" ? "amber" : "blue") as "green";
  const ptone = (s: string) => (s === "paid" ? "green" : s === "failed" ? "rose" : s === "refunded" ? "violet" : "amber") as "green";
  const visible = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  const Card = ({ o }: { o: Feed }) => (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm">
      <div className="flex items-center justify-between"><button onClick={() => setOpen(o)} className="font-mono font-bold hover:underline">#{o.orderNumber}</button><span className="text-xs text-slate-400">{formatDate(o.createdAt, locale, true)}</span></div>
      <div className="mt-1 text-slate-700">{o.customerName || t("walk_in")}{o.tableId && tables[o.tableId] ? ` · 🍽️ ${tables[o.tableId]}` : ""}</div>
      <div className="mt-2 flex flex-wrap items-center gap-1"><Badge tone="slate">{t(`fulfillment_${o.fulfillmentType}` as TKey)}</Badge><Badge tone={ptone(o.paymentStatus)}>{t(o.paymentMethod as TKey)} · {t(`payment_${o.paymentStatus}` as TKey)}</Badge><Badge tone={o.source === "pos" ? "violet" : "blue"}>{t(o.source === "pos" ? "source_pos" : "source_storefront")}</Badge></div>
      <div className="mt-2 flex items-center justify-between"><span className="text-xs text-slate-500">{o.items.length} {t("items")}</span><b>{formatMoney(o.total, currency, locale)}</b></div>
      {o.shippingTracking && <div className="mt-1 truncate text-xs text-slate-500" dir="ltr">🚚 {o.shippingTracking}</div>}
      <div className="mt-3 flex flex-wrap gap-1">
        {next[o.status] && <button disabled={pending} onClick={() => act(() => updateOrderStatus(slug, o.id, next[o.status]!))} className="btn-accent !px-2 !py-1 text-xs">→ {t(`status_${next[o.status]}` as TKey)}</button>}
        {o.status !== "cancelled" && o.status !== "fulfilled" && <button disabled={pending} onClick={() => act(() => updateOrderStatus(slug, o.id, "cancelled"))} className="btn-ghost !px-2 !py-1 text-xs text-rose-600">{t("cancel_order")}</button>}
        {o.paymentStatus !== "paid" && o.status !== "cancelled" && <button disabled={pending} onClick={() => act(() => updatePaymentStatus(slug, o.id, "paid"))} className="btn-outline !px-2 !py-1 text-xs">{t("mark_paid")}</button>}
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="me-auto flex items-center gap-2 text-xs text-slate-500"><span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />{t("live_updates")}</div>
        {msg && <span className="text-xs text-rose-600">{msg}</span>}
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input w-44"><option value="all">{t("all")}</option>{ORDER_STATUSES.map((s) => <option key={s} value={s}>{t(`status_${s}` as TKey)}</option>)}</select>
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5"><button onClick={() => setView("board")} className={cn("rounded-md px-3 py-1 text-xs font-semibold", view === "board" && "bg-slate-900 text-white")}>{t("board_view")}</button><button onClick={() => setView("list")} className={cn("rounded-md px-3 py-1 text-xs font-semibold", view === "list" && "bg-slate-900 text-white")}>{t("list_view")}</button></div>
      </div>
      {view === "board" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(["pending", "processing", "out_for_delivery", "fulfilled"] as const).map((s) => (
            <div key={s} className="rounded-2xl bg-slate-100 p-3">
              <div className="mb-3 flex items-center justify-between"><h3 className="font-bold">{t(`status_${s}` as TKey)}</h3><Badge tone={tone(s)}>{orders.filter((o) => o.status === s).length}</Badge></div>
              <div className="space-y-3">{visible.filter((o) => o.status === s).map((o) => <Card key={o.id} o={o} />)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table"><thead><tr><th>{t("order_number")}</th><th>{t("date")}</th><th>{t("customer")}</th><th>{t("fulfillment")}</th><th>{t("payment")}</th><th>{t("total")}</th><th>{t("status")}</th><th></th></tr></thead>
            <tbody>{visible.map((o) => <tr key={o.id}><td className="font-mono">{o.orderNumber}</td><td>{formatDate(o.createdAt, locale, true)}</td><td>{o.customerName || t("walk_in")}</td><td>{t(`fulfillment_${o.fulfillmentType}` as TKey)}</td><td><Badge tone={ptone(o.paymentStatus)}>{t(`payment_${o.paymentStatus}` as TKey)}</Badge></td><td>{formatMoney(o.total, currency, locale)}</td><td><Badge tone={tone(o.status)}>{t(`status_${o.status}` as TKey)}</Badge></td><td><button onClick={() => setOpen(o)} className="btn-ghost">{t("details")}</button></td></tr>)}</tbody></table>
        </div>
      )}
      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `${t("order_details")} #${open.orderNumber}` : ""}>
        {open && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-slate-500">{t("customer")}:</span> {open.customerName || t("walk_in")}</div>
              <div><span className="text-slate-500">{t("phone")}:</span> <span dir="ltr">{open.customerPhone || "-"}</span></div>
              <div><span className="text-slate-500">{t("fulfillment")}:</span> {t(`fulfillment_${open.fulfillmentType}` as TKey)}{open.tableId && tables[open.tableId] ? ` (${tables[open.tableId]})` : ""}</div>
              <div><span className="text-slate-500">{t("payment")}:</span> {t(open.paymentMethod as TKey)} · {t(`payment_${open.paymentStatus}` as TKey)}</div>
              {open.address && <div className="col-span-2"><span className="text-slate-500">{t("address")}:</span> {open.address}</div>}
              {open.notes && <div className="col-span-2"><span className="text-slate-500">{t("notes")}:</span> {open.notes}</div>}
            </div>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">{open.items.map((i) => <li key={i.id} className="flex justify-between px-3 py-2"><span>{i.qty} × {locale === "ar" ? i.nameAr || i.name : i.name}{i.variant && <span className="text-slate-400"> ({i.variant})</span>}</span><span>{formatMoney(i.total, currency, locale)}</span></li>)}</ul>
            <div className="space-y-0.5 text-end"><div>{t("subtotal")}: {formatMoney(open.subtotal, currency, locale)}</div>{Number(open.discount) > 0 && <div>{t("discount")}: −{formatMoney(open.discount, currency, locale)}</div>}<div>{t("tax")}: {formatMoney(open.tax, currency, locale)}</div>{Number(open.deliveryFee) > 0 && <div>{t("delivery_fee")}: {formatMoney(open.deliveryFee, currency, locale)}</div>}<div className="text-lg font-extrabold">{t("total")}: {formatMoney(open.total, currency, locale)}</div></div>
            {open.fulfillmentType === "delivery" && open.status !== "cancelled" && (
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="mb-2 font-semibold">{t("assign_shipment")}</div>
                {open.shippingTracking ? <div className="text-xs"><span className="text-slate-500">{t("tracking")}:</span> <b dir="ltr">{open.shippingTracking}</b> {open.shippingStatus && <Badge tone="blue">{open.shippingStatus}</Badge>}{(() => { const c = carriers.find((x) => x.id === open.shippingProviderId); const url = c?.trackingUrlTemplate ? c.trackingUrlTemplate.replace("{tracking}", encodeURIComponent(open.shippingTracking)) : ""; return url ? <a href={url} target="_blank" rel="noreferrer" className="ms-2 text-emerald-600 underline">↗</a> : null; })()}</div> : carriers.length ? (
                  <div className="flex flex-wrap gap-2">{carriers.map((c) => <button key={c.id} disabled={pending} onClick={() => act(async () => { const r = await sendToCarrier(slug, open.id, c.id); if (r.ok) setOpen(null); return r; })} className="btn-primary !px-3 !py-1 text-xs">🚚 {locale === "ar" ? c.nameAr : c.name}</button>)}</div>
                ) : <p className="text-xs text-slate-500">{t("no_carrier_active")}</p>}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
