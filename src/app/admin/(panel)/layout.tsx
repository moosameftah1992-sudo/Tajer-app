import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdminPage } from "@/lib/tenant";
import { getT } from "@/lib/server-i18n";
import { adminHas } from "@/lib/permissions";
import { Logo } from "@/components/ui";
import { LanguageSwitcher } from "@/components/locale-provider";
import { LogoutButton } from "@/components/admin/forms";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdminPage();
  const { t } = await getT();
  const nav = [
    { href: "/admin", label: t("admin_dashboard"), icon: "📊", show: true },
    { href: "/admin/merchants", label: t("admin_merchants"), icon: "🏪", show: adminHas(admin.permissions, admin.role, "merchants") },
    { href: "/admin/plans", label: t("admin_plans"), icon: "💎", show: adminHas(admin.permissions, admin.role, "plans") },
    { href: "/admin/invoices", label: t("admin_invoices"), icon: "🧾", show: adminHas(admin.permissions, admin.role, "billing") },
    { href: "/admin/logistics", label: t("admin_logistics"), icon: "🚚", show: adminHas(admin.permissions, admin.role, "logistics") },
    { href: "/admin/admins", label: t("admin_admins"), icon: "🛡️", show: adminHas(admin.permissions, admin.role, "admins") },
    { href: "/admin/settings", label: t("admin_settings"), icon: "⚙️", show: adminHas(admin.permissions, admin.role, "settings") },
  ].filter((n) => n.show);
  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <aside className="hidden w-64 shrink-0 flex-col border-e border-slate-200 bg-white p-4 md:flex">
        <Link href="/admin" className="mb-6 block"><Logo /></Link>
        <div className="mb-4 rounded-xl bg-slate-900 p-3 text-white">
          <div className="text-xs text-slate-400">{t("admin_login_title")}</div>
          <div className="truncate text-sm font-semibold">{admin.name}</div>
        </div>
        <nav className="flex-1 space-y-1">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              <span>{n.icon}</span>{n.label}
            </Link>
          ))}
        </nav>
        <LogoutButton />
      </aside>
      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-8">
          <div className="flex gap-2 overflow-x-auto md:hidden">
            {nav.map((n) => <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium">{n.label}</Link>)}
          </div>
          <div className="ms-auto flex items-center gap-2"><Link href="/" className="btn-ghost text-sm">{t("website")}</Link><LanguageSwitcher /></div>
        </header>
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
