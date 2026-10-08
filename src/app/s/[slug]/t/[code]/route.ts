import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { diningTables } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getTenantBySlug } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string; code: string }> }) {
  const { slug, code } = await ctx.params;
  const tenant = await getTenantBySlug(slug);
  const base = req.headers.get("x-tenant-mode") === "host" ? "" : `/s/${slug}`;
  const dest = new URL(`${base || "/"}`, req.url);
  if (!tenant) return NextResponse.redirect(new URL("/", req.url));
  const [table] = await db.select().from(diningTables).where(and(eq(diningTables.tenantId, tenant.id), eq(diningTables.code, code), eq(diningTables.active, true))).limit(1);
  const res = NextResponse.redirect(dest);
  if (table) res.cookies.set(`tajer_table_${tenant.id}`, table.code, { path: "/", maxAge: 60 * 60 * 6, sameSite: "lax" });
  return res;
}
