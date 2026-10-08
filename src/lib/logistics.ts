import "server-only";
import { createHmac } from "node:crypto";
import { db } from "@/db";
import { orders, orderItems, shipments, shippingProviders, tenantShippingProviders, logisticsEvents, type Tenant } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export class LogisticsError extends Error {}

function extractTracking(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const o = body as Record<string, unknown>;
  for (const k of ["tracking_number", "trackingNumber", "tracking", "awb", "waybill", "shipment_id", "shipmentId", "id", "reference"]) {
    const v = o[k];
    if (typeof v === "string" && v) return v;
    if (typeof v === "number") return String(v);
  }
  if (o.data && typeof o.data === "object") return extractTracking(o.data);
  return "";
}

/** Create a shipment with a dynamically-configured carrier via its outbound webhook. */
export async function dispatchShipment(tenant: Tenant, orderId: number, providerId: number, origin: string) {
  const [provider] = await db.select().from(shippingProviders).where(and(eq(shippingProviders.id, providerId), eq(shippingProviders.active, true))).limit(1);
  if (!provider) throw new LogisticsError("carrier");
  const [binding] = await db
    .select()
    .from(tenantShippingProviders)
    .where(and(eq(tenantShippingProviders.tenantId, tenant.id), eq(tenantShippingProviders.providerId, providerId)))
    .limit(1);
  if (!binding || !binding.enabledByAdmin || !binding.active) throw new LogisticsError("no_carrier_active");
  const [order] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.tenantId, tenant.id))).limit(1);
  if (!order) throw new LogisticsError("order_not_found");
  const items = await db.select().from(orderItems).where(and(eq(orderItems.orderId, orderId), eq(orderItems.tenantId, tenant.id)));

  const payload = {
    event: "shipment.create",
    reference: order.orderNumber,
    store: { id: tenant.id, slug: tenant.slug, name: tenant.name, phone: tenant.phone, address: tenant.address, country: tenant.country },
    recipient: { name: order.customerName, phone: order.customerPhone, email: order.customerEmail, address: order.address },
    order: {
      number: order.orderNumber,
      total: order.total,
      currency: order.currency,
      cod: order.paymentMethod === "cash" && order.paymentStatus !== "paid" ? order.total : "0",
      items: items.map((i) => ({ name: i.name, qty: i.qty, price: i.unitPrice, variant: i.variant })),
    },
    credentials: binding.credentials,
    callback_url: `${origin}/api/logistics/webhook/${provider.code}`,
  };

  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { "Content-Type": "application/json", "X-Tajer-Provider": provider.code };
  if (provider.outboundSecret) {
    headers[provider.authHeader || "Authorization"] = provider.authHeader.toLowerCase() === "authorization" ? `Bearer ${provider.outboundSecret}` : provider.outboundSecret;
    headers["X-Tajer-Signature"] = createHmac("sha256", provider.outboundSecret).update(body).digest("hex");
  }

  let responseJson: Record<string, unknown> = {};
  let tracking = "";
  let status = "created";
  if (provider.webhookUrl) {
    const res = await fetch(provider.webhookUrl, { method: "POST", headers, body, signal: AbortSignal.timeout(15000) });
    const text = await res.text();
    try {
      responseJson = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      responseJson = { raw: text };
    }
    if (!res.ok) {
      status = "failed";
      await db.insert(shipments).values({ tenantId: tenant.id, orderId, providerId, status, requestPayload: payload, responsePayload: { httpStatus: res.status, ...responseJson } });
      throw new LogisticsError(`carrier_http_${res.status}`);
    }
    tracking = extractTracking(responseJson);
  }
  if (!tracking) tracking = `${provider.code.toUpperCase()}-${order.orderNumber}`;

  await db.transaction(async (tx) => {
    await tx.insert(shipments).values({ tenantId: tenant.id, orderId, providerId, trackingNumber: tracking, status, requestPayload: payload, responsePayload: responseJson });
    await tx
      .update(orders)
      .set({ shippingProviderId: providerId, shippingTracking: tracking, shippingStatus: status, status: order.status === "pending" ? "processing" : order.status, updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenant.id)));
    await tx.insert(logisticsEvents).values({ providerId, tenantId: tenant.id, orderId, tracking, event: "shipment.created", payload: responseJson });
  });
  return { tracking, provider };
}

export function trackingUrl(template: string, tracking: string) {
  return template ? template.replace("{tracking}", encodeURIComponent(tracking)) : "";
}
