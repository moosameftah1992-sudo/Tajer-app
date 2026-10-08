import { mustTenant } from "@/lib/tenant";
import { getCustomerSession } from "@/lib/auth";
import { getT } from "@/lib/server-i18n";
import { CheckoutPage } from "@/components/storefront/client-pages";

export const dynamic = "force-dynamic";

export default async function Checkout({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await mustTenant(slug);
  const customer = await getCustomerSession(tenant.id);
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-extrabold">{t("checkout_title")}</h1>
      <CheckoutPage tenant={{ deliveryEnabled: tenant.deliveryEnabled, pickupEnabled: tenant.pickupEnabled, dineInEnabled: tenant.dineInEnabled, deliveryFee: tenant.deliveryFee, taxRate: tenant.taxRate, taxInclusive: tenant.taxInclusive, minOrder: tenant.minOrder, payments: tenant.payments }} customer={customer ? { name: customer.name, phone: customer.phone, email: customer.email, address: customer.address } : null} />
    </div>
  );
}
