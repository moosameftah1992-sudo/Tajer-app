import { NextResponse, type NextRequest } from "next/server";
import { requireStaffAction, AuthError } from "@/lib/tenant";
import { buildReport, buildXlsx, buildPdf, parseRange } from "@/lib/reports";
import { getLocale } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  try {
    const { tenant } = await requireStaffAction(slug, "reports");
    const sp = req.nextUrl.searchParams;
    const { from, to, granularity } = parseRange({ from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined, granularity: sp.get("granularity") ?? undefined, preset: sp.get("preset") ?? undefined });
    const report = await buildReport(tenant.id, tenant.currency, from, to, granularity);
    const locale = await getLocale();
    const format = sp.get("format") === "pdf" ? "pdf" : "xlsx";
    const stamp = `${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}`;
    const meta = { storeName: locale === "ar" ? tenant.nameAr || tenant.name : tenant.name, locale };
    const buf = format === "pdf" ? await buildPdf(report, meta) : await buildXlsx(report, meta);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="tajer-${tenant.slug}-report-${stamp}.${format}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ ok: false, error: e.code }, { status: e.code === "forbidden" ? 403 : 401 });
    console.error(e);
    return NextResponse.json({ ok: false, error: "error_generic" }, { status: 500 });
  }
}
