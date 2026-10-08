import { notFound } from "next/navigation";
import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { requireStaffPage } from "@/lib/tenant";
import { getT } from "@/lib/server-i18n";
import { ProductForm } from "@/components/dashboard/catalog";

export const dynamic = "force-dynamic";

export default async function ProductEditPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const { tenant, base } = await requireStaffPage(slug, "catalog");
  const { t } = await getT();
  const cats = await db.select().from(categories).where(eq(categories.tenantId, tenant.id)).orderBy(asc(categories.sort));
  let product;
  if (id !== "new") {
    [product] = await db.select().from(products).where(and(eq(products.id, Number(id) || 0), eq(products.tenantId, tenant.id))).limit(1);
    if (!product) notFound();
  }
  return <div className="space-y-4"><h1 className="text-2xl font-extrabold">{product ? t("edit_product") : t("new_product")}</h1><ProductForm slug={slug} base={base} product={product} categories={cats} currency={tenant.currency} /></div>;
}
