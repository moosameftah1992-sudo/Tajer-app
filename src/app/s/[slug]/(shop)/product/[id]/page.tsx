import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { products } from "@/db/schema";
import { and, eq, ne, desc } from "drizzle-orm";
import { mustTenant, getStoreBase } from "@/lib/tenant";
import { getTemplate } from "@/lib/templates";
import { getT } from "@/lib/server-i18n";
import { ProductDetail } from "@/components/storefront/client-pages";
import { ProductCard } from "@/components/storefront/home";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const tenant = await mustTenant(slug);
  const [product] = await db.select().from(products).where(and(eq(products.id, Number(id) || 0), eq(products.tenantId, tenant.id), eq(products.active, true))).limit(1);
  if (!product) notFound();
  const { t, locale } = await getT();
  const base = await getStoreBase(slug);
  const related = await db.select().from(products).where(and(eq(products.tenantId, tenant.id), eq(products.active, true), ne(products.id, product.id), product.categoryId ? eq(products.categoryId, product.categoryId) : undefined)).orderBy(desc(products.featured)).limit(4);
  const tpl = getTemplate(tenant.templateId);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Link href={base || "/"} className="text-sm sf-muted">← {t("back_to_store")}</Link>
      <div className="mt-4"><ProductDetail product={product} /></div>
      {related.length > 0 && <section className="mt-16"><h2 className="mb-5 text-2xl font-extrabold">{t("related_products")}</h2><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{related.map((p) => <ProductCard key={p.id} p={p} tpl={tpl} base={base} currency={tenant.currency} locale={locale} />)}</div></section>}
    </div>
  );
}
