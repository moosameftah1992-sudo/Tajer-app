"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveAdmin,
  deleteAdmin,
  savePlan,
  deletePlan,
  updateTenantSubscription,
  addTenantDomain,
  removeTenantDomain,
  saveProvider,
  deleteProvider,
  toggleTenantProvider,
  settleInvoice,
  savePlatformSettings,
  adminLogout,
} from "@/actions/platform";
import { useT } from "@/components/locale-provider";
import { Alert, Field, Modal, SubmitButton, Toggle, Badge } from "@/components/ui";
import { ADMIN_PERMISSIONS, ADMIN_ROLES } from "@/lib/permissions";
import { CURRENCY_CODES, formatDate } from "@/lib/utils";
import { TEMPLATES } from "@/lib/templates";
import type { Plan, PlatformAdmin, ShippingProvider, Tenant, Domain, ProviderField } from "@/db/schema";
import type { TKey } from "@/lib/i18n";

export function LogoutButton() {
  const { t } = useT();
  return (
    <form action={adminLogout}>
      <button className="btn-ghost w-full justify-start text-rose-600">{t("logout")}</button>
    </form>
  );
}

/* ----------------------------- Admins ----------------------------- */
export function AdminForm({ admin, onDone }: { admin?: PlatformAdmin; onDone?: () => void }) {
  const { t } = useT();
  const [state, action] = useActionState(saveAdmin, null);
  const [role, setRole] = useState(admin?.role ?? "manager");
  if (state?.ok && onDone) onDone();
  return (
    <form action={action} className="space-y-3">
      {state && !state.ok && <Alert messageKey={state.error} />}
      <input type="hidden" name="id" value={admin?.id ?? ""} />
      <Field label={t("name")}><input name="name" className="input" defaultValue={admin?.name} required /></Field>
      <Field label={t("email")}><input name="email" type="email" className="input" defaultValue={admin?.email} required dir="ltr" /></Field>
      <Field label={admin ? t("new_password") : t("password")}><input name="password" type="password" className="input" minLength={8} dir="ltr" required={!admin} /></Field>
      <Field label={t("role")}>
        <select name="role" className="input" value={role} onChange={(e) => setRole(e.target.value)}>
          {ADMIN_ROLES.map((r) => <option key={r} value={r}>{t(`role_${r}` as TKey)}</option>)}
        </select>
      </Field>
      {role !== "super" && (
        <div className="grid grid-cols-2 gap-2">
          {ADMIN_PERMISSIONS.map((p) => (
            <Toggle key={p} name={`perm_${p}`} label={t(`admin_${p === "billing" ? "invoices" : p}` as TKey)} defaultChecked={admin?.permissions.includes(p)} />
          ))}
        </div>
      )}
      {admin && <Toggle name="active" label={t("active")} defaultChecked={admin.active} />}
      <SubmitButton>{t("save")}</SubmitButton>
    </form>
  );
}

export function AdminsManager({ admins, meId }: { admins: PlatformAdmin[]; meId: number }) {
  const { t, locale } = useT();
  const [editing, setEditing] = useState<PlatformAdmin | null | "new">(null);
  const router = useRouter();
  const [, start] = useTransition();
  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">{t("admin_admins")}</h2>
        <button className="btn-accent" onClick={() => setEditing("new")}>{t("add_admin")}</button>
      </div>
      <table className="table">
        <thead><tr><th>{t("name")}</th><th>{t("email")}</th><th>{t("role")}</th><th>{t("status")}</th><th>{t("last_login")}</th><th></th></tr></thead>
        <tbody>
          {admins.map((a) => (
            <tr key={a.id}>
              <td className="font-medium">{a.name}</td>
              <td dir="ltr">{a.email}</td>
              <td><Badge tone={a.role === "super" ? "violet" : a.role === "manager" ? "blue" : "slate"}>{t(`role_${a.role}` as TKey)}</Badge></td>
              <td>{a.active ? <Badge tone="green">{t("active")}</Badge> : <Badge tone="rose">{t("inactive")}</Badge>}</td>
              <td>{a.lastLoginAt ? formatDate(a.lastLoginAt, locale, true) : t("never")}</td>
              <td className="text-end">
                <button className="btn-ghost" onClick={() => setEditing(a)}>{t("edit")}</button>
                {a.id !== meId && <button className="btn-ghost text-rose-600" onClick={() => start(async () => { await deleteAdmin(a.id); router.refresh(); })}>{t("delete")}</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? t("add_admin") : t("edit")}>
        {editing !== null && <AdminForm admin={editing === "new" ? undefined : editing} onDone={() => { setEditing(null); router.refresh(); }} />}
      </Modal>
    </div>
  );
}

/* ----------------------------- Plans ----------------------------- */
export function PlanForm({ plan, onDone }: { plan?: Plan; onDone?: () => void }) {
  const { t } = useT();
  const [state, action] = useActionState(savePlan, null);
  if (state?.ok && onDone) onDone();
  return (
    <form action={action} className="space-y-3">
      {state && !state.ok && <Alert messageKey={state.error} />}
      <input type="hidden" name="id" value={plan?.id ?? ""} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("plan_name")}><input name="name" className="input" defaultValue={plan?.name} required /></Field>
        <Field label={t("name_ar")}><input name="nameAr" className="input" defaultValue={plan?.nameAr} dir="rtl" /></Field>
        <Field label={t("monthly_price")}><input name="monthlyPrice" type="number" step="0.001" min="0" className="input" defaultValue={plan?.monthlyPrice} required /></Field>
        <Field label={t("yearly_price")}><input name="yearlyPrice" type="number" step="0.001" min="0" className="input" defaultValue={plan?.yearlyPrice} required /></Field>
        <Field label={t("currency")}>
          <select name="currency" className="input" defaultValue={plan?.currency ?? "USD"}>{CURRENCY_CODES.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
        <Field label={t("sort_order")}><input name="sort" type="number" className="input" defaultValue={plan?.sort ?? 0} /></Field>
      </div>
      <Field label={`${t("features")} (EN)`} hint={t("features_hint")}><textarea name="features" className="input" rows={4} defaultValue={plan?.features.join("\n")} /></Field>
      <Field label={`${t("features")} (AR)`} hint={t("features_hint")}><textarea name="featuresAr" className="input" rows={4} dir="rtl" defaultValue={plan?.featuresAr.join("\n")} /></Field>
      <Toggle name="active" label={t("active")} defaultChecked={plan?.active ?? true} />
      <SubmitButton>{t("save")}</SubmitButton>
    </form>
  );
}

export function PlansManager({ plans }: { plans: Plan[] }) {
  const { t, locale } = useT();
  const [editing, setEditing] = useState<Plan | null | "new">(null);
  const router = useRouter();
  const [, start] = useTransition();
  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">{t("admin_plans")}</h2>
        <button className="btn-accent" onClick={() => setEditing("new")}>{t("add_plan")}</button>
      </div>
      <table className="table">
        <thead><tr><th>{t("plan_name")}</th><th>{t("monthly_price")}</th><th>{t("yearly_price")}</th><th>{t("status")}</th><th></th></tr></thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.id}>
              <td className="font-medium">{locale === "ar" ? p.nameAr : p.name}</td>
              <td>{p.monthlyPrice} {p.currency}</td>
              <td>{p.yearlyPrice} {p.currency}</td>
              <td>{p.active ? <Badge tone="green">{t("active")}</Badge> : <Badge tone="slate">{t("inactive")}</Badge>}</td>
              <td className="text-end">
                <button className="btn-ghost" onClick={() => setEditing(p)}>{t("edit")}</button>
                {p.active && <button className="btn-ghost text-rose-600" onClick={() => start(async () => { await deletePlan(p.id); router.refresh(); })}>{t("deactivate")}</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? t("add_plan") : t("edit")}>
        {editing !== null && <PlanForm plan={editing === "new" ? undefined : editing} onDone={() => { setEditing(null); router.refresh(); }} />}
      </Modal>
    </div>
  );
}

/* ----------------------------- Merchant control ----------------------------- */
export function SubscriptionControls({ tenant, plans }: { tenant: Tenant; plans: Plan[] }) {
  const { t, locale } = useT();
  const [state, action] = useActionState(updateTenantSubscription, null);
  const d = new Date(tenant.subscriptionEndsAt);
  const dateValue = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const Hidden = ({ mode }: { mode: string }) => (<><input type="hidden" name="tenantId" value={tenant.id} /><input type="hidden" name="mode" value={mode} /></>);
  return (
    <div className="card space-y-4">
      <h3 className="text-lg font-bold">{t("subscription_control")}</h3>
      {state && (state.ok ? <Alert kind="success" messageKey="success_saved" /> : <Alert messageKey={state.error} />)}
      <div className="flex flex-wrap gap-2">
        <form action={action}><Hidden mode="extend30" /><SubmitButton className="btn-outline">{t("extend_30")}</SubmitButton></form>
        <form action={action}><Hidden mode="extend365" /><SubmitButton className="btn-outline">{t("extend_365")}</SubmitButton></form>
        <form action={action} className="flex items-end gap-2">
          <Hidden mode="status" />
          <input type="hidden" name="status" value={tenant.status === "suspended" ? "active" : "suspended"} />
          <SubmitButton className={tenant.status === "suspended" ? "btn-accent" : "btn-danger"}>{tenant.status === "suspended" ? t("activate") : t("suspend")}</SubmitButton>
        </form>
      </div>
      <form action={action} className="flex flex-wrap items-end gap-2">
        <Hidden mode="date" />
        <Field label={t("set_date")}><input type="datetime-local" name="date" className="input" defaultValue={dateValue} /></Field>
        <SubmitButton className="btn-primary">{t("save_date")}</SubmitButton>
      </form>
      <form action={action} className="flex flex-wrap items-end gap-2">
        <Hidden mode="plan" />
        <Field label={t("plan")}>
          <select name="planId" className="input" defaultValue={tenant.planId ?? ""}>
            <option value="">{t("none")}</option>
            {plans.map((p) => <option key={p.id} value={p.id}>{locale === "ar" ? p.nameAr : p.name}</option>)}
          </select>
        </Field>
        <Field label={t("billing_cycle")}>
          <select name="billingCycle" className="input" defaultValue={tenant.billingCycle}>
            <option value="trial">{t("trial")}</option><option value="monthly">{t("billing_monthly")}</option><option value="yearly">{t("billing_yearly")}</option>
          </select>
        </Field>
        <SubmitButton className="btn-primary">{t("save")}</SubmitButton>
      </form>
      <div className="grid gap-3 md:grid-cols-2">
        <form action={action} className="flex items-end gap-2">
          <Hidden mode="template" />
          <Field label={t("override_template")} className="flex-1">
            <select name="templateId" className="input" defaultValue={tenant.templateId}>
              {TEMPLATES.map((tp) => <option key={tp.id} value={tp.id}>{tp.id}. {locale === "ar" ? tp.nameAr : tp.name}</option>)}
            </select>
          </Field>
          <SubmitButton className="btn-outline">{t("save")}</SubmitButton>
        </form>
        <form action={action} className="flex items-end gap-2">
          <Hidden mode="currency" />
          <Field label={t("override_currency")} className="flex-1">
            <select name="currency" className="input" defaultValue={tenant.currency}>{CURRENCY_CODES.map((c) => <option key={c}>{c}</option>)}</select>
          </Field>
          <SubmitButton className="btn-outline">{t("save")}</SubmitButton>
        </form>
      </div>
    </div>
  );
}

export function DomainsManager({ tenant, domains }: { tenant: Tenant; domains: Domain[] }) {
  const { t } = useT();
  const [state, action] = useActionState(addTenantDomain, null);
  const router = useRouter();
  const [, start] = useTransition();
  return (
    <div className="card space-y-4">
      <h3 className="text-lg font-bold">{t("domains")}</h3>
      <ul className="divide-y divide-slate-100 text-sm">
        {domains.map((d) => (
          <li key={d.id} className="flex items-center justify-between py-2">
            <span dir="ltr" className="font-mono">{d.host}</span>
            <span className="flex items-center gap-2">
              <Badge tone={d.type === "custom" ? "blue" : "slate"}>{d.type === "custom" ? t("custom_domain") : "subdomain"}</Badge>
              {d.isPrimary && <Badge tone="green">primary</Badge>}
              {d.type === "custom" && <button className="btn-ghost text-rose-600" onClick={() => start(async () => { await removeTenantDomain(d.id, tenant.id); router.refresh(); })}>{t("delete")}</button>}
            </span>
          </li>
        ))}
      </ul>
      <form action={action} className="space-y-2 rounded-xl bg-slate-50 p-3">
        {state && (state.ok ? <Alert kind="success" messageKey="success_saved" /> : <Alert messageKey={state.error} />)}
        <input type="hidden" name="tenantId" value={tenant.id} />
        <Field label={t("custom_domain")} hint={t("domain_hint")}><input name="host" className="input" placeholder="shop.example.com" dir="ltr" required /></Field>
        <Toggle name="isPrimary" label="Primary" defaultChecked />
        <SubmitButton className="btn-primary">{t("add_domain")}</SubmitButton>
      </form>
    </div>
  );
}

export function TenantCarrierToggles({ tenantId, providers, bindings }: { tenantId: number; providers: ShippingProvider[]; bindings: { providerId: number; enabledByAdmin: boolean; active: boolean }[] }) {
  const { t, locale } = useT();
  const router = useRouter();
  const [, start] = useTransition();
  return (
    <div className="card">
      <h3 className="mb-3 text-lg font-bold">{t("carriers_for_store")}</h3>
      <div className="space-y-2">
        {providers.map((p) => {
          const b = bindings.find((x) => x.providerId === p.id);
          return (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
              <div>
                <div className="font-medium">{locale === "ar" ? p.nameAr : p.name} <span className="text-xs text-slate-400">({p.code})</span></div>
                <div className="text-xs text-slate-500">{b?.active ? t("activate_provider") : t("inactive")}</div>
              </div>
              <Toggle label={t("enabled_for_store")} checked={b?.enabledByAdmin ?? false} onChange={(v) => start(async () => { await toggleTenantProvider(tenantId, p.id, v); router.refresh(); })} />
            </div>
          );
        })}
        {!providers.length && <p className="text-sm text-slate-500">{t("no_providers")}</p>}
      </div>
    </div>
  );
}

/* ----------------------------- Logistics ----------------------------- */
export function ProviderForm({ provider, onDone }: { provider?: ShippingProvider; onDone?: () => void }) {
  const { t } = useT();
  const [state, action] = useActionState(saveProvider, null);
  const [fields, setFields] = useState<ProviderField[]>(provider?.configSchema ?? [{ key: "api_key", label: "API Key", labelAr: "مفتاح API", type: "password", required: true }]);
  if (state?.ok && onDone) onDone();
  const update = (i: number, patch: Partial<ProviderField>) => setFields((f) => f.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <form action={action} className="space-y-3">
      {state && !state.ok && <Alert messageKey={state.error} />}
      <input type="hidden" name="id" value={provider?.id ?? ""} />
      <input type="hidden" name="configSchema" value={JSON.stringify(fields)} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("provider_name")}><input name="name" className="input" defaultValue={provider?.name} required /></Field>
        <Field label={t("name_ar")}><input name="nameAr" className="input" defaultValue={provider?.nameAr} dir="rtl" /></Field>
        <Field label={t("provider_code")}><input name="code" className="input" defaultValue={provider?.code} dir="ltr" placeholder="parcel" /></Field>
        <Field label={t("default_fee")}><input name="defaultFee" type="number" step="0.001" className="input" defaultValue={provider?.defaultFee ?? "0"} /></Field>
      </div>
      <Field label={t("webhook_url")}><input name="webhookUrl" className="input" defaultValue={provider?.webhookUrl} dir="ltr" placeholder="https://api.carrier.com/shipments" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("auth_header")}><input name="authHeader" className="input" defaultValue={provider?.authHeader ?? "Authorization"} dir="ltr" /></Field>
        <Field label={t("outbound_secret")}><input name="outboundSecret" className="input" defaultValue={provider?.outboundSecret} dir="ltr" /></Field>
      </div>
      <Field label={t("inbound_secret")} hint={provider ? provider.inboundSecret : undefined}><input name="inboundSecret" className="input" dir="ltr" placeholder={provider ? "••••••" : "auto-generated"} /></Field>
      <Field label={t("tracking_url_template")}><input name="trackingUrlTemplate" className="input" defaultValue={provider?.trackingUrlTemplate} dir="ltr" placeholder="https://track.carrier.com/{tracking}" /></Field>
      <div>
        <div className="mb-1 flex items-center justify-between"><span className="label">{t("config_schema")}</span><button type="button" className="btn-ghost text-emerald-600" onClick={() => setFields((f) => [...f, { key: "", label: "", labelAr: "", type: "text", required: false }])}>+ {t("add_field")}</button></div>
        <div className="space-y-2">
          {fields.map((f, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-2 rounded-lg bg-slate-50 p-2">
              <input className="input col-span-3" placeholder={t("field_key")} value={f.key} onChange={(e) => update(i, { key: e.target.value })} dir="ltr" />
              <input className="input col-span-3" placeholder={t("field_label")} value={f.label} onChange={(e) => update(i, { label: e.target.value })} />
              <input className="input col-span-2" placeholder={t("field_label_ar")} value={f.labelAr} onChange={(e) => update(i, { labelAr: e.target.value })} dir="rtl" />
              <select className="input col-span-2" value={f.type} onChange={(e) => update(i, { type: e.target.value as ProviderField["type"] })}><option value="text">text</option><option value="password">password</option><option value="number">number</option></select>
              <label className="col-span-1 flex items-center gap-1 text-xs"><input type="checkbox" checked={f.required} onChange={(e) => update(i, { required: e.target.checked })} />{t("required")}</label>
              <button type="button" className="col-span-1 text-rose-500" onClick={() => setFields((x) => x.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
        </div>
      </div>
      <Toggle name="active" label={t("active")} defaultChecked={provider?.active ?? true} />
      <SubmitButton>{t("save")}</SubmitButton>
    </form>
  );
}

export function ProvidersManager({ providers, webhookBase }: { providers: ShippingProvider[]; webhookBase: string }) {
  const { t, locale } = useT();
  const [editing, setEditing] = useState<ShippingProvider | null | "new">(null);
  const router = useRouter();
  const [, start] = useTransition();
  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">{t("admin_logistics")}</h2>
        <button className="btn-accent" onClick={() => setEditing("new")}>{t("add_provider")}</button>
      </div>
      <div className="space-y-3">
        {providers.map((p) => (
          <div key={p.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-bold">{locale === "ar" ? p.nameAr : p.name} <span className="text-xs font-normal text-slate-400">({p.code})</span></div>
                <div className="mt-1 text-xs text-slate-500"><span className="font-semibold">{t("webhook_endpoint")}:</span> <code dir="ltr">{webhookBase}/api/logistics/webhook/{p.code}</code></div>
                <div className="text-xs text-slate-500"><span className="font-semibold">{t("inbound_secret")}:</span> <code dir="ltr">{p.inboundSecret}</code></div>
              </div>
              <div className="flex items-center gap-2">
                {p.active ? <Badge tone="green">{t("active")}</Badge> : <Badge tone="slate">{t("inactive")}</Badge>}
                <button className="btn-ghost" onClick={() => setEditing(p)}>{t("edit")}</button>
                <button className="btn-ghost text-rose-600" onClick={() => start(async () => { await deleteProvider(p.id); router.refresh(); })}>{t("delete")}</button>
              </div>
            </div>
            {p.configSchema.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{p.configSchema.map((f) => <Badge key={f.key}>{f.key}{f.required ? " *" : ""}</Badge>)}</div>}
          </div>
        ))}
        {!providers.length && <p className="text-sm text-slate-500">{t("no_providers")}</p>}
      </div>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? t("add_provider") : t("edit")} wide>
        {editing !== null && <ProviderForm provider={editing === "new" ? undefined : editing} onDone={() => { setEditing(null); router.refresh(); }} />}
      </Modal>
    </div>
  );
}

/* ----------------------------- Billing & settings ----------------------------- */
export function InvoiceActions({ id }: { id: number }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <button disabled={pending} className="btn-accent px-3 py-1" onClick={() => start(async () => { await settleInvoice(id, "paid"); router.refresh(); })}>{t("mark_paid")}</button>
      <button disabled={pending} className="btn-ghost px-3 py-1 text-rose-600" onClick={() => start(async () => { await settleInvoice(id, "cancelled"); router.refresh(); })}>{t("cancel")}</button>
    </div>
  );
}

export function PlatformSettingsForm({ settings }: { settings: { commissionRate: string; trialDays: number; supportEmail: string; bankDetails: string } }) {
  const { t } = useT();
  const [state, action] = useActionState(savePlatformSettings, null);
  return (
    <form action={action} className="card space-y-3">
      {state && (state.ok ? <Alert kind="success" messageKey="success_saved" /> : <Alert messageKey={state.error} />)}
      <div className="grid gap-3 md:grid-cols-3">
        <Field label={t("commission_rate")}><input name="commissionRate" type="number" step="0.001" min="0" max="100" className="input" defaultValue={settings.commissionRate} /></Field>
        <Field label={t("trial_days")}><input name="trialDays" type="number" min="1" className="input" defaultValue={settings.trialDays} /></Field>
        <Field label={t("support_email")}><input name="supportEmail" type="email" className="input" defaultValue={settings.supportEmail} dir="ltr" /></Field>
      </div>
      <Field label={t("bank_details")}><textarea name="bankDetails" rows={4} className="input" defaultValue={settings.bankDetails} /></Field>
      <SubmitButton>{t("save")}</SubmitButton>
    </form>
  );
}
