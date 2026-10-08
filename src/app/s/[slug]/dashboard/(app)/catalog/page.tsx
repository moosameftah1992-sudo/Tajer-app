import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { requireStaffPage } from "@/lib/tenant";
import { getT } from "@/lib/server-i18n";
import { CategoryManager, ProductTable } from "@/components/dashboard/catalog";

export const dynamic = "force-dynamic";

export default async function CatalogPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, base } = await requireStaffPage(slug, "catalog");
  const { t } = await getT();
  const [cats, prods] = await Promise.all([
    db.select().from(categories).where(eq(categories.tenantId, tenant.id)).orderBy(asc(categories.sort), asc(categories.name)),
    db.select().from(products).where(eq(products.tenantId, tenant.id)).orderBy(desc(products.updatedAt)).limit(1000),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">{t("catalog_title")}</h1>
      <CategoryManager slug={slug} categories={cats} />
      <ProductTable slug={slug} base={base} products={prods} categories={cats} currency={tenant.currency} />
    </div>
  );
}
