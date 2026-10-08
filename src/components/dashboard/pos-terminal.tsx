"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { posCheckout, searchCustomers, quickCreateCustomer } from "@/actions/store";
import { useT } from "@/components/locale-provider";
import { Modal } from "@/components/ui";
import { LanguageSwitcher } from "@/components/locale-provider";
import { formatMoney, toNum, roundMoney, cn } from "@/lib/utils";
import type { Category, Product, Order, OrderItem } from "@/db/schema";
import type { TKey } from "@/lib/i18n";

type Line = { key: string; product: Product; qty: number; options: Record<string, string>; unit: number };
type Receipt = { order: Order; items: OrderItem[]; staffName: string };

export function PosTerminal({ slug, base, currency, categories, products, payments, taxRate, taxInclusive, storeName, logoUrl, staffName, fulfillment }: { slug: string; base: string; currency: string; categories: Category[]; products: Product[]; payments: ("cash" | "benefit" | "card" | "paypal")[]; taxRate: number; taxInclusive: boolean; storeName: string; logoUrl: string; staffName: string; fulfillment: ("pickup" | "dine_in" | "delivery")[] }) {
  const { t, locale } = useT();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [customer, setCustomer] = useState<{ id: number; name: string } | null>(null);
  const [custOpen, setCustOpen] = useState(false);
  const [custQ, setCustQ] = useState("");
  const [custResults, setCustResults] = useState<{ id: number; name: string; phone: string; email: string }[]>([]);
  const [newCust, setNewCust] = useState({ name: "", phone: "", email: "" });
  const [discount, setDiscount] = useState(0);
  const [pm, setPm] = useState(payments[0] ?? "cash");
  const [ft, setFt] = useState(fulfillment[0] ?? "pickup");
  const [tendered, setTendered] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  const [variantPick, setVariantPick] = useState<Product | null>(null);
  const [pickOpts, setPickOpts] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, [receipt]);
  useEffect(() => { if (!custOpen) return; const h = setTimeout(() => searchCustomers(slug, custQ).then(setCustResults), 250); return () => clearTimeout(h); }, [custQ, custOpen, slug]);

  const visible = useMemo(() => products.filter((p) => (!cat || p.categoryId === cat) && (!q || `${p.name} ${p.nameAr} ${p.sku} ${p.barcode}`.toLowerCase().includes(q.toLowerCase()))), [products, cat, q]);
  const unitPrice = (p: Product, opts: Record<string, string>) => { let u = toNum(p.price); for (const v of p.variants ?? []) { const o = v.options.find((x) => x.label === opts[v.name]); if (o) u += toNum(o.priceDelta); } return roundMoney(u, currency); };
  const addLine = (p: Product, opts: Record<string, string> = {}) => {
    if ((p.variants?.length ?? 0) > 0 && !Object.keys(opts).length) { setVariantPick(p); setPickOpts(Object.fromEntries(p.variants.map((v) => [v.name, v.options[0]?.label ?? ""]))); return; }
    const key = `${p.id}:${JSON.stringify(opts)}`;
    setLines((ls) => { const ex = ls.find((l) => l.key === key); if (ex) return ls.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l)); return [...ls, { key, product: p, qty: 1, options: opts, unit: unitPrice(p, opts) }]; });
    setError("");
  };
  const scan = (e: React.FormEvent) => {
    e.preventDefault();
    const code = q.trim().toLowerCase();
    if (!code) return;
    const exact = products.find((p) => p.barcode.toLowerCase() === code || p.sku.toLowerCase() === code);
    const target = exact ?? (visible.length === 1 ? visible[0] : undefined);
    if (target) { addLine(target); setQ(""); } else setError(t("product_not_found"));
  };
  const subtotal = roundMoney(lines.reduce((s, l) => s + l.unit * l.qty, 0), currency);
  const disc = Math.min(subtotal, Math.max(0, discount || 0));
  const taxable = subtotal - disc;
  const rate = taxRate / 100;
  const tax = roundMoney(taxInclusive ? taxable - taxable / (1 + rate) : taxable * rate, currency);
  const total = roundMoney(taxable + (taxInclusive ? 0 : tax), currency);
  const change = Math.max(0, toNum(tendered) - total);

  const charge = () => start(async () => {
    setError("");
    const r = await posCheckout(slug, { lines: lines.map((l) => ({ productId: l.product.id, qty: l.qty, options: l.options })), paymentMethod: pm, customerId: customer?.id ?? null, discount: disc, notes: "", fulfillmentType: ft });
    if (!r.ok) return setError(t(r.error as TKey));
    setReceipt({ order: r.order, items: r.items, staffName: r.staffName });
    setLines([]); setDiscount(0); setTendered(""); setCustomer(null);
  });

  const pmLabel: Record<string, string> = { cash: t("cash"), benefit: t("benefit"), card: t("card"), paypal: t("paypal") };
  return (
    <div className="flex h-screen flex-col bg-slate-100">
      <header className="no-print flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2">
        <div className="flex items-center gap-3"><Link href={`${base}/dashboard`} className="btn-ghost">← {t("exit_pos")}</Link><span className="font-extrabold">{t("pos_title")}</span><span className="text-sm text-slate-500">{storeName}</span></div>
        <div className="flex items-center gap-2"><span className="text-xs text-slate-500">{t("served_by")}: {staffName}</span><LanguageSwitcher /></div>
      </header>
      <div className="no-print grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_400px]">
        <section className="flex flex-col overflow-hidden p-3">
          <form onSubmit={scan} className="flex gap-2"><input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setError(""); }} className="input flex-1 !py-3 text-base" placeholder={t("barcode_placeholder")} autoFocus /><button className="btn-primary">{t("scan_barcode")}</button></form>
          {error && <p className="mt-1 text-sm text-rose-600">{error}</p>}
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1 no-scrollbar"><button onClick={() => setCat(0)} className={cn("whitespace-nowrap rounded-full px-3 py-1 text-sm font-semibold", cat === 0 ? "bg-slate-900 text-white" : "bg-white")}>{t("all")}</button>{categories.map((c) => <button key={c.id} onClick={() => setCat(c.id)} className={cn("whitespace-nowrap rounded-full px-3 py-1 text-sm font-semibold", cat === c.id ? "bg-slate-900 text-white" : "bg-white")}>{locale === "ar" ? c.nameAr : c.name}</button>)}</div>
          <div className="mt-2 grid flex-1 grid-cols-2 content-start gap-2 overflow-y-auto sm:grid-cols-3 xl:grid-cols-5">
            {visible.map((p) => { const out = p.trackStock && p.stock <= 0; return (
              <button key={p.id} disabled={out} onClick={() => addLine(p)} className={cn("flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-start shadow-sm transition active:scale-95", out && "opacity-40")}>
                <div className="aspect-[4/3] w-full bg-slate-100">{p.imageUrl ? <img src={p.imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-2xl">🛍️</div>}</div>
                <div className="p-2"><div className="line-clamp-2 text-xs font-semibold">{locale === "ar" ? p.nameAr || p.name : p.name}</div><div className="mt-0.5 flex items-center justify-between text-xs"><span className="font-bold text-emerald-600">{formatMoney(p.price, currency, locale)}</span>{p.trackStock && <span className="text-slate-400">{p.stock}</span>}</div></div>
              </button>); })}
          </div>
        </section>
        <aside className="flex flex-col border-s border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <button onClick={() => setCustOpen(true)} className="btn-outline !py-1 text-xs">👤 {customer ? customer.name : t("walk_in_customer")}</button>
            <button onClick={() => setLines([])} className="btn-ghost !py-1 text-xs text-rose-600">{t("clear_cart")}</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {lines.length ? lines.map((l) => (
              <div key={l.key} className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm">
                <div className="flex-1"><div className="font-medium">{locale === "ar" ? l.product.nameAr || l.product.name : l.product.name}</div>{Object.keys(l.options).length > 0 && <div className="text-xs text-slate-400">{Object.values(l.options).join(" · ")}</div>}<div className="text-xs text-slate-500">{formatMoney(l.unit, currency, locale)}</div></div>
                <div className="flex items-center gap-1" dir="ltr"><button onClick={() => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, qty: x.qty - 1 } : x)).filter((x) => x.qty > 0))} className="h-7 w-7 rounded-md bg-slate-100">−</button><span className="w-6 text-center font-bold">{l.qty}</span><button onClick={() => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, qty: x.qty + 1 } : x)))} className="h-7 w-7 rounded-md bg-slate-100">+</button></div>
                <b className="w-20 text-end">{formatMoney(l.unit * l.qty, currency, locale)}</b>
              </div>
            )) : <p className="p-6 text-center text-sm text-slate-400">{t("cart_empty")}</p>}
          </div>
          <div className="space-y-2 border-t border-slate-200 p-3 text-sm">
            <div className="flex gap-2">{fulfillment.map((f) => <button key={f} onClick={() => setFt(f)} className={cn("flex-1 rounded-lg border px-2 py-1 text-xs font-semibold", ft === f ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200")}>{t(`fulfillment_${f}` as TKey)}</button>)}</div>
            <div className="flex items-center justify-between"><span>{t("subtotal")}</span><span>{formatMoney(subtotal, currency, locale)}</span></div>
            <div className="flex items-center justify-between gap-2"><span>{t("pos_discount")}</span><input type="number" min={0} step="0.001" value={discount || ""} onChange={(e) => setDiscount(Number(e.target.value))} className="input w-28 !py-1 text-end" /></div>
            <div className="flex items-center justify-between text-slate-500"><span>{t("tax")} ({taxRate}%)</span><span>{formatMoney(tax, currency, locale)}</span></div>
            <div className="flex items-center justify-between text-xl font-extrabold"><span>{t("total")}</span><span>{formatMoney(total, currency, locale)}</span></div>
            <div className="grid grid-cols-2 gap-1">{payments.map((p) => <button key={p} onClick={() => setPm(p)} className={cn("rounded-lg border px-2 py-1.5 text-xs font-semibold", pm === p ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200")}>{pmLabel[p]}</button>)}</div>
            {pm === "cash" && <div className="flex items-center justify-between gap-2"><span>{t("tendered")}</span><input type="number" step="0.001" value={tendered} onChange={(e) => setTendered(e.target.value)} className="input w-28 !py-1 text-end" />{toNum(tendered) > 0 && <span className="text-xs text-slate-500">{t("change")}: <b>{formatMoney(change, currency, locale)}</b></span>}</div>}
            <button disabled={!lines.length || pending} onClick={charge} className="btn-accent w-full !py-3 text-base">{pending ? t("loading") : `${t("pay")} · ${formatMoney(total, currency, locale)}`}</button>
          </div>
        </aside>
      </div>

      <Modal open={custOpen} onClose={() => setCustOpen(false)} title={t("assign_customer")}>
        <input value={custQ} onChange={(e) => setCustQ(e.target.value)} className="input" placeholder={t("search")} autoFocus />
        <ul className="mt-2 max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">{custResults.map((c) => <li key={c.id}><button onClick={() => { setCustomer({ id: c.id, name: c.name }); setCustOpen(false); }} className="flex w-full justify-between px-3 py-2 text-sm hover:bg-slate-50"><span>{c.name}</span><span className="text-slate-400" dir="ltr">{c.phone}</span></button></li>)}</ul>
        <div className="mt-4 rounded-lg bg-slate-50 p-3"><div className="mb-2 text-sm font-semibold">{t("new_customer")}</div><div className="grid gap-2 sm:grid-cols-3"><input className="input" placeholder={t("name")} value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} /><input className="input" placeholder={t("phone")} dir="ltr" value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} /><input className="input" placeholder={t("email")} dir="ltr" value={newCust.email} onChange={(e) => setNewCust({ ...newCust, email: e.target.value })} /></div><button disabled={!newCust.name || pending} onClick={() => start(async () => { const r = await quickCreateCustomer(slug, newCust); if (r.ok && r.id) { setCustomer({ id: r.id, name: newCust.name }); setCustOpen(false); setNewCust({ name: "", phone: "", email: "" }); } })} className="btn-primary mt-2">{t("create")}</button></div>
        <button onClick={() => { setCustomer(null); setCustOpen(false); }} className="btn-ghost mt-2 w-full">{t("walk_in_customer")}</button>
      </Modal>

      <Modal open={!!variantPick} onClose={() => setVariantPick(null)} title={variantPick ? (locale === "ar" ? variantPick.nameAr || variantPick.name : variantPick.name) : ""}>
        {variantPick && (
          <div className="space-y-3">
            {variantPick.variants.map((v) => <div key={v.name}><div className="mb-1 text-sm font-semibold">{locale === "ar" ? v.nameAr || v.name : v.name}</div><div className="flex flex-wrap gap-1">{v.options.map((o) => <button key={o.label} onClick={() => setPickOpts((s) => ({ ...s, [v.name]: o.label }))} className={cn("rounded-full border px-3 py-1 text-sm", pickOpts[v.name] === o.label ? "border-emerald-500 bg-emerald-50" : "border-slate-200")}>{locale === "ar" ? o.labelAr || o.label : o.label}{toNum(o.priceDelta) !== 0 && ` (${toNum(o.priceDelta) > 0 ? "+" : ""}${formatMoney(toNum(o.priceDelta), currency, locale)})`}</button>)}</div></div>)}
            <button onClick={() => { addLine(variantPick, pickOpts); setVariantPick(null); }} className="btn-accent w-full">{t("add")} · {formatMoney(unitPrice(variantPick, pickOpts), currency, locale)}</button>
          </div>
        )}
      </Modal>

      <Modal open={!!receipt} onClose={() => setReceipt(null)} title={t("pos_complete")}>
        {receipt && (
          <div>
            <div id="receipt" className="mx-auto max-w-xs rounded-lg border border-dashed border-slate-300 p-4 font-mono text-xs">
              <div className="text-center">{logoUrl && <img src={logoUrl} alt="" className="mx-auto mb-2 h-12 w-12 rounded-full object-cover" />}<div className="text-base font-bold">{storeName}</div><div>#{receipt.order.orderNumber}</div><div>{new Date(receipt.order.createdAt).toLocaleString(locale === "ar" ? "ar-BH" : "en-GB")}</div></div>
              <hr className="my-2 border-dashed" />
              {receipt.items.map((i) => <div key={i.id} className="flex justify-between"><span>{i.qty} × {locale === "ar" ? i.nameAr || i.name : i.name}{i.variant ? ` (${i.variant})` : ""}</span><span>{formatMoney(i.total, currency, locale)}</span></div>)}
              <hr className="my-2 border-dashed" />
              <div className="flex justify-between"><span>{t("subtotal")}</span><span>{formatMoney(receipt.order.subtotal, currency, locale)}</span></div>
              {Number(receipt.order.discount) > 0 && <div className="flex justify-between"><span>{t("discount")}</span><span>−{formatMoney(receipt.order.discount, currency, locale)}</span></div>}
              <div className="flex justify-between"><span>{t("tax")}</span><span>{formatMoney(receipt.order.tax, currency, locale)}</span></div>
              <div className="flex justify-between text-sm font-bold"><span>{t("total")}</span><span>{formatMoney(receipt.order.total, currency, locale)}</span></div>
              <div className="flex justify-between"><span>{t("payment_method")}</span><span>{pmLabel[receipt.order.paymentMethod]}</span></div>
              {receipt.order.paymentMethod === "cash" && toNum(tendered) > 0 && <div className="flex justify-between"><span>{t("change")}</span><span>{formatMoney(change, currency, locale)}</span></div>}
              <hr className="my-2 border-dashed" />
              <div className="text-center"><div>{t("served_by")}: {receipt.staffName}</div><div className="mt-1 font-bold">{t("thank_you")}</div><div className="mt-1 text-[10px] text-slate-400">Tajer POS</div></div>
            </div>
            <div className="no-print mt-4 flex gap-2"><button onClick={() => window.print()} className="btn-primary flex-1">🖨️ {t("print_receipt")}</button><button onClick={() => setReceipt(null)} className="btn-accent flex-1">{t("new_sale")}</button></div>
          </div>
        )}
      </Modal>
      <style dangerouslySetInnerHTML={{ __html: "@media print { body * { visibility: hidden; } #receipt, #receipt * { visibility: visible; } #receipt { position: fixed; inset: 0; margin: 0; max-width: 80mm; border: none; } }" }} />
    </div>
  );
}
