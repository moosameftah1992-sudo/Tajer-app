import Link from "next/link";
import { getT } from "@/lib/server-i18n";
import { getActivePlans } from "@/lib/tenant";
import { TEMPLATES } from "@/lib/templates";
import { formatMoney } from "@/lib/utils";
import { Logo } from "@/components/ui";
import { LanguageSwitcher } from "@/components/locale-provider";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const { t, locale } = await getT();
  const plans = await getActivePlans();
  const features = [1, 2, 3, 4, 5, 6].map((i) => ({
    title: t(`feature_${i}_title` as "feature_1_title"),
    desc: t(`feature_${i}_desc` as "feature_1_desc"),
    icon: ["🌐", "🧾", "📊", "💳", "🚚", "👥"][i - 1],
  }));

  return (
    <div className="relative min-h-screen bg-white text-[#0F172A]">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" aria-label="Tajer">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="hover:text-slate-900">{t("nav_features")}</a>
            <a href="#templates" className="hover:text-slate-900">{t("nav_templates")}</a>
            <a href="#pricing" className="hover:text-slate-900">{t("nav_pricing")}</a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitcher className="hidden sm:inline-flex" />
            <Link href="/login" className="btn-outline">{t("cta_merchant_login")}</Link>
            <Link href="/register" className="btn-accent">{t("cta_create_store")}</Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_80%_0%,rgba(16,185,129,0.15),transparent_70%)]" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="badge bg-emerald-50 text-emerald-700">{t("hero_badge")}</span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">{t("hero_title")}</h1>
            <p className="mt-5 max-w-xl text-lg text-slate-600">{t("hero_subtitle")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="btn-accent px-6 py-3 text-base">{t("hero_cta")}</Link>
              <a href="#templates" className="btn-outline px-6 py-3 text-base">{t("hero_secondary")}</a>
            </div>
            <dl className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
              {[["20+", t("stat_templates")], ["8", t("stat_currencies")], ["100%", t("stat_uptime")], ["5", t("stat_setup")]].map(([v, l]) => (
                <div key={l}>
                  <dt className="text-2xl font-extrabold text-slate-900">{v}</dt>
                  <dd className="text-xs text-slate-500">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative">
            <div className="rounded-3xl border border-slate-200 bg-[#F8FAFC] p-4 shadow-2xl">
              <div className="rounded-2xl bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="h-3 w-24 rounded bg-slate-200" />
                  <div className="flex gap-1">{["#10B981", "#0F172A", "#CBD5E1"].map((c) => <span key={c} className="h-3 w-3 rounded-full" style={{ background: c }} />)}</div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {[t("revenue_today"), t("orders_today"), t("products_count")].map((l, i) => (
                    <div key={l} className="rounded-xl border border-slate-100 p-3">
                      <div className="text-[10px] text-slate-400">{l}</div>
                      <div className="mt-1 text-lg font-bold">{["1,240", "86", "412"][i]}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex h-28 items-end gap-1.5">
                  {[30, 45, 38, 60, 52, 75, 68, 90, 72, 85, 95, 80].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t bg-emerald-500/90" style={{ height: `${h}%` }} />
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="rounded-lg border border-slate-100 p-2">
                      <div className="aspect-square rounded bg-slate-100" />
                      <div className="mt-1 h-2 w-3/4 rounded bg-slate-200" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute -bottom-4 -start-4 rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-xl">
              <div className="text-[10px] uppercase tracking-wide text-emerald-300">{t("pos_title")}</div>
              <div className="text-sm font-bold">{formatMoney(48.5, "BHD", locale)}</div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="bg-[#F8FAFC] py-20">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-center text-3xl font-extrabold">{t("features_title")}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">{t("features_subtitle")}</p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="card transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-2xl">{f.icon}</div>
                <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="templates" className="py-20">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-center text-3xl font-extrabold">{t("templates_title")}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">{t("templates_subtitle")}</p>
          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {TEMPLATES.slice(0, 20).map((tpl) => (
              <div key={tpl.id} className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                <div className="p-3" style={{ background: tpl.palette.background }}>
                  <div className="flex items-center justify-between">
                    <span className="h-2 w-10 rounded" style={{ background: tpl.palette.text, opacity: 0.8 }} />
                    <span className="h-2 w-4 rounded" style={{ background: tpl.palette.primary }} />
                  </div>
                  <div className="mt-2 h-10 rounded" style={{ background: tpl.palette.primary, opacity: 0.85, borderRadius: tpl.radius === "none" ? 0 : 8 }} />
                  <div className="mt-2 grid grid-cols-3 gap-1">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="rounded" style={{ background: tpl.palette.surface, border: `1px solid ${tpl.palette.muted}33`, height: 22 }} />
                    ))}
                  </div>
                </div>
                <div className="bg-white px-3 py-2">
                  <div className="text-xs font-bold text-slate-900">{locale === "ar" ? tpl.nameAr : tpl.name}</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">{tpl.category}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-900 py-20 text-white">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-center text-3xl font-extrabold">{t("how_title")}</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[t("how_1"), t("how_2"), t("how_3")].map((s, i) => (
              <div key={s} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-lg font-extrabold">{i + 1}</div>
                <p className="mt-4 text-lg font-medium">{s}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="bg-[#F8FAFC] py-20">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-center text-3xl font-extrabold">{t("pricing_title")}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">{t("pricing_subtitle")}</p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {plans.map((p, i) => (
              <div key={p.id} className={`card flex flex-col ${i === 1 ? "border-emerald-400 ring-2 ring-emerald-100" : ""}`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">{locale === "ar" ? p.nameAr : p.name}</h3>
                  <span className="badge bg-emerald-50 text-emerald-700">{t("trial_badge")}</span>
                </div>
                <div className="mt-4 text-3xl font-extrabold">
                  {formatMoney(p.monthlyPrice, p.currency, locale)} <span className="text-sm font-medium text-slate-500">{t("per_month")}</span>
                </div>
                <div className="text-sm text-slate-500">
                  {formatMoney(p.yearlyPrice, p.currency, locale)} {t("per_year")}
                </div>
                <ul className="mt-6 flex-1 space-y-2 text-sm text-slate-600">
                  {(locale === "ar" ? p.featuresAr : p.features).map((f) => (
                    <li key={f} className="flex gap-2"><span className="text-emerald-500">✓</span>{f}</li>
                  ))}
                </ul>
                <Link href="/register" className={`${i === 1 ? "btn-accent" : "btn-primary"} mt-6 w-full`}>{t("start_trial")}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="relative bg-[#F8FAFC] pb-10 pt-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 border-t border-slate-200 px-4 pt-6 text-sm text-slate-500 md:flex-row">
          <Logo size={28} />
          <p>© {new Date().getFullYear()} Tajer · {t("footer_rights")} {t("footer_tagline")}</p>
          <LanguageSwitcher />
        </div>
        <a
          href="/admin/login"
          aria-label="System administration"
          className="absolute bottom-2 block h-4 w-4"
          style={{ left: 8, borderRadius: "50%", backgroundColor: "#F8FAFC" }}
        />
      </footer>
    </div>
  );
}
