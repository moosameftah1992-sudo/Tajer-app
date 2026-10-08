import { requireStaffPage } from "@/lib/tenant";
import { getT } from "@/lib/server-i18n";
import { buildReport, parseRange } from "@/lib/reports";
import { ReportsView } from "@/components/dashboard/reports-view";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ preset?: string; from?: string; to?: string; granularity?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { tenant } = await requireStaffPage(slug, "reports");
  const { t } = await getT();
  const { from, to, granularity } = parseRange(sp);
  const report = await buildReport(tenant.id, tenant.currency, from, to, granularity);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">{t("reports_title")}</h1>
      <ReportsView slug={slug} report={report} params={{ preset: sp.preset ?? "30d", from: iso(from), to: iso(to), granularity }} />
    </div>
  );
}
