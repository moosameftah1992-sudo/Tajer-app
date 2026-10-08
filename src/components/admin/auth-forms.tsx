"use client";

import { useActionState } from "react";
import { adminLogin, adminSetup } from "@/actions/platform";
import { useT } from "@/components/locale-provider";
import { Alert, Field, SubmitButton } from "@/components/ui";

export function AdminAuthForm({ setup }: { setup: boolean }) {
  const { t } = useT();
  const [state, action] = useActionState(setup ? adminSetup : adminLogin, null);
  return (
    <form action={action} className="card space-y-4">
      {state && !state.ok && <Alert messageKey={state.error} />}
      {setup && <Field label={t("name")}><input name="name" className="input" required /></Field>}
      <Field label={t("email")}><input name="email" type="email" className="input" required dir="ltr" /></Field>
      <Field label={t("password")}><input name="password" type="password" className="input" required minLength={setup ? 8 : 1} dir="ltr" /></Field>
      <SubmitButton className="btn-primary w-full">{setup ? t("create") : t("login")}</SubmitButton>
    </form>
  );
}
