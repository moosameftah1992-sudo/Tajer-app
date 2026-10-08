"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCategory, deleteCategory, saveProduct, deleteProduct } from "@/actions/store";
import { useT } from "@/components/locale-provider";
import { Alert, Field, Modal, SubmitButton, Toggle, Badge, EmptyState } from "@/components/ui";
import { MediaPicker } from "./media-library";
import { formatMoney } from "@/lib/utils";
import type { Category, Product, ProductVariant } from "@/db/schema";

export function CategoryManager({ slug, categories }: { slug: string; categories: Category[] }) {
  const { t, locale } = useT();
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [img, setImg] = useState("");
  const router = useRouter();
  const [, start] = useTransition();
  const [state, action] = useActionState(saveCategory.bind(null, slug), null);
  useEffect(() => { if (state?.ok) { setEditing(null); router.refresh(); } }, [state, router]);
  const cat = editing === "new" ? undefined : editing ?? undefined;
  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">{t("categories")}</h2><button className="btn-outline" onClick={() => { setEditing("new"); setImg(""); }}>+ {t("add_category")}</button></div>
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white ps-1 pe-2 py-1 text-sm">
            <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xs">{c.imageUrl ? <img src={c.imageUrl} alt="" className="h-full w-full object-cover" /> : "🏷️"}</span>
            <button onClick={() => { setEditing(c); setImg(c.imageUrl); }} className="font-medium hover:underline">{locale === "ar" ? c.nameAr : c.name}</button>
            {!c.active && <Badge tone="slate">{t("inactive")}</Badge>}
            <button onClick={() => start(async () => { await deleteCategory(slug, c.id); router.refresh(); })} className="text-rose-500" title={t("delete")}>×</button>
          </div>
        ))}
        {!categories.length && <p className="text-sm text-slate-500">{t("no_categories")}</p>}
      </div>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={cat ? t("edit") : t("add_category")}>
        <form action={action} className="space-y-3">
          {state && !state.ok && <Alert messageKey={state.error} />}
          <input type="hidden" name="id" value={cat?.id ?? ""} />
          <input type="hidden" name="imageUrl" value={img} />
          <Field label={t("name")}><input name="name" className="input" defaultValue={cat?.name} required /></Field>
          <Field label={t("name_ar")}><input name="nameAr" className="input" dir="rtl" defaultValue={cat?.nameAr} /></Field>
          <Field label={t("sort_order")}><input name="sort" type="number" className="input" defaultValue={cat?.sort ?? 0} /></Field>
          <Field label={t("category_image")}><MediaPicker slug={slug} value={img} onChange={setImg} /></Field>
          {cat && <Toggle name="active" label={t("active")} defaultChecked={cat.active} />}
          <SubmitButton>{t("save")}</SubmitButton>
        </form>
      </Modal>
    </div>
  );
}

export function ProductTable({ slug, base, products, categories, currency }: { slug: string; base: string; products: Product[]; categories: Category[]; currency: string }) {
  const { t, locale } = useT();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<number | 0>(0);
  const router = useRouter();
  const [, start] = useTransition();
  const list = products.filter((p) => (!cat || p.categoryId === cat) && (!q || `${p.name} ${p.nameAr} ${p.sku} ${p.barcode}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="card">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="me-auto font-bold">{t("products")} <span className="text-sm font-normal text-slate-400">({list.length})</span></h2>
        <input value={q} onChange={(e) => setQ(e.target.value)} className="input w-48" placeholder={t("search")} />
        <select value={cat} onChange={(e) => setCat(Number(e.target.value))} className="input w-44"><option value={0}>{t("all")}</option>{categories.map((c) => <option key={c.id} value={c.id}>{locale === "ar" ? c.nameAr : c.name}</option>)}</select>
        <Link href={`${base}/dashboard/catalog/products/new`} className="btn-accent">+ {t("add_product")}</Link>
      </div>
      {list.length ? (
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th></th><th>{t("product_name")}</th><th>{t("category")}</th><th>{t("price")}</th><th>{t("stock")}</th><th>{t("sku")} / {t("barcode")}</th><th>{t("status")}</th><th></th></tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td><div className="h-10 w-10 overflow-hidden rounded-lg bg-slate-100">{p.imageUrl && <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />}</div></td>
                  <td><Link href={`${base}/dashboard/catalog/products/${p.id}`} className="font-medium hover:underline">{locale === "ar" ? p.nameAr || p.name : p.name}</Link>{p.featured && <Badge tone="violet">★</Badge>}</td>
                  <td>{categories.find((c) => c.id === p.categoryId) ? (locale === "ar" ? categories.find((c) => c.id === p.categoryId)!.nameAr : categories.find((c) => c.id === p.categoryId)!.name) : <span className="text-slate-400">{t("uncategorized")}</span>}</td>
                  <td>{formatMoney(p.price, currency, locale)}</td>
                  <td>{p.trackStock ? <span className={p.stock <= 0 ? "font-bold text-rose-600" : p.stock <= p.lowStockThreshold ? "font-bold text-amber-600" : ""}>{p.stock}</span> : "∞"}</td>
                  <td className="font-mono text-xs" dir="ltr">{p.sku}{p.sku && p.barcode && " / "}{p.barcode}</td>
                  <td>{p.active ? <Badge tone="green">{t("active")}</Badge> : <Badge tone="slate">{t("inactive")}</Badge>}</td>
                  <td className="text-end whitespace-nowrap"><Link href={`${base}/dashboard/catalog/products/${p.id}`} className="btn-ghost">{t("edit")}</Link><button onClick={() => start(async () => { await deleteProduct(slug, p.id); router.refresh(); })} className="btn-ghost text-rose-600">{t("delete")}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState title={t("no_products")} action={<Link href={`${base}/dashboard/catalog/products/new`} className="btn-accent">{t("add_product")}</Link>} />}
    </div>
  );
}

export function ProductForm({ slug, base, product, categories, currency }: { slug: string; base: string; product?: Product; categories: Category[]; currency: string }) {
  const { t, locale } = useT();
  const router = useRouter();
  const [state, action] = useActionState(saveProduct.bind(null, slug), null);
  const [image, setImage] = useState(product?.imageUrl ?? "");
  const [gallery, setGallery] = useState<string[]>(product?.images ?? []);
  const [galleryPick, setGalleryPick] = useState("");
  const [variants, setVariants] = useState<ProductVariant[]>(product?.variants ?? []);
  useEffect(() => { if (state?.ok) router.push(`${base}/dashboard/catalog`); }, [state, router, base]);
  useEffect(() => { if (galleryPick) { setGallery((g) => (g.includes(galleryPick) ? g : [...g, galleryPick])); setGalleryPick(""); } }, [galleryPick]);
  const upV = (i: number, patch: Partial<ProductVariant>) => setVariants((v) => v.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <form action={action} className="space-y-6">
      {state && !state.ok && <Alert messageKey={state.error} />}
      <input type="hidden" name="id" value={product?.id ?? ""} />
      <input type="hidden" name="imageUrl" value={image} />
      <input type="hidden" name="images" value={JSON.stringify(gallery)} />
      <input type="hidden" name="variants" value={JSON.stringify(variants)} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card space-y-3">
            <h3 className="font-bold">{t("general")}</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t("product_name")}><input name="name" className="input" defaultValue={product?.name} required /></Field>
              <Field label={t("product_name_ar")}><input name="nameAr" className="input" dir="rtl" defaultValue={product?.nameAr} /></Field>
              <Field label={t("description")}><textarea name="description" rows={3} className="input" defaultValue={product?.description} /></Field>
              <Field label={t("description_ar")}><textarea name="descriptionAr" rows={3} className="input" dir="rtl" defaultValue={product?.descriptionAr} /></Field>
              <Field label={t("category")}><select name="categoryId" className="input" defaultValue={product?.categoryId ?? ""}><option value="">{t("uncategorized")}</option>{categories.map((c) => <option key={c.id} value={c.id}>{locale === "ar" ? c.nameAr : c.name}</option>)}</select></Field>
              <Field label={t("sort_order")}><input name="sort" type="number" className="input" defaultValue={product?.sort ?? 0} /></Field>
            </div>
          </section>
          <section className="card space-y-3">
            <h3 className="font-bold">{t("pricing")} ({currency})</h3>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label={t("price")}><input name="price" type="number" step="0.001" min="0" className="input" defaultValue={product?.price ?? ""} required /></Field>
              <Field label={t("compare_at_price")}><input name="compareAtPrice" type="number" step="0.001" min="0" className="input" defaultValue={product?.compareAtPrice ?? ""} /></Field>
              <Field label={t("cost")}><input name="cost" type="number" step="0.001" min="0" className="input" defaultValue={product?.cost ?? ""} /></Field>
            </div>
          </section>
          <section className="card space-y-3">
            <h3 className="font-bold">{t("inventory")}</h3>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label={t("sku")}><input name="sku" className="input" dir="ltr" defaultValue={product?.sku} /></Field>
              <Field label={t("barcode")}><input name="barcode" className="input" dir="ltr" defaultValue={product?.barcode} /></Field>
              <Field label={t("unit")}><input name="unit" className="input" defaultValue={product?.unit ?? "piece"} /></Field>
              <Field label={t("stock")}><input name="stock" type="number" className="input" defaultValue={product?.stock ?? 0} /></Field>
              <Field label={t("low_stock_threshold")}><input name="lowStockThreshold" type="number" className="input" defaultValue={product?.lowStockThreshold ?? 5} /></Field>
              <div className="self-end"><Toggle name="trackStock" label={t("track_stock")} defaultChecked={product?.trackStock ?? true} /></div>
            </div>
          </section>
          <section className="card space-y-3">
            <h3 className="font-bold">{t("metrics")}</h3>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label={t("weight")}><input name="weight" type="number" step="0.001" min="0" className="input" defaultValue={product?.weight ?? ""} /></Field>
              <Field label={t("weight_unit")}><select name="weightUnit" className="input" defaultValue={product?.weightUnit ?? "g"}>{["g", "kg", "mg", "oz", "ct", "lb", "ml", "l"].map((u) => <option key={u}>{u}</option>)}</select></Field>
              <Field label={t("purity")}><input name="purity" className="input" placeholder="18K / 21K / 24K / 925" defaultValue={product?.purity} /></Field>
            </div>
          </section>
          <section className="card space-y-3">
            <div className="flex items-center justify-between"><h3 className="font-bold">{t("variants")}</h3><button type="button" className="btn-outline" onClick={() => setVariants((v) => [...v, { name: "", nameAr: "", options: [{ label: "", labelAr: "", priceDelta: 0 }] }])}>+ {t("add_variant")}</button></div>
            {variants.map((v, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-3">
                <div className="flex gap-2"><input className="input" placeholder={t("variant_name")} value={v.name} onChange={(e) => upV(i, { name: e.target.value })} /><input className="input" dir="rtl" placeholder={t("name_ar")} value={v.nameAr} onChange={(e) => upV(i, { nameAr: e.target.value })} /><button type="button" className="text-rose-500" onClick={() => setVariants((x) => x.filter((_, j) => j !== i))}>×</button></div>
                <div className="mt-2 space-y-1">
                  {v.options.map((o, k) => (
                    <div key={k} className="grid grid-cols-12 gap-1"><input className="input col-span-4" placeholder={t("option_label")} value={o.label} onChange={(e) => upV(i, { options: v.options.map((x, m) => (m === k ? { ...x, label: e.target.value } : x)) })} /><input className="input col-span-4" dir="rtl" placeholder={t("name_ar")} value={o.labelAr} onChange={(e) => upV(i, { options: v.options.map((x, m) => (m === k ? { ...x, labelAr: e.target.value } : x)) })} /><input className="input col-span-3" type="number" step="0.001" placeholder={t("price_delta")} value={o.priceDelta} onChange={(e) => upV(i, { options: v.options.map((x, m) => (m === k ? { ...x, priceDelta: Number(e.target.value) } : x)) })} /><button type="button" className="col-span-1 text-rose-500" onClick={() => upV(i, { options: v.options.filter((_, m) => m !== k) })}>×</button></div>
                  ))}
                  <button type="button" className="btn-ghost text-emerald-600" onClick={() => upV(i, { options: [...v.options, { label: "", labelAr: "", priceDelta: 0 }] })}>+ {t("add_option")}</button>
                </div>
              </div>
            ))}
          </section>
        </div>
        <div className="space-y-6">
          <section className="card space-y-3">
            <h3 className="font-bold">{t("media")}</h3>
            <Field label={t("image")}><MediaPicker slug={slug} value={image} onChange={setImage} /></Field>
            <div>
              <span className="label">{t("gallery")}</span>
              <div className="grid grid-cols-3 gap-2">{gallery.map((g) => <div key={g} className="relative aspect-square overflow-hidden rounded-lg border"><img src={g} alt="" className="h-full w-full object-cover" /><button type="button" onClick={() => setGallery((x) => x.filter((y) => y !== g))} className="absolute end-1 top-1 rounded-full bg-white px-1.5 text-xs text-rose-600">×</button></div>)}</div>
              <div className="mt-2"><MediaPicker slug={slug} value="" onChange={setGalleryPick} label={`+ ${t("add")}`} /></div>
            </div>
          </section>
          <section className="card space-y-2">
            <h3 className="font-bold">{t("visibility")}</h3>
            <Toggle name="active" label={t("active")} defaultChecked={product?.active ?? true} />
            <Toggle name="featured" label={t("featured")} defaultChecked={product?.featured ?? false} />
          </section>
          <div className="flex gap-2"><SubmitButton className="btn-accent flex-1">{t("save_product")}</SubmitButton><Link href={`${base}/dashboard/catalog`} className="btn-outline">{t("cancel")}</Link></div>
        </div>
      </div>
    </form>
  );
}
