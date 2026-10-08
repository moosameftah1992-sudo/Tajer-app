import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { orders, defaultPayments, type PaymentsConfig } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getTenantBySlug } from "@/lib/tenant";
import { stripeVerifySession, paypalCapture, benefitParseResponse } from "@/lib/payments";
import { restoreStockForOrder } from "@/lib/orders";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; gateway: string }> };

async function finalize(req: NextRequest, slug: string, orderNumber: string, paid: boolean, ref: string, base: string) {
  const tenant = await getTenantBySlug(slug);
  const origin = `${req.headers.get("x-forwarded-proto") ?? "https"}://${req.headers.get("x-forwarded-host") ?? req.headers.get("host")}`;
  const dest = `${origin}${base}/order/${encodeURIComponent(orderNumber)}?payment=${paid ? "success" : "failed"}`;
  if (!tenant) return NextResponse.redirect(`${origin}/`, 303);
  const [order] = await db.select().from(orders).where(and(eq(orders.tenantId, tenant.id), eq(orders.orderNumber, orderNumber))).limit(1);
  if (order && order.paymentStatus !== "paid") {
    if (paid) {
      await db.update(orders).set({ paymentStatus: "paid", paymentRef: ref || order.paymentRef, updatedAt: new Date() }).where(eq(orders.id, order.id));
    } else {
      await db.update(orders).set({ paymentStatus: "failed", status: "cancelled", updatedAt: new Date() }).where(eq(orders.id, order.id));
      await restoreStockForOrder(tenant.id, order.id);
    }
  }
  return NextResponse.redirect(dest, 303);
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { slug, gateway } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const orderNumber = sp.get("order") ?? "";
  const base = sp.get("base") ?? `/s/${slug}`;
  const tenant = await getTenantBySlug(slug);
  if (!tenant || !orderNumber) return NextResponse.redirect(new URL("/", req.url), 303);
  const pay: PaymentsConfig = { ...defaultPayments, ...(tenant.payments ?? {}) };
  let paid = false;
  let ref = "";
  try {
    if (gateway === "card") {
      const sid = sp.get("session_id") ?? "";
      if (sid) {
        const r = await stripeVerifySession(pay.card, sid);
        paid = r.paid && r.reference === orderNumber;
        ref = r.intent || sid;
      }
    } else if (gateway === "paypal") {
      const token = sp.get("token") ?? "";
      if (token) {
        const r = await paypalCapture(pay.paypal, token);
        paid = r.paid && (!r.reference || r.reference === orderNumber);
        ref = token;
      }
    }
  } catch {
    paid = false;
  }
  return finalize(req, slug, orderNumber, paid, ref, base);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { slug, gateway } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const base = sp.get("base") ?? `/s/${slug}`;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return NextResponse.redirect(new URL("/", req.url), 303);
  const pay: PaymentsConfig = { ...defaultPayments, ...(tenant.payments ?? {}) };
  let orderNumber = sp.get("order") ?? "";
  let paid = false;
  let ref = "";
  if (gateway === "benefit") {
    try {
      const form = await req.formData();
      const trandata = String(form.get("trandata") ?? "");
      if (trandata) {
        const r = benefitParseResponse(trandata, pay.benefit.resourceKey);
        paid = r.paid && !sp.get("error");
        if (r.trackId) orderNumber = r.trackId;
        ref = r.tranId || r.paymentId || r.ref;
      }
    } catch {
      paid = false;
    }
  }
  return finalize(req, slug, orderNumber, paid, ref, base);
}
