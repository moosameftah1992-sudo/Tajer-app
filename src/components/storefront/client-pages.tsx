"use client";

import Link from "next/link";
import { useActionState, useMemo, useState, useTransition } from "react";
import { useStore } from "./store-provider";
import { useT } from "@/components/locale-provider";
import { Alert, Field, SubmitButton } from "@/components/ui";
import { formatMoney, toNum } from "@/lib/utils";
import { placeOrder } from "@/actions/storefront";
import { customerLogin, customerRegister, customerLogout, updateCustomerProfile } from "@/actions/storefront";
import { AddToCart } from "./widgets";
import type { Product, Tenant, Customer } from "@/db/schema";
import type { TKey } from "@/lib/i18n";

/* ----------------------------- Cart ----------------------------- */
export function CartPage() {
  const { items, setQty, remove, subtotal, base, currency, hydrated } = useStore();
  const { t, locale } = useT();
  if (!hydrated) return null;
  if (!items.length) return <div className="py-20 text-center"><p className="text-lg sf-muted">{t("cart_empty_sf")}</p><Link href={base || "/"} className="sf-btn mt-6">{t("continue_shopping")}</Link></div>;
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <ul className="space-y-3">
        {items.map((i) => (
          <li key={i.key} className="flex gap-4 sf-surface p-3">
            <div className="h-20 w-20 shrink-0 overflow-hidden sf-radius bg-[var(--sf-bg)]">{i.image && <img src={i.image} alt="" className="h-full w-full object-cover" />}</div>
            <div className="flex-1">
              <div className="font-semibold">{locale === "ar" ? i.nameAr || i.name : i.name}</div>
              {Object.keys(i.options).length > 0 && <div className="text-xs sf-muted">{Object.entries(i.options).map(([k, v]) => `${k}: ${v}`).join(" · ")}</div>}
              <div className="mt-1 text-sm sf-primary">{formatMoney(i.price, currency, locale)}</div>
            </div>
            <div className="flex flex-col items-end justify-between">
              <button onClick={() => remove(i.key)} className="text-xs sf-muted hover:text-rose-500">{t("remove")}</button>
              <div className="flex items-center gap-1" dir="ltr"><button onClick={() => setQty(i.key, i.qty - 1)} className="sf-chip !px-2">−</button><span className="w-8 text-center text-sm font-bold">{i.qty}</span><button onClick={() => setQty(i.key, i.qty + 1)} className="sf-chip !px-2">+</button></div>
            </div>
          </li>
        ))}
      </ul>
      <aside className="sf-surface h-fit p-5">
        <h3 className="font-bold">{t("order_summary")}</h3>
        <div className="mt-3 flex justify-between text-sm"><span>{t("subtotal")}</span><b>{formatMoney(subtotal, currency, locale)}</b></div>
        <Link href={`${base}/checkout`} className="sf-btn mt-5 w-full justify-center">{t("proceed_checkout")}</Link>
        <Link href={base || "/"} className="mt-3 block text-center text-sm sf-muted">{t("continue_shopping")}</Link>
      </aside>
    </div>
  );
}

/* ----------------------------- Product detail ----------------------------- */
export function ProductDetail({ product }: { product: Product }) {
  const { currency } = useStore();
  const { t, locale } = useT();
  const [options, setOptions] = useState<Record<string, string>>(() => Object.fromEntries((product.variants ?? []).map((v) => [v.name, v.options[0]?.label ?? ""])));
  const [qty, setQty] = useState(1);
  const [img, setImg] = useState(product.imageUrl);
  const price = useMemo(() => {
    let p = toNum(product.price);
    for (const v of product.variants ?? []) { const o = v.options.find((x) => x.label === options[v.name]); if (o) p += toNum(o.priceDelta); }
    return p;
  }, [options, product]);
  const gallery = [product.imageUrl, ...(product.images ?? [])].filter((s, i, a) => s && a.indexOf(s) === i);
  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div>
        <div className="aspect-square overflow-hidden sf-radius bg-[var(--sf-surface)]">{img ? <img src={img} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-6xl opacity-30">🛍️</div>}</div>
        {gallery.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto">{gallery.map((g) => <button key={g} onClick={() => setImg(g)} className={`h-16 w-16 shrink-0 overflow-hidden sf-radius border-2 ${img === g ? "border-[var(--sf-primary)]" : "border-transparent"}`}><img src={g} alt="" className="h-full w-full object-cover" /></button>)}</div>}
      </div>
      <div>
        <h1 className="text-3xl font-extrabold">{locale === "ar" ? product.nameAr || product.name : product.name}</h1>
        <div className="mt-3 flex items-center gap-3 text-2xl font-bold sf-primary">{formatMoney(price, currency, locale)}{product.compareAtPrice && toNum(product.compareAtPrice) > price && <s className="text-base sf-muted">{formatMoney(toNum(product.compareAtPrice), currency, locale)}</s>}</div>
        {(product.purity || product.weight || product.sku) && <div className="mt-2 flex flex-wrap gap-2 text-xs">{product.purity && <span className="sf-chip">{product.purity}</span>}{product.weight && <span className="sf-chip" dir="ltr">{toNum(product.weight)} {product.weightUnit}</span>}{product.sku && <span className="sf-chip" dir="ltr">SKU {product.sku}</span>}</div>}
        <p className="mt-5 whitespace-pre-line sf-muted">{locale === "ar" ? product.descriptionAr || product.description : product.description}</p>
        {(product.variants ?? []).map((v) => (
          <div key={v.name} className="mt-5">
            <div className="mb-2 text-sm font-semibold">{locale === "ar" ? v.nameAr || v.name : v.name}</div>
            <div className="flex flex-wrap gap-2">{v.options.map((o) => <button key={o.label} onClick={() => setOptions((s) => ({ ...s, [v.name]: o.label }))} className={`sf-chip ${options[v.name] === o.label ? "active" : ""}`}>{locale === "ar" ? o.labelAr || o.label : o.label}{toNum(o.priceDelta) !== 0 && <span className="ms-1 opacity-70">({toNum(o.priceDelta) > 0 ? "+" : ""}{formatMoney(toNum(o.priceDelta), currency, locale)})</span>}</button>)}</div>
          </div>
        ))}
        <div className="mt-6 flex items-center gap-3">
          <div className="flex items-center gap-1" dir="ltr"><button onClick={() => setQty((q) => Math.max(1, q - 1))} className="sf-chip !px-3">−</button><span className="w-8 text-center font-bold">{qty}</span><button onClick={() => setQty((q) => q + 1)} className="sf-chip !px-3">+</button></div>
          <AddToCart product={product} options={options} qty={qty} />
        </div>
        <div className="mt-3 text-xs sf-muted">{product.trackStock ? (product.stock > 0 ? `${t("in_stock")} (${product.stock})` : t("out_of_stock_sf")) : t("in_stock")}</div>
      </div>
    </div>
  );
}

/* ----------------------------- Checkout ----------------------------- */
export function CheckoutPage({ tenant, customer }: { tenant: Pick<Tenant, "deliveryEnabled" | "pickupEnabled" | "dineInEnabled" | "deliveryFee" | "taxRate" | "taxInclusive" | "minOrder" | "payments">; customer: Pick<Customer, "name" | "phone" | "email" | "address"> | null }) {
  const { items, subtotal, base, currency, clear, tableCode, hydrated, slug } = useStore();
  const { t, locale } = useT();
  const methods = (["delivery", "pickup", "dine_in"] as const).filter((m) => (m === "delivery" && tenant.deliveryEnabled) || (m === "pickup" && tenant.pickupEnabled) || (m === "dine_in" && tenant.dineInEnabled));
  const payments = (["cash", "benefit", "card", "paypal"] as const).filter((p) => tenant.payments?.[p]?.enabled);
  const [ft, setFt] = useState<(typeof methods)[number]>(tableCode && tenant.dineInEnabled ? "dine_in" : methods[0] ?? "pickup");
  const [pm, setPm] = useState<(typeof payments)[number]>(payments[0] ?? "cash");
  const [form, setForm] = useState({ name: customer?.name ?? "", phone: customer?.phone ?? "", email: customer?.email ?? "", address: customer?.address ?? "", notes: "" });
  const [error, setError] = useState<{ key: string; detail?: string } | null>(null);
  const [pending, start] = useTransition();
  const [redirecting, setRedirecting] = useState(false);

  const rate = toNum(tenant.taxRate) / 100;
  const tax = tenant.taxInclusive ? subtotal - subtotal / (1 + rate) : subtotal * rate;
  const delivery = ft === "delivery" ? toNum(tenant.deliveryFee) : 0;
  const total = subtotal + (tenant.taxInclusive ? 0 : tax) + delivery;
  const minOrder = toNum(tenant.minOrder);

  if (!hydrated) return null;
  if (!items.length && !redirecting) return <div className="py-20 text-center"><p className="sf-muted">{t("cart_empty_sf")}</p><Link href={base || "/"} className="sf-btn mt-6">{t("continue_shopping")}</Link></div>;

  const submit = () => {
    setError(null);
    start(async () => {
      const res = await placeOrder(slug, { lines: items.map((i) => ({ productId: i.productId, qty: i.qty, options: i.options })), fulfillmentType: ft, paymentMethod: pm, ...form, tableCode: tableCode ?? undefined });
      if (!res.ok) return setError({ key: res.error, detail: res.detail });
      setRedirecting(true);
      clear();
      window.location.href = res.redirectUrl ?? `${base}/order/${res.orderNumber}`;
    });
  };
  const ftLabel = { delivery: t("fulfillment_delivery"), pickup: t("fulfillment_pickup"), dine_in: t("fulfillment_dine_in") };
  const pmLabel = { cash: t("cash"), benefit: t("benefit"), card: t("card"), paypal: t("paypal") };
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {error && <Alert message={`${t(error.key as TKey)}${error.detail ? ` — ${error.detail}` : ""}`} />}
        <section className="sf-surface p-5">
          <h3 className="mb-3 font-bold">{t("fulfillment_method")}</h3>
          <div className="flex flex-wrap gap-2">{methods.map((m) => <button key={m} onClick={() => setFt(m)} className={`sf-chip ${ft === m ? "active" : ""}`}>{ftLabel[m]}</button>)}</div>
          <p className="mt-2 text-xs sf-muted">{ft === "delivery" ? t("delivery_notice") : ft === "pickup" ? t("pickup_notice") : t("dine_in_notice")}</p>
        </section>
        <section className="sf-surface space-y-3 p-5">
          <h3 className="font-bold">{t("contact_info")}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm"><span className="mb-1 block text-xs font-semibold sf-muted">{t("name")}</span><input className="sf-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
            <label className="block text-sm"><span className="mb-1 block text-xs font-semibold sf-muted">{t("phone")}</span><input className="sf-input" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /></label>
            <label className="block text-sm sm:col-span-2"><span className="mb-1 block text-xs font-semibold sf-muted">{t("email")} ({t("optional")})</span><input className="sf-input" type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            {ft === "delivery" && <label className="block text-sm sm:col-span-2"><span className="mb-1 block text-xs font-semibold sf-muted">{t("delivery_address")}</span><textarea className="sf-input" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>}
            <label className="block text-sm sm:col-span-2"><span className="mb-1 block text-xs font-semibold sf-muted">{t("notes")}</span><textarea className="sf-input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          </div>
        </section>
        <section className="sf-surface p-5">
          <h3 className="mb-3 font-bold">{t("payment_method_sf")}</h3>
          <div className="flex flex-wrap gap-2">{payments.map((p) => <button key={p} onClick={() => setPm(p)} className={`sf-chip ${pm === p ? "active" : ""}`}>{pmLabel[p]}</button>)}</div>
          {pm !== "cash" && <p className="mt-2 text-xs sf-muted">{t("redirecting_payment")}</p>}
        </section>
      </div>
      <aside className="sf-surface h-fit p-5">
        <h3 className="font-bold">{t("order_summary")}</h3>
        <ul className="mt-3 space-y-2 text-sm">{items.map((i) => <li key={i.key} className="flex justify-between gap-2"><span>{i.qty} × {locale === "ar" ? i.nameAr || i.name : i.name}</span><span>{formatMoney(i.price * i.qty, currency, locale)}</span></li>)}</ul>
        <div className="mt-4 space-y-1 border-t border-[var(--sf-border)] pt-3 text-sm">
          <div className="flex justify-between"><span>{t("subtotal")}</span><span>{formatMoney(subtotal, currency, locale)}</span></div>
          {rate > 0 && <div className="flex justify-between sf-muted"><span>{t("tax")} ({toNum(tenant.taxRate)}%{tenant.taxInclusive ? ` · ${t("tax_inclusive")}` : ""})</span><span>{formatMoney(tax, currency, locale)}</span></div>}
          {delivery > 0 && <div className="flex justify-between"><span>{t("delivery_fee")}</span><span>{formatMoney(delivery, currency, locale)}</span></div>}
          <div className="flex justify-between text-lg font-extrabold"><span>{t("total")}</span><span>{formatMoney(total, currency, locale)}</span></div>
        </div>
        {minOrder > subtotal && <p className="mt-2 text-xs text-rose-500">{t("min_order_hint", { amount: formatMoney(minOrder, currency, locale) })}</p>}
        <button onClick={submit} disabled={pending || minOrder > subtotal || !form.name || !form.phone} className="sf-btn mt-5 w-full justify-center disabled:opacity-50">{pending ? t("loading") : pm === "cash" ? t("place_order") : t("pay_now")}</button>
      </aside>
    </div>
  );
}

/* ----------------------------- Account ----------------------------- */
export function AccountAuth({ next }: { next?: string }) {
  const { slug } = useStore();
  const { t } = useT();
  const [mode, setMode] = useState<"login" | "register">("login");
  const loginAction = customerLogin.bind(null, slug);
  const registerAction = customerRegister.bind(null, slug);
  const [ls, la] = useActionState(loginAction, null);
  const [rs, ra] = useActionState(registerAction, null);
  return (
    <div className="mx-auto max-w-md sf-surface p-6">
      <div className="mb-5 flex gap-2"><button onClick={() => setMode("login")} className={`sf-chip ${mode === "login" ? "active" : ""}`}>{t("sign_in")}</button><button onClick={() => setMode("register")} className={`sf-chip ${mode === "register" ? "active" : ""}`}>{t("sign_up")}</button></div>
      {mode === "login" ? (
        <form action={la} className="space-y-3">
          {ls && !ls.ok && <Alert messageKey={ls.error} />}
          <input type="hidden" name="next" value={next ?? ""} />
          <Field label={t("email")}><input name="email" type="email" className="sf-input" required dir="ltr" /></Field>
          <Field label={t("password")}><input name="password" type="password" className="sf-input" required dir="ltr" /></Field>
          <SubmitButton className="sf-btn w-full justify-center">{t("sign_in")}</SubmitButton>
        </form>
      ) : (
        <form action={ra} className="space-y-3">
          {rs && !rs.ok && <Alert messageKey={rs.error} />}
          <input type="hidden" name="next" value={next ?? ""} />
          <Field label={t("name")}><input name="name" className="sf-input" required /></Field>
          <Field label={t("email")}><input name="email" type="email" className="sf-input" required dir="ltr" /></Field>
          <Field label={t("phone")}><input name="phone" className="sf-input" dir="ltr" /></Field>
          <Field label={t("password")} hint={t("weak_password")}><input name="password" type="password" className="sf-input" minLength={8} required dir="ltr" /></Field>
          <SubmitButton className="sf-btn w-full justify-center">{t("create_account")}</SubmitButton>
        </form>
      )}
    </div>
  );
}

export function ProfileForm({ customer }: { customer: Customer }) {
  const { slug } = useStore();
  const { t } = useT();
  const [state, action] = useActionState(updateCustomerProfile.bind(null, slug), null);
  return (
    <form action={action} className="sf-surface space-y-3 p-5">
      <h3 className="font-bold">{t("account_details")}</h3>
      {state && (state.ok ? <Alert kind="success" messageKey="profile_updated" /> : <Alert messageKey={state.error} />)}
      <Field label={t("name")}><input name="name" className="sf-input" defaultValue={customer.name} /></Field>
      <Field label={t("phone")}><input name="phone" className="sf-input" defaultValue={customer.phone} dir="ltr" /></Field>
      <Field label={t("address")}><input name="address" className="sf-input" defaultValue={customer.address} /></Field>
      <Field label={t("city")}><input name="city" className="sf-input" defaultValue={customer.city} /></Field>
      <Field label={t("new_password")}><input name="password" type="password" className="sf-input" dir="ltr" minLength={8} /></Field>
      <div className="flex items-center justify-between"><SubmitButton className="sf-btn">{t("update_profile")}</SubmitButton><button formAction={customerLogout.bind(null, slug)} className="text-sm text-rose-500">{t("logout")}</button></div>
    </form>
  );
}
