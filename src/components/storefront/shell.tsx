import Link from "next/link";
import type { ReactNode } from "react";
import type { Tenant } from "@/db/schema";
import type { TemplateConfig } from "@/lib/templates";
import { getT } from "@/lib/server-i18n";
import { pick } from "@/lib/i18n";
import { isStoreOpen } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/locale-provider";
import { CartButton, SearchBox, TableBanner } from "./widgets";

export async function StoreShell({ tenant, tpl, base, vars, customer, children }: { tenant: Tenant; tpl: TemplateConfig; base: string; vars: Record<string, string>; customer: string | null; children: ReactNode }) {
  const { t, locale } = await getT();
  const name = pick(locale, tenant.name, tenant.nameAr);
  const open = isStoreOpen(tenant.businessHours);
  const brand = (
    <Link href={base || "/"} className="flex items-center gap-2">
      {tenant.logoUrl ? <img src={tenant.logoUrl} alt={name} className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--sf-primary)] text-lg font-extrabold text-[var(--sf-primary-fg)]">{name.slice(0, 1)}</span>}
      <span className="text-lg font-extrabold tracking-tight">{name}</span>
    </Link>
  );
  const actions = (
    <div className="flex items-center gap-2">
      <span className={`hidden rounded-full px-2 py-0.5 text-[11px] font-semibold md:inline ${open ? "bg-emerald-500/15 text-emerald-600" : "bg-rose-500/15 text-rose-500"}`}>{open ? t("open_now") : t("store_closed")}</span>
      <LanguageSwitcher className="!bg-transparent !text-inherit !border-[var(--sf-border)]" />
      <Link href={`${base}/account`} className="sf-btn-outline !px-3 !py-2 text-sm">{customer ? customer.split(" ")[0] : t("my_account")}</Link>
      <CartButton />
    </div>
  );
  const navLinks = (
    <nav className="flex items-center gap-5 text-sm font-medium sf-muted">
      <Link href={base || "/"} className="hover:sf-primary">{t(tpl.sectionTitleKey)}</Link>
      <a href={`${base}#products`} className="hover:sf-primary">{t("categories_sf")}</a>
      <a href={`${base}#contact`} className="hover:sf-primary">{t("contact_us")}</a>
    </nav>
  );

  let header: ReactNode;
  switch (tpl.header) {
    case "centered":
      header = (
        <header className="border-b border-[var(--sf-border)]">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-4">
            <div className="flex w-full items-center justify-between md:justify-center">{brand}<div className="md:hidden"><CartButton /></div></div>
            <div className="flex w-full flex-wrap items-center justify-between gap-3">{navLinks}<div className="hidden md:block">{actions}</div></div>
          </div>
        </header>
      );
      break;
    case "minimal":
    case "transparent":
      header = (
        <header>
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5">{brand}{actions}</div>
        </header>
      );
      break;
    case "bar":
      header = (
        <header className="bg-[var(--sf-primary)] text-[var(--sf-primary-fg)]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            {brand}
            <div className="order-3 w-full md:order-none md:w-auto"><SearchBox /></div>
            <div className="flex items-center gap-2 [&_.sf-btn]:!bg-[var(--sf-bg)] [&_.sf-btn]:!text-[var(--sf-text)] [&_.sf-btn-outline]:!border-current [&_.sf-btn-outline]:!text-inherit">{actions}</div>
          </div>
        </header>
      );
      break;
    default:
      header = (
        <header className="sticky top-0 z-30 border-b border-[var(--sf-border)] bg-[var(--sf-bg)]/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            {brand}
            <div className="hidden md:block">{navLinks}</div>
            <div className="hidden md:block"><SearchBox /></div>
            {actions}
          </div>
        </header>
      );
  }

  return (
    <div className={`sf ${tpl.decor !== "none" ? `sf-decor-${tpl.decor}` : ""}`} style={vars as React.CSSProperties}>
      <TableBanner />
      {header}
      <main>{children}</main>
      <footer id="contact" className="mt-16 border-t border-[var(--sf-border)]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-3">
          <div>
            {brand}
            <p className="mt-3 text-sm sf-muted">{pick(locale, tenant.description, tenant.descriptionAr)}</p>
          </div>
          <div>
            <h4 className="mb-2 font-bold">{t("contact_us")}</h4>
            <ul className="space-y-1 text-sm sf-muted">
              {tenant.phone && <li dir="ltr">📞 {tenant.phone}</li>}
              {tenant.whatsapp && <li><a href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">💬 WhatsApp</a></li>}
              {tenant.email && <li dir="ltr">✉️ {tenant.email}</li>}
              {tenant.address && <li>📍 {tenant.address}</li>}
            </ul>
          </div>
          <div>
            <h4 className="mb-2 font-bold">{t("hours")}</h4>
            <ul className="space-y-0.5 text-xs sf-muted">
              {tenant.businessHours.map((h) => (
                <li key={h.day} className="flex justify-between gap-4"><span>{t(`day_${h.day}` as "day_0")}</span><span dir="ltr">{h.closed ? t("closed") : `${h.open} – ${h.close}`}</span></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-[var(--sf-border)] py-4 text-center text-xs sf-muted">
          © {new Date().getFullYear()} {name} · {t("powered_by")} <a href="/" className="font-semibold sf-primary">Tajer تاجر</a>
        </div>
      </footer>
    </div>
  );
}
