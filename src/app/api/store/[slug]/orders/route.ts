import { NextResponse, type NextRequest } from "next/server";
import { ordersFeed } from "@/actions/store";
import { AuthError } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  try {
    const status = req.nextUrl.searchParams.get("status") ?? undefined;
    const list = await ordersFeed(slug, status);
    return NextResponse.json({ ok: true, orders: list, at: Date.now() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ ok: false, error: e.code }, { status: 401 });
    return NextResponse.json({ ok: false, error: "error_generic" }, { status: 500 });
  }
}
