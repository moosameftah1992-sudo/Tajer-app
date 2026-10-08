import QRCode from "qrcode";
import { db } from "@/db";
import { diningTables } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { requireStaffPage, publicStoreUrl } from "@/lib/tenant";
import { TablesManager } from "@/components/dashboard/staff-tables";

export const dynamic = "force-dynamic";

export default async function TablesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant } = await requireStaffPage(slug, "tables");
  const [tables, storeUrl] = await Promise.all([db.select().from(diningTables).where(eq(diningTables.tenantId, tenant.id)).orderBy(asc(diningTables.id)), publicStoreUrl(slug)]);
  const qrs: Record<number, string> = {};
  for (const tb of tables) qrs[tb.id] = await QRCode.toDataURL(`${storeUrl}/t/${tb.code}`, { width: 512, margin: 1, color: { dark: "#0F172A", light: "#FFFFFF" } });
  return <TablesManager slug={slug} tables={tables} qrs={qrs} storeUrl={storeUrl} dineInEnabled={tenant.dineInEnabled} />;
}
