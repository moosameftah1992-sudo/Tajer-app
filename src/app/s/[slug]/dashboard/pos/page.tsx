import { requireStaffPage } from "@/lib/tenant";
import { getLocale } from "@/lib/server-i18n";
import { pick } from "@/lib/i18n";
import { posProducts } from "@/actions/store";
import { PosTerminal } from "@/components/dashboard/pos-terminal";

export const dynamic = "force-dynamic";

export default async function PosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, staff, base } = await requireStaffPage(slug, "pos");
  const locale = await getLocale();
  const { categories, products } = await posProducts(slug);
  const payments = (["cash", "benefit", "card", "paypal"] as const).filter((p) => tenant.payments?.[p]?.enabled);
  const fulfillment = (["pickup", "dine_in", "delivery"] as const).filter((f) => (f === "pickup" && tenant.pickupEnabled) || (f === "dine_in" && tenant.dineInEnabled) || (f === "delivery" && tenant.deliveryEnabled));
  return (
    <PosTerminal slug={slug} base={base} currency={tenant.currency} categories={categories} products={products} payments={payments.length ? payments : ["cash"]} taxRate={Number(tenant.taxRate)} taxInclusive={tenant.taxInclusive} storeName={pick(locale, tenant.name, tenant.nameAr)} logoUrl={tenant.logoUrl} staffName={staff.name} fulfillment={fulfillment.length ? fulfillment : ["pickup"]} />
  );
}
