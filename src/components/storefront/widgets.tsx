"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "./store-provider";
import { useT } from "@/components/locale-provider";
import { formatMoney } from "@/lib/utils";
import type { Product } from "@/db/schema";

export function CartButton() {
  const { base, count } = useStore();
  const { t } = useT();
  return (
    <Link href={`${base}/cart`} className="sf-btn relative !px-3 !py-2" aria-label={t("cart")}>
      <span aria-hidden>🛒</span>
      <span className="hidden sm:inline">{t("cart")}</span>
      {count > 0 && <span className="absolute -top-2 -end-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white">{count}</span>}
    </Link>
  );
}

export function SearchBox({ initial = "" }: { initial?: string }) {
  const { base } = useStore();
  const { t } = useT();
  const router = useRouter();
  const [q, setQ] = useState(initial);
  return (
    <form onSubmit={(e) => { e.preventDefault(); router.push(`${base}?q=${encodeURIComponent(q)}#products`); }} className="w-full max-w-xs">
      <input value={q} onChange={(e) => setQ(e.target.value)} className="sf-input !py-1.5 text-sm" placeholder={t("search_products")} />
    </form>
  );
}

export function AddToCart({ product, compact = false, options, qty = 1 }: { product: Pick<Product, "id" | "name" | "nameAr" | "price" | "imageUrl" | "variants" | "stock" | "trackStock">; compact?: boolean; options?: Record<string, string>; qty?: number }) {
  const { add, base, currency } = useStore();
  const { t, locale } = useT();
  const router = useRouter();
  const [done, setDone] = useState(false);
  const soldOut = product.trackStock && product.stock <= 0;
  const needsOptions = (product.variants?.length ?? 0) > 0 && !options;
  const handle = () => {
    if (needsOptions) return router.push(`${base}/product/${product.id}`);
    let price = Number(product.price);
    for (const v of product.variants ?? []) {
      const chosen = options?.[v.name];
      const opt = v.options.find((o) => o.label === chosen);
      if (opt) price += Number(opt.priceDelta) || 0;
    }
    add({ productId: product.id, name: product.name, nameAr: product.nameAr, price, options: options ?? {}, image: product.imageUrl }, qty);
    setDone(true);
    setTimeout(() => setDone(false), 1200);
  };
  if (soldOut) return <span className="sf-chip opacity-70">{t("out_of_stock_sf")}</span>;
  return (
    <button type="button" onClick={handle} className={compact ? "sf-btn !h-9 !w-9 !p-0 justify-center text-lg" : "sf-btn"} aria-label={t("add_to_cart")}>
      {compact ? (done ? "✓" : "+") : done ? t("added") : needsOptions ? t("select_variant") : t("add_to_cart")}
      {!compact && !needsOptions && <span className="opacity-80">· {formatMoney(Number(product.price), currency, locale)}</span>}
    </button>
  );
}

export function TableBanner() {
  const { tableCode } = useStore();
  const { t } = useT();
  if (!tableCode) return null;
  return <div className="bg-[var(--sf-primary)] px-4 py-1.5 text-center text-xs font-semibold text-[var(--sf-primary-fg)]">🍽️ {t("you_are_at_table")} · {t("dine_in_notice")}</div>;
}
