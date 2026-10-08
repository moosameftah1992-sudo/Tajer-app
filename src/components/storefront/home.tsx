import Link from "next/link";
import type { Tenant, Product, Category } from "@/db/schema";
import type { TemplateConfig } from "@/lib/templates";
import { getT } from "@/lib/server-i18n";
import { pick, type Locale } from "@/lib/i18n";
import { formatMoney } from "@/lib/utils";
import { AddToCart } from "./widgets";

type Props = { tenant: Tenant; tpl: TemplateConfig; base: string; products: Product[]; categories: Category[]; activeCategory: number | null; query: string };

export function ProductCard({ p, tpl, base, currency, locale }: { p: Product; tpl: TemplateConfig; base: string; currency: string; locale: Locale }) {
  const name = pick(locale, p.name, p.nameAr);
  const price = formatMoney(Number(p.price), currency, locale);
  const compare = p.compareAtPrice && Number(p.compareAtPrice) > Number(p.price) ? formatMoney(Number(p.compareAtPrice), currency, locale) : null;
  const href = `${base}/product/${p.id}`;
  const img = p.imageUrl ? <img src={p.imageUrl} alt={name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" /> : <div className="flex h-full w-full items-center justify-center text-4xl opacity-30">🛍️</div>;
  const meta = (p.purity || p.weight) && (
    <div className="mt-1 text-xs sf-muted">{p.purity && <span>{p.purity}</span>}{p.purity && p.weight && " · "}{p.weight && <span dir="ltr">{Number(p.weight)} {p.weightUnit}</span>}</div>
  );

  switch (tpl.card) {
    case "overlay":
      return (
        <div className="group relative aspect-[4/5] overflow-hidden sf-radius bg-[var(--sf-surface)]">
          <Link href={href} className="absolute inset-0">{img}</Link>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-12 text-white">
            <div className="font-bold leading-tight">{name}</div>
            <div className="text-sm opacity-90">{price} {compare && <s className="opacity-60">{compare}</s>}</div>
          </div>
          <div className="absolute bottom-3 end-3"><AddToCart product={p} compact /></div>
        </div>
      );
    case "minimal":
      return (
        <div className="group">
          <Link href={href} className="block aspect-[4/5] overflow-hidden sf-radius bg-[var(--sf-surface)]">{img}</Link>
          <div className="mt-3 flex items-start justify-between gap-2">
            <div><Link href={href} className="font-medium hover:underline">{name}</Link>{meta}<div className="text-sm sf-muted">{price} {compare && <s className="opacity-60">{compare}</s>}</div></div>
            <AddToCart product={p} compact />
          </div>
        </div>
      );
    case "bordered":
      return (
        <div className="group flex flex-col sf-surface p-3 transition hover:shadow-md">
          <Link href={href} className="block aspect-square overflow-hidden sf-radius bg-[var(--sf-bg)]">{img}</Link>
          <Link href={href} className="mt-3 line-clamp-2 text-sm font-semibold">{name}</Link>
          {meta}
          <div className="mt-auto flex items-center justify-between pt-3">
            <div><div className="font-bold sf-primary">{price}</div>{compare && <s className="text-xs sf-muted">{compare}</s>}</div>
            <AddToCart product={p} compact />
          </div>
        </div>
      );
    case "horizontal":
      return (
        <div className="group flex gap-4 sf-surface p-3">
          <Link href={href} className="block h-28 w-28 shrink-0 overflow-hidden sf-radius bg-[var(--sf-bg)]">{img}</Link>
          <div className="flex min-w-0 flex-1 flex-col">
            <Link href={href} className="font-bold">{name}</Link>
            <p className="mt-1 line-clamp-2 text-sm sf-muted">{pick(locale, p.description, p.descriptionAr)}</p>
            <div className="mt-auto flex items-center justify-between pt-2">
              <span className="font-bold sf-primary">{price}</span>
              <AddToCart product={p} compact />
            </div>
          </div>
        </div>
      );
    case "luxury":
      return (
        <div className="group text-center">
          <Link href={href} className="block aspect-[3/4] overflow-hidden bg-[var(--sf-surface)]">{img}</Link>
          <div className="mt-4"><Link href={href} className="text-lg font-semibold tracking-wide hover:underline">{name}</Link>{meta}<div className="mt-1 sf-primary">{price} {compare && <s className="text-xs sf-muted">{compare}</s>}</div></div>
          <div className="mt-3 opacity-80 transition group-hover:opacity-100"><AddToCart product={p} /></div>
        </div>
      );
    case "tile":
      return (
        <div className="group flex flex-col sf-surface p-2">
          <Link href={href} className="block aspect-square overflow-hidden sf-radius bg-[var(--sf-bg)]">{img}</Link>
          <div className="mt-2 text-lg font-extrabold sf-primary">{price}</div>
          {compare && <s className="text-xs sf-muted">{compare}</s>}
          <Link href={href} className="line-clamp-2 text-xs">{name}</Link>
          <div className="mt-2"><AddToCart product={p} compact /></div>
        </div>
      );
    default:
      return (
        <div className="group flex flex-col overflow-hidden sf-surface transition hover:shadow-lg">
          <Link href={href} className="block aspect-square overflow-hidden bg-[var(--sf-bg)]">{img}</Link>
          <div className="flex flex-1 flex-col p-4">
            <Link href={href} className="font-semibold">{name}</Link>
            {meta}
            <div className="mt-2 flex items-center gap-2"><span className="font-bold sf-primary">{price}</span>{compare && <s className="text-xs sf-muted">{compare}</s>}</div>
            <div className="mt-3"><AddToCart product={p} compact /></div>
          </div>
        </div>
      );
  }
}

export async function StoreHome({ tenant, tpl, base, products, categories, activeCategory, query }: Props) {
  const { t, locale } = await getT();
  const name = pick(locale, tenant.name, tenant.nameAr);
  const heroTitle = pick(locale, tenant.heroTitle, tenant.heroTitleAr) || name;
  const heroSub = pick(locale, tenant.heroSubtitle, tenant.heroSubtitleAr) || pick(locale, tenant.description, tenant.descriptionAr);
  const featured = products.filter((p) => p.featured).slice(0, 8);
  const gridCols = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "grid-cols-2 lg:grid-cols-4" }[tpl.grid];
  const heroImg = tenant.heroUrl;
  const cta = <a href="#products" className="sf-btn">{t("shop_now")}</a>;

  let hero: React.ReactNode = null;
  switch (tpl.hero) {
    case "none":
      break;
    case "minimal":
      hero = <section className="mx-auto max-w-7xl px-4 pt-10"><h1 className="text-3xl font-extrabold md:text-4xl">{heroTitle}</h1>{heroSub && <p className="mt-2 max-w-2xl sf-muted">{heroSub}</p>}</section>;
      break;
    case "fullbleed":
      hero = (
        <section className="relative flex min-h-[380px] items-center justify-center overflow-hidden bg-[var(--sf-secondary)] text-center text-white md:min-h-[480px]">
          {heroImg && <img src={heroImg} alt="" className="absolute inset-0 h-full w-full object-cover" />}
          <div className="absolute inset-0 bg-black/45" />
          <div className="relative mx-auto max-w-3xl px-4"><h1 className="text-4xl font-extrabold md:text-6xl">{heroTitle}</h1>{heroSub && <p className="mt-4 text-lg opacity-90">{heroSub}</p>}<div className="mt-8">{cta}</div></div>
        </section>
      );
      break;
    case "centered":
      hero = (
        <section className="mx-auto max-w-4xl px-4 py-16 text-center"><span className="sf-chip">{t(tpl.sectionTitleKey)}</span><h1 className="mt-4 text-4xl font-extrabold md:text-6xl">{heroTitle}</h1>{heroSub && <p className="mx-auto mt-4 max-w-2xl text-lg sf-muted">{heroSub}</p>}<div className="mt-8">{cta}</div>{heroImg && <img src={heroImg} alt="" className="mx-auto mt-10 max-h-80 w-full object-cover sf-radius" />}</section>
      );
      break;
    case "card":
      hero = (
        <section className="mx-auto max-w-7xl px-4 pt-6">
          <div className="relative overflow-hidden sf-radius bg-[var(--sf-primary)] px-8 py-14 text-[var(--sf-primary-fg)] md:px-14">
            {heroImg && <img src={heroImg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />}
            <div className="relative max-w-xl"><h1 className="text-3xl font-extrabold md:text-5xl">{heroTitle}</h1>{heroSub && <p className="mt-3 text-lg opacity-90">{heroSub}</p>}<a href="#products" className="mt-6 inline-block rounded-full bg-[var(--sf-bg)] px-5 py-2.5 font-semibold text-[var(--sf-text)]">{t("shop_now")}</a></div>
          </div>
        </section>
      );
      break;
    case "mosaic":
      hero = (
        <section className="mx-auto max-w-7xl px-4 pt-6">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="flex flex-col justify-end sf-surface p-8 md:row-span-2"><h1 className="text-4xl font-extrabold md:text-5xl">{heroTitle}</h1>{heroSub && <p className="mt-3 sf-muted">{heroSub}</p>}<div className="mt-6">{cta}</div></div>
            {(featured.length ? featured : products).slice(0, 4).map((p) => (
              <Link key={p.id} href={`${base}/product/${p.id}`} className="relative aspect-[4/3] overflow-hidden sf-radius bg-[var(--sf-surface)]">
                {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-full w-full object-cover" /> : heroImg ? <img src={heroImg} alt="" className="h-full w-full object-cover" /> : null}
                <span className="absolute bottom-2 start-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">{pick(locale, p.name, p.nameAr)}</span>
              </Link>
            ))}
          </div>
        </section>
      );
      break;
    default:
      hero = (
        <section className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-10 md:grid-cols-2 md:py-16">
          <div><span className="sf-chip">{t(tpl.sectionTitleKey)}</span><h1 className="mt-4 text-4xl font-extrabold md:text-5xl">{heroTitle}</h1>{heroSub && <p className="mt-4 text-lg sf-muted">{heroSub}</p>}<div className="mt-8">{cta}</div></div>
          <div className="aspect-[4/3] overflow-hidden sf-radius bg-[var(--sf-primary-soft)]">{heroImg ? <img src={heroImg} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full grid-cols-2 gap-2 p-4">{products.slice(0, 4).map((p) => <div key={p.id} className="overflow-hidden sf-radius bg-[var(--sf-surface)]">{p.imageUrl && <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />}</div>)}</div>}</div>
        </section>
      );
  }

  const catLink = (id: number | null) => `${base}?${new URLSearchParams({ ...(id ? { c: String(id) } : {}), ...(query ? { q: query } : {}) }).toString()}#products`;
  const catItems = [{ id: null as number | null, label: t("all"), imageUrl: "" }, ...categories.map((c) => ({ id: c.id as number | null, label: pick(locale, c.name, c.nameAr), imageUrl: c.imageUrl }))];
  let catNav: React.ReactNode;
  switch (tpl.categoryNav) {
    case "tabs":
      catNav = <div className="mb-6 flex gap-6 overflow-x-auto border-b border-[var(--sf-border)] no-scrollbar">{catItems.map((c) => <Link key={String(c.id)} href={catLink(c.id)} className={`whitespace-nowrap border-b-2 pb-2 text-sm font-semibold ${activeCategory === c.id ? "border-[var(--sf-primary)] sf-primary" : "border-transparent sf-muted"}`}>{c.label}</Link>)}</div>;
      break;
    case "grid":
      catNav = <div className="mb-8 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">{catItems.map((c) => <Link key={String(c.id)} href={catLink(c.id)} className={`flex flex-col items-center gap-2 sf-surface p-3 text-center text-xs font-semibold ${activeCategory === c.id ? "ring-2 ring-[var(--sf-primary)]" : ""}`}><span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[var(--sf-primary-soft)]">{c.imageUrl ? <img src={c.imageUrl} alt="" className="h-full w-full object-cover" /> : "🏷️"}</span>{c.label}</Link>)}</div>;
      break;
    case "scroll":
      catNav = <div className="mb-8 flex gap-4 overflow-x-auto pb-2 no-scrollbar">{catItems.map((c) => <Link key={String(c.id)} href={catLink(c.id)} className="flex shrink-0 flex-col items-center gap-1 text-xs font-semibold"><span className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 bg-[var(--sf-surface)] ${activeCategory === c.id ? "border-[var(--sf-primary)]" : "border-transparent"}`}>{c.imageUrl ? <img src={c.imageUrl} alt="" className="h-full w-full object-cover" /> : "🏷️"}</span>{c.label}</Link>)}</div>;
      break;
    default:
      catNav = <div className="mb-6 flex flex-wrap gap-2">{catItems.map((c) => <Link key={String(c.id)} href={catLink(c.id)} className={`sf-chip ${activeCategory === c.id ? "active" : ""}`}>{c.label}</Link>)}</div>;
  }

  const grid = products.length ? (
    <div className={`grid gap-4 ${gridCols}`}>{products.map((p) => <ProductCard key={p.id} p={p} tpl={tpl} base={base} currency={tenant.currency} locale={locale} />)}</div>
  ) : (
    <p className="py-16 text-center sf-muted">{t("no_results")}</p>
  );

  return (
    <>
      {hero}
      {featured.length > 0 && !activeCategory && !query && tpl.hero !== "mosaic" && (
        <section className="mx-auto max-w-7xl px-4 pt-12">
          <h2 className="mb-5 text-2xl font-extrabold">{t("featured_products")}</h2>
          <div className={`grid gap-4 ${gridCols}`}>{featured.slice(0, tpl.grid * 2).map((p) => <ProductCard key={p.id} p={p} tpl={tpl} base={base} currency={tenant.currency} locale={locale} />)}</div>
        </section>
      )}
      <section id="products" className="mx-auto max-w-7xl px-4 pt-12">
        <div className="mb-5 flex items-center justify-between"><h2 className="text-2xl font-extrabold">{query ? `${t("search")}: ${query}` : t(tpl.sectionTitleKey)}</h2><span className="text-sm sf-muted">{products.length} {t("products")}</span></div>
        {tpl.categoryNav === "sidebar" ? (
          <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
            <aside className="lg:sticky lg:top-24 lg:self-start"><div className="lg:hidden">{catNav}</div><ul className="hidden space-y-1 sf-surface p-2 lg:block">{catItems.map((c) => <li key={String(c.id)}><Link href={catLink(c.id)} className={`block rounded-md px-3 py-2 text-sm font-medium ${activeCategory === c.id ? "bg-[var(--sf-primary)] text-[var(--sf-primary-fg)]" : "hover:bg-[var(--sf-primary-soft)]"}`}>{c.label}</Link></li>)}</ul></aside>
            <div>{grid}</div>
          </div>
        ) : (
          <>{catNav}{grid}</>
        )}
      </section>
    </>
  );
}
