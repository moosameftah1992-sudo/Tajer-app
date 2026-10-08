"use client";

import { useActionState } from "react";
import Link from "next/link";
import { merchantLogin } from "@/actions/platform";
import { useT } from "@/components/locale-provider";
import { Alert, Field, SubmitButton } from "@/components/ui";

export function MerchantLoginForm() {
  const { t, locale } = useT();
  const [state, action] = useActionState(merchantLogin, null);
  const stores = state?.ok ? state.stores ?? [] : [];
  return (
    <form action={action} className="card space-y-4">
      {state && !state.ok && <Alert messageKey={state.error} />}
      <Field label={t("email")}><input name="email" type="email" className="input" required dir="ltr" /></Field>
      <Field label={t("password")}><input name="password" type="password" className="input" required dir="ltr" /></Field>
      {stores.length > 0 && (
        <Field label={t("choose_store")}>
          <select name="slug" className="input" required defaultValue={stores[0].slug}>
            {stores.map((s) => <option key={s.slug} value={s.slug}>{locale === "ar" ? s.nameAr : s.name} ({s.slug})</option>)}
          </select>
        </Field>
      )}
      <SubmitButton className="btn-accent w-full">{t("login")}</SubmitButton>
      <p className="text-center text-sm text-slate-500">{t("no_account")} <Link href="/register" className="font-semibold text-emerald-600">{t("create_one")}</Link></p>
    </form>
  );
}
