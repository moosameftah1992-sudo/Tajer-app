"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { registerStore, checkSlugAvailable } from "@/actions/platform";
import { useT } from "@/components/locale-provider";
import { Alert, Field, SubmitButton } from "@/components/ui";
import { CURRENCIES, CURRENCY_CODES, BUSINESS_TYPES, slugify, formatDate } from "@/lib/utils";
import { TEMPLATES, TEMPLATE_FOR_BUSINESS } from "@/lib/templates";
import type { TKey } from "@/lib/i18n";

export function OnboardingWizard({ rootDomain }: { rootDomain: string }) {
  const { t, locale } = useT();
  const [state, action] = useActionState(registerStore, null);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [businessType, setBusinessType] = useState<string>("general");
  const [templateId, setTemplateId] = useState<number>(1);
  const [currency, setCurrency] = useState("BHD");

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);
  useEffect(() => {
    setTemplateId(TEMPLATE_FOR_BUSINESS[businessType] ?? 1);
  }, [businessType]);
  useEffect(() => {
    if (!slug) return setAvailable(null);
    const h = setTimeout(() => checkSlugAvailable(slug).then((r) => setAvailable(r.available)), 350);
    return () => clearTimeout(h);
  }, [slug]);

  const steps = [t("step_store"), t("step_owner"), t("step_setup"), t("step_done")];
  const done = state?.ok === true;
  const storeUrl = useMemo(() => (rootDomain ? `https://${slug || "store"}.${rootDomain}` : `/s/${slug || "store"}`), [slug, rootDomain]);

  if (done && state.ok) {
    return (
      <div className="card text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">🎉</div>
        <h2 className="mt-4 text-2xl font-extrabold">{t("store_created")}</h2>
        <p className="mt-2 text-slate-600">{t("store_created_sub")}</p>
        {state.trialEndsAt && <p className="mt-2 text-sm text-slate-500">{t("trial_info")}: <b>{formatDate(state.trialEndsAt, locale)}</b></p>}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href={`/s/${state.slug}/dashboard`} className="btn-accent">{t("go_to_dashboard")}</Link>
          <Link href={`/s/${state.slug}`} className="btn-outline">{t("visit_store")}</Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="card">
      <ol className="mb-6 flex items-center gap-2 text-xs font-semibold">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full ${i <= step ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"}`}>{i + 1}</span>
            <span className={i === step ? "text-slate-900" : "text-slate-400"}>{s}</span>
            {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-slate-200" />}
          </li>
        ))}
      </ol>

      {state && !state.ok && <Alert messageKey={state.error} className="mb-4" />}

      <div className={step === 0 ? "space-y-4" : "hidden"}>
        <Field label={t("store_name")}><input name="name" className="input" required value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label={t("store_name_ar")}><input name="nameAr" className="input" dir="rtl" /></Field>
        <Field label={t("store_slug")} hint={t("slug_hint")}>
          <div className="flex items-center gap-2">
            <input name="slug" className="input" dir="ltr" value={slug} onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }} required />
            {available !== null && <span className={`text-lg ${available ? "text-emerald-500" : "text-rose-500"}`}>{available ? "✓" : "✗"}</span>}
          </div>
          <span className="mt-1 block text-xs text-slate-500" dir="ltr">{storeUrl}</span>
        </Field>
        <Field label={t("business_type")}>
          <select name="businessType" className="input" value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
            {BUSINESS_TYPES.map((b) => <option key={b} value={b}>{t(`bt_${b}` as TKey)}</option>)}
          </select>
        </Field>
      </div>

      <div className={step === 1 ? "space-y-4" : "hidden"}>
        <Field label={t("owner_name")}><input name="ownerName" className="input" required /></Field>
        <Field label={t("owner_email")}><input name="email" type="email" className="input" required dir="ltr" /></Field>
        <Field label={t("phone")}><input name="phone" className="input" dir="ltr" /></Field>
        <Field label={t("owner_password")} hint={t("weak_password")}><input name="password" type="password" className="input" minLength={8} required dir="ltr" /></Field>
      </div>

      <div className={step === 2 ? "space-y-4" : "hidden"}>
        <Field label={t("choose_currency")}>
          <select name="currency" className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCY_CODES.map((c) => <option key={c} value={c}>{c} — {locale === "ar" ? CURRENCIES[c].ar : CURRENCIES[c].en}</option>)}
          </select>
        </Field>
        <Field label={t("country")}>
          <select name="country" className="input" defaultValue="BH">
            {[["BH", "Bahrain / البحرين"], ["SA", "Saudi Arabia / السعودية"], ["AE", "UAE / الإمارات"], ["KW", "Kuwait / الكويت"], ["QA", "Qatar / قطر"], ["OM", "Oman / عُمان"]].map(([c, l]) => <option key={c} value={c}>{l}</option>)}
          </select>
        </Field>
        <div>
          <span className="label">{t("choose_template")}</span>
          <input type="hidden" name="templateId" value={templateId} />
          <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
            {TEMPLATES.map((tpl) => (
              <button type="button" key={tpl.id} onClick={() => setTemplateId(tpl.id)} className={`rounded-xl border p-2 text-start transition ${templateId === tpl.id ? "border-emerald-500 ring-2 ring-emerald-100" : "border-slate-200 hover:border-slate-300"}`}>
                <div className="h-10 rounded-lg" style={{ background: `linear-gradient(135deg, ${tpl.palette.primary}, ${tpl.palette.background})` }} />
                <div className="mt-1 truncate text-[11px] font-semibold">{locale === "ar" ? tpl.nameAr : tpl.name}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} className="btn-outline" disabled={step === 0}>{t("back")}</button>
        {step < 2 ? (
          <button type="button" onClick={() => setStep((s) => s + 1)} className="btn-primary" disabled={step === 0 && (!name || available === false)}>{t("next")}</button>
        ) : (
          <SubmitButton>{t("create_store_btn")}</SubmitButton>
        )}
      </div>
    </form>
  );
}
