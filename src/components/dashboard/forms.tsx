"use client";

import { useActionState, useTransition } from "react";
import { staffLogin, staffLogout, requestRenewal } from "@/actions/store";
import { useT } from "@/components/locale-provider";
import { Alert, Field, SubmitButton } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import type { Plan } from "@/db/schema";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function StaffLoginForm({ slug }: { slug: string }) {
  const { t } = useT();
  const [state, action] = useActionState(staffLogin.bind(null, slug), null);
  return (
    <form action={action} className="card space-y-4">
      {state && !state.ok && <Alert messageKey={state.error} />}
      <Field label={t("email")}><input name="email" type="email" className="input" required dir="ltr" /></Field>
      <Field label={t("password")}><input name="password" type="password" className="input" required dir="ltr" /></Field>
      <SubmitButton className="btn-accent w-full">{t("login")}</SubmitButton>
    </form>
  );
}

export function StaffLogoutButton({ slug }: { slug: string }) {
  const { t } = useT();
  return <form action={staffLogout.bind(null, slug)}><button className="btn-ghost w-full justify-start text-rose-600">{t("logout")}</button></form>;
}

export function RenewalPlans({ slug, plans, canRenew }: { slug: string; plans: Plan[]; canRenew: boolean }) {
  const { t, locale } = useT();
  const router = useRouter();
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [msg, setMsg] = useState<{ ok: boolean; key: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <div className="mb-4 flex gap-2"><button onClick={() => setPeriod("monthly")} className={period === "monthly" ? "btn-primary" : "btn-outline"}>{t("billing_monthly")}</button><button onClick={() => setPeriod("yearly")} className={period === "yearly" ? "btn-primary" : "btn-outline"}>{t("billing_yearly")}</button></div>
      {msg && <Alert kind={msg.ok ? "success" : "error"} messageKey={msg.key} className="mb-4" />}
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <div key={p.id} className="card flex flex-col">
            <h3 className="text-lg font-bold">{locale === "ar" ? p.nameAr : p.name}</h3>
            <div className="mt-2 text-3xl font-extrabold">{formatMoney(period === "yearly" ? p.yearlyPrice : p.monthlyPrice, p.currency, locale)}<span className="text-sm font-medium text-slate-500"> {period === "yearly" ? t("per_year") : t("per_month")}</span></div>
            <ul className="mt-4 flex-1 space-y-1 text-sm text-slate-600">{(locale === "ar" ? p.featuresAr : p.features).map((f) => <li key={f}>✓ {f}</li>)}</ul>
            <button disabled={pending || !canRenew} className="btn-accent mt-4" onClick={() => start(async () => { const r = await requestRenewal(slug, p.id, period); setMsg({ ok: r.ok, key: r.ok ? "invoice_requested" : r.error }); router.refresh(); })}>{t("request_invoice")}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
