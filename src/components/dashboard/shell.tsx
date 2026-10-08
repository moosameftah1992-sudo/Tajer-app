import Link from "next/link";
import type { ReactNode } from "react";
import type { Tenant, StaffUser } from "@/db/schema";
import { getT } from "@/lib/server-i18n";
import { pick, type TKey } from "@/lib/i18n";
import { hasPermission, type Permission } from "@/lib/permissions";
import { Logo } from "@/components/ui";
import { LanguageSwitcher } from "@/components/locale-provider";
import { StaffLogoutButton } from "./forms";

export async function DashboardShell({ tenant, staff, base, sub, children }: { tenant: Tenant; staff: StaffUser; base: string; sub: { isTrial: boolean; daysLeft: number; active: boolean }; children: ReactNode }) {
  const { t, locale } = await getT();
  const d = `${base}/dashboard`;
  const navAll: { href: string; label: string; icon: string; perm: Permission | null }[] = [
    { href: d, label: t("nav_home"), icon: "📊", perm: "dashboard" },
    { href: `${d}/orders`, label: t("nav_orders"), icon: "🧾", perm: "orders" },
    { href: `${d}/pos`, label: t("nav_pos"), icon: "🖥️", perm: "pos" },
    { href: `${d}/catalog`, label: t("nav_catalog"), icon: "🛍️", perm: "catalog" },
    { href: `${d}/media`, label: t("nav_media"), icon: "🖼️", perm: "media" },
    { href: `${d}/customers`, label: t("nav_customers"), icon: "👤", perm: "customers" },
    { href: `${d}/reports`, label: t("nav_reports"), icon: "📈", perm: "reports" },
    { href: `${d}/tables`, label: t("nav_tables"), icon: "🍽️", perm: "tables" },
    { href: `${d}/staff`, label: t("nav_staff"), icon: "👥", perm: "staff" },
    { href: `${d}/settings`, label: t("nav_settings"), icon: "⚙️", perm: "settings" },
    { href: `${d}/subscription`, label: t("nav_subscription"), icon: "💳", perm: null },
  ];
  const nav = navAll.filter((n) => n.perm === null || hasPermission(staff.permissions, staff.role, n.perm));
  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <aside className="hidden w-64 shrink-0 flex-col border-e border-slate-200 bg-white p-4 md:flex">
        <Link href={d} className="mb-5 block"><Logo /></Link>
        <div className="mb-4 rounded-xl bg-slate-900 p-3 text-white">
          <div className="truncate text-sm font-bold">{pick(locale, tenant.name, tenant.nameAr)}</div>
          <div className="truncate text-xs text-slate-400">{staff.name} · {t(`role_${staff.role === "manager" ? "manager_s" : staff.role}` as TKey)}</div>
          <div className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${sub.daysLeft <= 5 ? "bg-amber-400 text-slate-900" : "bg-emerald-500/20 text-emerald-300"}`}>{sub.isTrial ? t("trial_active") : t("subscription_active")} · {t("days_left", { n: sub.daysLeft })}</div>
        </div>
        <nav className="flex-1 space-y-0.5">
          {nav.map((n) => <Link key={n.href} href={n.href} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"><span>{n.icon}</span>{n.label}</Link>)}
        </nav>
        <Link href={base || "/"} target="_blank" className="btn-outline mb-2 w-full">{t("nav_storefront")} ↗</Link>
        <StaffLogoutButton slug={tenant.slug} />
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-8">
          <div className="flex gap-2 overflow-x-auto no-scrollbar md:hidden">{nav.map((n) => <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium">{n.icon} {n.label}</Link>)}</div>
          <div className="ms-auto flex items-center gap-2"><LanguageSwitcher /></div>
        </header>
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
