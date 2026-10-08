import { getT } from "@/lib/server-i18n";
import { CartPage } from "@/components/storefront/client-pages";

export const dynamic = "force-dynamic";

export default async function Cart() {
  const { t } = await getT();
  return <div className="mx-auto max-w-5xl px-4 py-8"><h1 className="mb-6 text-3xl font-extrabold">{t("your_cart")}</h1><CartPage /></div>;
}
