import { db } from "@/db";
import { products, categories } from "@/db/schema";
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { mustTenant, getStoreBase } from "@/lib/tenant";
import { getTemplate } from "@/lib/templates";
import { StoreHome } from "@/components/storefront/home";

export const dynamic = "force-dynamic";

export default async function StorefrontPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ c?: string; q?: string }> }) {
  const { slug } = await params;
  const { c, q = "" } = await searchParams;
  const tenant = await mustTenant(slug);
  const base = await getStoreBase(slug);
  const activeCategory = Number(c) || null;
  const where = [eq(products.tenantId, tenant.id), eq(products.active, true)];
  if (activeCategory) where.push(eq(products.categoryId, activeCategory));
  if (q.trim()) where.push(or(ilike(products.name, `%${q.trim()}%`), ilike(products.nameAr, `%${q.trim()}%`), ilike(products.sku, `%${q.trim()}%`))!);
  const [prods, cats] = await Promise.all([
    db.select().from(products).where(and(...where)).orderBy(desc(products.featured), asc(products.sort), desc(products.createdAt)).limit(200),
    db.select().from(categories).where(and(eq(categories.tenantId, tenant.id), eq(categories.active, true))).orderBy(asc(categories.sort), asc(categories.name)),
  ]);
  return <StoreHome tenant={tenant} tpl={getTemplate(tenant.templateId)} base={base} products={prods} categories={cats} activeCategory={activeCategory} query={q} />;
}
