"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { saveSettings } from "@/actions/store";
import { useT } from "@/components/locale-provider";
import { Alert, Field, SubmitButton, Toggle, Badge } from "@/components/ui";
import { MediaPicker } from "./media-library";
import { CURRENCIES, CURRENCY_CODES, BUSINESS_TYPES, cn } from "@/lib/utils";
import { TEMPLATES, MERCHANT_FONTS } from "@/lib/templates";
import type { Tenant, ShippingProvider, TenantShippingProvider, Domain } from "@/db/schema";
import type { TKey } from "@/lib/i18n";

type Props = { slug: string; tenant: Tenant; providers: ShippingProvider[]; bindings: TenantShippingProvider[]; domains: Domain[]; storeUrl: string };

const SECTIONS = ["general", "branding", "fulfillment", "hours", "payments", "shipping", "domains"] as const;

export function SettingsPanel(props: Props) {
  const { t } = useT();
  const [tab, setTab] = useState<(typeof SECTIONS)[number]>("general");
  const labels: Record<(typeof SECTIONS)[number], string> = { general: t("general"), branding: t("branding"), fulfillment: t("fulfillment_s"), hours: t("business_hours"), payments: t("payments_s"), shipping: t("shipping_s"), domains: t("domains_section") };
  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <nav className="flex gap-1 overflow-x-auto lg:flex-col no-scrollbar">{SECTIONS.map((s) => <button key={s} onClick={() => setTab(s)} className={cn("whitespace-nowrap rounded-lg px-3 py-2 text-start text-sm font-medium", tab === s ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100")}>{labels[s]}</button>)}</nav>
      <div>
        {tab === "general" && <GeneralForm {...props} />}
        {tab === "branding" && <BrandingForm {...props} />}
        {tab === "fulfillment" && <FulfillmentForm {...props} />}
        {tab === "hours" && <HoursForm {...props} />}
        {tab === "payments" && <PaymentsForm {...props} />}
        {tab === "shipping" && <ShippingForms {...props} />}
        {tab === "domains" && <DomainsInfo {...props} />}
      </div>
    </div>
  );
}

function useSection(slug: string, section: string) {
  const router = useRouter();
  const [state, action] = useActionState(async (prev: Awaited<ReturnType<typeof saveSettings>> | null, fd: FormData) => { const r = await saveSettings(slug, section, prev, fd); if (r.ok) router.refresh(); return r; }, null);
  return { state, action };
}

function Status({ state }: { state: { ok: boolean; error?: string } | null }) {
  if (!state) return null;
  return state.ok ? <Alert kind="success" messageKey="success_saved" /> : <Alert messageKey={state.error} />;
}

function GeneralForm({ slug, tenant }: Props) {
  const { t, locale } = useT();
  const { state, action } = useSection(slug, "general");
  return (
    <form action={action} className="card space-y-4">
      <h2 className="text-lg font-bold">{t("general")}</h2>
      <Status state={state} />
      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t("store_name")}><input name="name" className="input" defaultValue={tenant.name} required /></Field>
        <Field label={t("store_name_ar")}><input name="nameAr" className="input" dir="rtl" defaultValue={tenant.nameAr} /></Field>
        <Field label={t("store_description")}><textarea name="description" rows={2} className="input" defaultValue={tenant.description} /></Field>
        <Field label={t("description_ar")}><textarea name="descriptionAr" rows={2} className="input" dir="rtl" defaultValue={tenant.descriptionAr} /></Field>
        <Field label={t("email")}><input name="email" type="email" className="input" dir="ltr" defaultValue={tenant.email} /></Field>
        <Field label={t("phone")}><input name="phone" className="input" dir="ltr" defaultValue={tenant.phone} /></Field>
        <Field label={t("whatsapp")}><input name="whatsapp" className="input" dir="ltr" defaultValue={tenant.whatsapp} placeholder="97333000000" /></Field>
        <Field label={t("address")}><input name="address" className="input" defaultValue={tenant.address} /></Field>
        <Field label={t("business_type_f")}><select name="businessType" className="input" defaultValue={tenant.businessType}>{BUSINESS_TYPES.map((b) => <option key={b} value={b}>{t(`bt_${b}` as TKey)}</option>)}</select></Field>
        <Field label={t("choose_currency")}><select name="currency" className="input" defaultValue={tenant.currency}>{CURRENCY_CODES.map((c) => <option key={c} value={c}>{c} — {locale === "ar" ? CURRENCIES[c].ar : CURRENCIES[c].en}</option>)}</select></Field>
        <Field label={t("tax_rate")}><input name="taxRate" type="number" step="0.001" min="0" max="100" className="input" defaultValue={tenant.taxRate} /></Field>
        <div className="self-end"><Toggle name="taxInclusive" label={t("tax_inclusive")} defaultChecked={tenant.taxInclusive} /></div>
      </div>
      <SubmitButton>{t("save")}</SubmitButton>
    </form>
  );
}

function BrandingForm({ slug, tenant }: Props) {
  const { t, locale } = useT();
  const { state, action } = useSection(slug, "branding");
  const [templateId, setTemplateId] = useState(tenant.templateId);
  const [logo, setLogo] = useState(tenant.logoUrl);
  const [hero, setHero] = useState(tenant.heroUrl);
  const [primary, setPrimary] = useState(tenant.primaryColor);
  const [secondary, setSecondary] = useState(tenant.secondaryColor);
  const [bg, setBg] = useState(tenant.backgroundColor);
  const applyPalette = (id: number) => { const tp = TEMPLATES.find((x) => x.id === id)!; setTemplateId(id); setPrimary(tp.palette.primary); setSecondary(tp.palette.secondary); setBg(tp.palette.background); };
  return (
    <form action={action} className="space-y-6">
      <div className="card space-y-4">
        <h2 className="text-lg font-bold">{t("choose_template_s")}</h2>
        <Status state={state} />
        <input type="hidden" name="templateId" value={templateId} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {TEMPLATES.map((tp) => (
            <button type="button" key={tp.id} onClick={() => applyPalette(tp.id)} className={cn("overflow-hidden rounded-xl border-2 text-start transition", templateId === tp.id ? "border-emerald-500 ring-2 ring-emerald-100" : "border-slate-200 hover:border-slate-300")}>
              <div className="p-2" style={{ background: tp.palette.background }}>
                <div className="flex items-center justify-between"><span className="h-1.5 w-8 rounded" style={{ background: tp.palette.text, opacity: 0.7 }} /><span className="h-1.5 w-3 rounded" style={{ background: tp.palette.primary }} /></div>
                <div className="mt-1.5 h-8" style={{ background: tp.palette.primary, opacity: 0.85, borderRadius: tp.radius === "none" ? 0 : 6 }} />
                <div className="mt-1.5 grid grid-cols-3 gap-1">{[1, 2, 3].map((i) => <div key={i} style={{ background: tp.palette.surface, border: `1px solid ${tp.palette.muted}33`, height: 16, borderRadius: tp.radius === "none" ? 0 : 4 }} />)}</div>
              </div>
              <div className="flex items-center justify-between bg-white px-2 py-1.5"><div><div className="text-xs font-bold">{locale === "ar" ? tp.nameAr : tp.name}</div><div className="text-[10px] uppercase text-slate-400">{tp.category}</div></div>{tenant.templateId === tp.id && <Badge tone="green">{t("current_template")}</Badge>}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="card space-y-4">
        <h2 className="text-lg font-bold">{t("branding")}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[["primaryColor", t("primary_color"), primary, setPrimary], ["secondaryColor", t("secondary_color"), secondary, setSecondary], ["backgroundColor", t("background_color"), bg, setBg]].map(([name, label, val, set]) => (
            <Field key={name as string} label={label as string}><div className="flex items-center gap-2"><input type="color" value={val as string} onChange={(e) => (set as (v: string) => void)(e.target.value)} className="h-10 w-14 cursor-pointer rounded border border-slate-200" /><input name={name as string} value={val as string} onChange={(e) => (set as (v: string) => void)(e.target.value)} className="input font-mono" dir="ltr" /></div></Field>
          ))}
          <Field label={t("typography_scale")}><input name="typographyScale" type="range" min="0.8" max="1.4" step="0.05" defaultValue={tenant.typographyScale} className="w-full" /></Field>
          <Field label={t("font_family")}><select name="fontFamily" className="input" defaultValue={tenant.fontFamily}>{Object.keys(MERCHANT_FONTS).map((f) => <option key={f} value={f}>{f === "default" ? t("default_font") : t(`font_${f}` as TKey)}</option>)}</select></Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("logo")}><input type="hidden" name="logoUrl" value={logo} /><MediaPicker slug={slug} value={logo} onChange={setLogo} /></Field>
          <Field label={t("hero_banner")}><input type="hidden" name="heroUrl" value={hero} /><MediaPicker slug={slug} value={hero} onChange={setHero} /></Field>
          <Field label={t("hero_title_f")}><input name="heroTitle" className="input" defaultValue={tenant.heroTitle} /></Field>
          <Field label={`${t("hero_title_f")} (AR)`}><input name="heroTitleAr" className="input" dir="rtl" defaultValue={tenant.heroTitleAr} /></Field>
          <Field label={t("hero_subtitle_f")}><input name="heroSubtitle" className="input" defaultValue={tenant.heroSubtitle} /></Field>
          <Field label={`${t("hero_subtitle_f")} (AR)`}><input name="heroSubtitleAr" className="input" dir="rtl" defaultValue={tenant.heroSubtitleAr} /></Field>
        </div>
        <div className="rounded-xl border border-slate-200 p-4" style={{ background: bg }}>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: secondary }}>{t("preview")}</div>
          <div className="mt-2 flex items-center gap-3"><span className="rounded-lg px-4 py-2 font-semibold text-white" style={{ background: primary }}>{t("add_to_cart")}</span><span className="rounded-lg border px-4 py-2 font-semibold" style={{ borderColor: primary, color: primary }}>{t("view_cart")}</span></div>
        </div>
        <SubmitButton>{t("save")}</SubmitButton>
      </div>
    </form>
  );
}

function FulfillmentForm({ slug, tenant }: Props) {
  const { t } = useT();
  const { state, action } = useSection(slug, "fulfillment");
  return (
    <form action={action} className="card space-y-4">
      <h2 className="text-lg font-bold">{t("fulfillment_s")}</h2>
      <Status state={state} />
      <div className="grid gap-3 md:grid-cols-3">
        <Toggle name="deliveryEnabled" label={t("delivery_enabled")} defaultChecked={tenant.deliveryEnabled} />
        <Toggle name="pickupEnabled" label={t("pickup_enabled")} defaultChecked={tenant.pickupEnabled} />
        <Toggle name="dineInEnabled" label={t("dine_in_enabled")} defaultChecked={tenant.dineInEnabled} />
        <Field label={`${t("delivery_fee_f")} (${tenant.currency})`}><input name="deliveryFee" type="number" step="0.001" min="0" className="input" defaultValue={tenant.deliveryFee} /></Field>
        <Field label={`${t("min_order")} (${tenant.currency})`}><input name="minOrder" type="number" step="0.001" min="0" className="input" defaultValue={tenant.minOrder} /></Field>
      </div>
      <SubmitButton>{t("save")}</SubmitButton>
    </form>
  );
}

function HoursForm({ slug, tenant }: Props) {
  const { t } = useT();
  const { state, action } = useSection(slug, "hours");
  return (
    <form action={action} className="card space-y-4">
      <h2 className="text-lg font-bold">{t("business_hours")}</h2>
      <Status state={state} />
      <div className="space-y-2">
        {tenant.businessHours.map((h) => (
          <div key={h.day} className="grid grid-cols-4 items-center gap-2 rounded-lg bg-slate-50 p-2 text-sm">
            <span className="font-medium">{t(`day_${h.day}` as TKey)}</span>
            <input type="time" name={`open_${h.day}`} defaultValue={h.open} className="input" dir="ltr" />
            <input type="time" name={`close_${h.day}`} defaultValue={h.close} className="input" dir="ltr" />
            <label className="flex items-center gap-2"><input type="checkbox" name={`closed_${h.day}`} defaultChecked={h.closed} />{t("closed")}</label>
          </div>
        ))}
      </div>
      <SubmitButton>{t("save")}</SubmitButton>
    </form>
  );
}

function PaymentsForm({ slug, tenant }: Props) {
  const { t } = useT();
  const { state, action } = useSection(slug, "payments");
  const p = tenant.payments;
  const mask = (v: string) => (v ? `••••${v.slice(-4)}` : "");
  return (
    <form action={action} className="space-y-4">
      <Status state={state} />
      <div className="card space-y-2"><Toggle name="cash_enabled" label={t("payment_cash")} defaultChecked={p.cash.enabled} /></div>
      <div className="card space-y-3">
        <Toggle name="benefit_enabled" label={t("payment_benefit")} defaultChecked={p.benefit.enabled} />
        <div className="grid gap-3 md:grid-cols-3">
          <Field label={t("tranportal_id")}><input name="benefit_tranportalId" className="input" dir="ltr" defaultValue={p.benefit.tranportalId} /></Field>
          <Field label={t("tranportal_password")}><input name="benefit_tranportalPassword" type="password" className="input" dir="ltr" placeholder={mask(p.benefit.tranportalPassword)} /></Field>
          <Field label={t("resource_key")}><input name="benefit_resourceKey" type="password" className="input" dir="ltr" placeholder={mask(p.benefit.resourceKey)} /></Field>
        </div>
      </div>
      <div className="card space-y-3">
        <Toggle name="card_enabled" label={t("payment_card")} defaultChecked={p.card.enabled} />
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t("publishable_key")}><input name="card_publishableKey" className="input" dir="ltr" defaultValue={p.card.publishableKey} placeholder="pk_live_..." /></Field>
          <Field label={t("secret_key")}><input name="card_secretKey" type="password" className="input" dir="ltr" placeholder={mask(p.card.secretKey) || "sk_live_..."} /></Field>
        </div>
      </div>
      <div className="card space-y-3">
        <Toggle name="paypal_enabled" label={t("payment_paypal")} defaultChecked={p.paypal.enabled} />
        <div className="grid gap-3 md:grid-cols-3">
          <Field label={t("client_id")}><input name="paypal_clientId" className="input" dir="ltr" defaultValue={p.paypal.clientId} /></Field>
          <Field label={t("client_secret")}><input name="paypal_clientSecret" type="password" className="input" dir="ltr" placeholder={mask(p.paypal.clientSecret)} /></Field>
          <div className="self-end"><Toggle name="paypal_sandbox" label={t("sandbox_mode")} defaultChecked={p.paypal.sandbox} /></div>
        </div>
      </div>
      <SubmitButton>{t("save")}</SubmitButton>
    </form>
  );
}

function ShippingForms({ slug, providers, bindings }: Props) {
  const { t, locale } = useT();
  const available = providers.filter((p) => p.active);
  if (!available.length) return <div className="card text-sm text-slate-500">{t("no_providers")}</div>;
  return <div className="space-y-4">{available.map((p) => <ProviderBindingForm key={p.id} slug={slug} provider={p} binding={bindings.find((b) => b.providerId === p.id)} locale={locale} />)}</div>;
}

function ProviderBindingForm({ slug, provider, binding, locale }: { slug: string; provider: ShippingProvider; binding?: TenantShippingProvider; locale: string }) {
  const { t } = useT();
  const { state, action } = useSection(slug, "shipping");
  const disabled = !binding || !binding.enabledByAdmin;
  return (
    <form action={action} className={cn("card space-y-3", disabled && "opacity-60")}>
      <div className="flex items-center justify-between"><h3 className="font-bold">{locale === "ar" ? provider.nameAr : provider.name}</h3>{disabled ? <Badge tone="rose">{t("disabled_by_admin")}</Badge> : binding?.active ? <Badge tone="green">{t("active")}</Badge> : <Badge tone="slate">{t("inactive")}</Badge>}</div>
      <Status state={state} />
      <input type="hidden" name="providerId" value={provider.id} />
      {provider.configSchema.length > 0 && <div className="grid gap-3 md:grid-cols-2">{provider.configSchema.map((f) => <Field key={f.key} label={`${locale === "ar" ? f.labelAr || f.label : f.label}${f.required ? " *" : ""}`}><input name={`cred_${f.key}`} type={f.type === "password" ? "password" : f.type === "number" ? "number" : "text"} className="input" dir="ltr" defaultValue={f.type === "password" ? "" : binding?.credentials?.[f.key] ?? ""} placeholder={f.type === "password" && binding?.credentials?.[f.key] ? "••••••" : ""} disabled={disabled} /></Field>)}</div>}
      <Toggle name="active" label={t("activate_provider")} defaultChecked={binding?.active ?? false} disabled={disabled} />
      <SubmitButton className="btn-primary">{t("save")}</SubmitButton>
    </form>
  );
}

function DomainsInfo({ domains, storeUrl }: Props) {
  const { t } = useT();
  return (
    <div className="card space-y-3">
      <h2 className="text-lg font-bold">{t("domains_section")}</h2>
      <div><span className="label">{t("store_url")}</span><a href={storeUrl} target="_blank" rel="noreferrer" className="font-mono text-emerald-600 underline" dir="ltr">{storeUrl}</a></div>
      <ul className="divide-y divide-slate-100 text-sm">{domains.map((d) => <li key={d.id} className="flex items-center justify-between py-2"><span className="font-mono" dir="ltr">{d.host}</span><span className="flex gap-1"><Badge tone={d.type === "custom" ? "blue" : "slate"}>{d.type === "custom" ? t("custom_domain") : "subdomain"}</Badge>{d.verified && <Badge tone="green">✓</Badge>}</span></li>)}</ul>
      <p className="text-xs text-slate-500">{t("custom_domain_request")}</p>
    </div>
  );
}
