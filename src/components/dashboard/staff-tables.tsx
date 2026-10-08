"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStaff, deleteStaff, saveTable, deleteTable, regenerateTableCode } from "@/actions/store";
import { useT } from "@/components/locale-provider";
import { Alert, Field, Modal, SubmitButton, Toggle, Badge, EmptyState } from "@/components/ui";
import { PERMISSIONS, ROLE_PRESETS, STAFF_ROLES, type StaffRole } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import type { StaffUser, DiningTable } from "@/db/schema";
import type { TKey } from "@/lib/i18n";

const roleKey = (r: string) => (r === "manager" ? "role_manager_s" : `role_${r}`) as TKey;

export function StaffManager({ slug, staff, meId }: { slug: string; staff: StaffUser[]; meId: number }) {
  const { t, locale } = useT();
  const [editing, setEditing] = useState<StaffUser | "new" | null>(null);
  const [role, setRole] = useState<StaffRole>("cashier");
  const [perms, setPerms] = useState<string[]>([]);
  const router = useRouter();
  const [, start] = useTransition();
  const [state, action] = useActionState(saveStaff.bind(null, slug), null);
  useEffect(() => { if (state?.ok) { setEditing(null); router.refresh(); } }, [state, router]);
  const openEdit = (s: StaffUser | "new") => { setEditing(s); const r = s === "new" ? "cashier" : (s.role as StaffRole); setRole(r); setPerms(s === "new" ? ROLE_PRESETS.cashier : s.permissions); };
  const changeRole = (r: StaffRole) => { setRole(r); if (r !== "custom") setPerms(ROLE_PRESETS[r]); };
  const cur = editing === "new" ? undefined : editing ?? undefined;
  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">{t("staff_title")}</h2><button className="btn-accent" onClick={() => openEdit("new")}>+ {t("add_staff")}</button></div>
      <table className="table">
        <thead><tr><th>{t("name")}</th><th>{t("email")}</th><th>{t("role")}</th><th>{t("permissions")}</th><th>{t("status")}</th><th>{t("last_login")}</th><th></th></tr></thead>
        <tbody>
          {staff.map((s) => (
            <tr key={s.id}>
              <td className="font-medium">{s.name}{s.id === meId && <span className="ms-1 text-xs text-slate-400">(you)</span>}</td>
              <td dir="ltr">{s.email}</td>
              <td><Badge tone={s.role === "owner" ? "violet" : "blue"}>{t(roleKey(s.role))}</Badge></td>
              <td className="max-w-xs"><div className="flex flex-wrap gap-1">{s.role === "owner" ? <Badge tone="green">{t("all")}</Badge> : s.permissions.map((p) => <Badge key={p}>{t(`perm_${p}` as TKey)}</Badge>)}</div></td>
              <td>{s.active ? <Badge tone="green">{t("active")}</Badge> : <Badge tone="rose">{t("inactive")}</Badge>}</td>
              <td>{s.lastLoginAt ? formatDate(s.lastLoginAt, locale, true) : t("never")}</td>
              <td className="whitespace-nowrap text-end"><button className="btn-ghost" onClick={() => openEdit(s)}>{t("edit")}</button>{s.role !== "owner" && s.id !== meId && <button className="btn-ghost text-rose-600" onClick={() => start(async () => { await deleteStaff(slug, s.id); router.refresh(); })}>{t("delete")}</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={cur ? t("edit") : t("add_staff")}>
        <form action={action} className="space-y-3">
          {state && !state.ok && <Alert messageKey={state.error} />}
          <input type="hidden" name="id" value={cur?.id ?? ""} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("name")}><input name="name" className="input" defaultValue={cur?.name} required /></Field>
            <Field label={t("email")}><input name="email" type="email" className="input" dir="ltr" defaultValue={cur?.email} required /></Field>
            <Field label={cur ? t("new_password") : t("password")}><input name="password" type="password" className="input" dir="ltr" minLength={8} required={!cur} /></Field>
            <Field label={t("staff_role")}>
              <select name="role" className="input" value={role} onChange={(e) => changeRole(e.target.value as StaffRole)} disabled={cur?.role === "owner"}>
                {STAFF_ROLES.filter((r) => r !== "owner").map((r) => <option key={r} value={r}>{t(roleKey(r))}</option>)}
                {cur?.role === "owner" && <option value="owner">{t("role_owner")}</option>}
              </select>
            </Field>
          </div>
          {cur?.role !== "owner" && (
            <div>
              <span className="label">{t("permissions")}</span>
              <div className="grid gap-2 sm:grid-cols-2">{PERMISSIONS.map((p) => <Toggle key={p} name={`perm_${p}`} label={t(`perm_${p}` as TKey)} checked={perms.includes(p)} onChange={(v) => { setPerms((x) => (v ? [...x, p] : x.filter((y) => y !== p))); setRole("custom"); }} />)}</div>
            </div>
          )}
          {cur && cur.role !== "owner" && <Toggle name="active" label={t("active")} defaultChecked={cur.active} />}
          <SubmitButton>{t("save")}</SubmitButton>
        </form>
      </Modal>
    </div>
  );
}

export function TablesManager({ slug, tables, qrs, storeUrl, dineInEnabled }: { slug: string; tables: DiningTable[]; qrs: Record<number, string>; storeUrl: string; dineInEnabled: boolean }) {
  const { t } = useT();
  const [editing, setEditing] = useState<DiningTable | "new" | null>(null);
  const router = useRouter();
  const [, start] = useTransition();
  const [state, action] = useActionState(saveTable.bind(null, slug), null);
  useEffect(() => { if (state?.ok) { setEditing(null); router.refresh(); } }, [state, router]);
  const cur = editing === "new" ? undefined : editing ?? undefined;
  const link = (code: string) => `${storeUrl}/t/${code}`;
  return (
    <div className="space-y-4">
      {!dineInEnabled && <Alert kind="info" messageKey="dine_in_disabled_hint" />}
      <div className="flex items-center justify-between"><h1 className="text-2xl font-extrabold">{t("tables_title")}</h1><button className="btn-accent" onClick={() => setEditing("new")}>+ {t("add_table")}</button></div>
      {tables.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tables.map((tb) => (
            <div key={tb.id} className="card text-center">
              <div className="flex items-center justify-between"><h3 className="font-bold">{tb.name}</h3><Badge tone={tb.active ? "green" : "slate"}>{tb.seats} 🪑</Badge></div>
              <img src={qrs[tb.id]} alt={tb.name} className="mx-auto mt-3 h-40 w-40" />
              <div className="mt-2 truncate text-[10px] text-slate-400" dir="ltr">{link(tb.code)}</div>
              <div className="mt-3 flex flex-wrap justify-center gap-1">
                <a href={qrs[tb.id]} download={`table-${tb.name}.png`} className="btn-primary !px-2 !py-1 text-xs">{t("download_qr")}</a>
                <button className="btn-outline !px-2 !py-1 text-xs" onClick={() => navigator.clipboard.writeText(link(tb.code))}>{t("copy")}</button>
                <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setEditing(tb)}>{t("edit")}</button>
                <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => start(async () => { await regenerateTableCode(slug, tb.id); router.refresh(); })}>{t("regenerate")}</button>
                <button className="btn-ghost !px-2 !py-1 text-xs text-rose-600" onClick={() => start(async () => { await deleteTable(slug, tb.id); router.refresh(); })}>{t("delete")}</button>
              </div>
            </div>
          ))}
        </div>
      ) : <EmptyState title={t("no_tables")} />}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={cur ? t("edit") : t("add_table")}>
        <form action={action} className="space-y-3">
          {state && !state.ok && <Alert messageKey={state.error} />}
          <input type="hidden" name="id" value={cur?.id ?? ""} />
          <Field label={t("table_name")}><input name="name" className="input" defaultValue={cur?.name} required /></Field>
          <Field label={t("seats")}><input name="seats" type="number" min={1} className="input" defaultValue={cur?.seats ?? 4} /></Field>
          {cur && <Toggle name="active" label={t("active")} defaultChecked={cur.active} />}
          <SubmitButton>{t("save")}</SubmitButton>
        </form>
      </Modal>
    </div>
  );
}
