import "server-only";
import { db } from "@/db";
import { orders, orderItems, products, type Tenant } from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { generateOrderNumber, roundMoney, toNum } from "./utils";

export type CartLine = { productId: number; qty: number; options?: Record<string, string> };

export type CreateOrderInput = {
  tenant: Tenant;
  lines: CartLine[];
  fulfillmentType: "delivery" | "pickup" | "dine_in";
  paymentMethod: "cash" | "benefit" | "card" | "paypal";
  paymentStatus?: "pending" | "paid";
  source: "storefront" | "pos";
  customer?: { id?: number | null; name?: string; phone?: string; email?: string; address?: string };
  tableId?: number | null;
  notes?: string;
  discount?: number;
  staffId?: number | null;
};

export class OrderError extends Error {
  constructor(public code: string, public detail?: string) {
    super(code);
  }
}

export async function createOrder(input: CreateOrderInput) {
  const { tenant } = input;
  const lines = input.lines.filter((l) => l.qty > 0 && Number.isInteger(l.productId));
  if (!lines.length) throw new OrderError("cart_empty");
  if (input.fulfillmentType === "delivery" && !tenant.deliveryEnabled) throw new OrderError("fulfillment");
  if (input.fulfillmentType === "pickup" && !tenant.pickupEnabled) throw new OrderError("fulfillment");
  if (input.fulfillmentType === "dine_in" && !tenant.dineInEnabled) throw new OrderError("fulfillment");

  const ids = [...new Set(lines.map((l) => l.productId))];
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.tenantId, tenant.id), inArray(products.id, ids), eq(products.active, true)));
  const byId = new Map(rows.map((p) => [p.id, p]));

  type Built = { productId: number; name: string; nameAr: string; variant: string; qty: number; unitPrice: number; total: number; track: boolean };
  const built: Built[] = [];
  for (const line of lines) {
    const p = byId.get(line.productId);
    if (!p) throw new OrderError("product_not_available");
    let unit = toNum(p.price);
    const variantParts: string[] = [];
    for (const v of p.variants ?? []) {
      const chosen = line.options?.[v.name];
      if (chosen !== undefined) {
        const opt = v.options.find((o) => o.label === chosen);
        if (!opt) throw new OrderError("select_variant", v.name);
        unit += toNum(opt.priceDelta);
        variantParts.push(`${v.name}: ${opt.label}`);
      } else if (v.options.length) {
        throw new OrderError("select_variant", v.name);
      }
    }
    if (p.trackStock && p.stock < line.qty) throw new OrderError("out_of_stock_sf", p.name);
    unit = roundMoney(unit, tenant.currency);
    built.push({
      productId: p.id,
      name: p.name,
      nameAr: p.nameAr,
      variant: variantParts.join(", "),
      qty: line.qty,
      unitPrice: unit,
      total: roundMoney(unit * line.qty, tenant.currency),
      track: p.trackStock,
    });
  }

  const subtotal = roundMoney(built.reduce((s, b) => s + b.total, 0), tenant.currency);
  const discount = Math.min(subtotal, Math.max(0, roundMoney(input.discount ?? 0, tenant.currency)));
  const minOrder = toNum(tenant.minOrder);
  if (input.source === "storefront" && minOrder > 0 && subtotal < minOrder) throw new OrderError("min_order_hint", String(minOrder));
  const rate = toNum(tenant.taxRate) / 100;
  const taxable = subtotal - discount;
  const tax = tenant.taxInclusive ? roundMoney(taxable - taxable / (1 + rate), tenant.currency) : roundMoney(taxable * rate, tenant.currency);
  const deliveryFee = input.fulfillmentType === "delivery" ? roundMoney(toNum(tenant.deliveryFee), tenant.currency) : 0;
  const total = roundMoney(taxable + (tenant.taxInclusive ? 0 : tax) + deliveryFee, tenant.currency);

  const result = await db.transaction(async (tx) => {
    for (const b of built) {
      if (!b.track) continue;
      const updated = await tx
        .update(products)
        .set({ stock: sql`${products.stock} - ${b.qty}`, updatedAt: new Date() })
        .where(and(eq(products.id, b.productId), eq(products.tenantId, tenant.id), sql`${products.stock} >= ${b.qty}`))
        .returning({ id: products.id });
      if (!updated.length) throw new OrderError("out_of_stock_sf", b.name);
    }
    const [order] = await tx
      .insert(orders)
      .values({
        tenantId: tenant.id,
        orderNumber: generateOrderNumber(),
        customerId: input.customer?.id ?? null,
        customerName: input.customer?.name ?? "",
        customerPhone: input.customer?.phone ?? "",
        customerEmail: input.customer?.email ?? "",
        address: input.customer?.address ?? "",
        fulfillmentType: input.fulfillmentType,
        tableId: input.tableId ?? null,
        paymentMethod: input.paymentMethod,
        paymentStatus: input.paymentStatus ?? "pending",
        status: input.source === "pos" ? "fulfilled" : "pending",
        subtotal: String(subtotal),
        tax: String(tax),
        deliveryFee: String(deliveryFee),
        discount: String(discount),
        total: String(total),
        currency: tenant.currency,
        notes: input.notes ?? "",
        source: input.source,
        staffId: input.staffId ?? null,
      })
      .returning();
    const items = await tx
      .insert(orderItems)
      .values(
        built.map((b) => ({
          tenantId: tenant.id,
          orderId: order.id,
          productId: b.productId,
          name: b.name,
          nameAr: b.nameAr,
          variant: b.variant,
          qty: b.qty,
          unitPrice: String(b.unitPrice),
          total: String(b.total),
        })),
      )
      .returning();
    return { order, items };
  });
  return result;
}

export async function restoreStockForOrder(tenantId: number, orderId: number) {
  const items = await db.select().from(orderItems).where(and(eq(orderItems.tenantId, tenantId), eq(orderItems.orderId, orderId)));
  for (const it of items) {
    if (!it.productId) continue;
    await db
      .update(products)
      .set({ stock: sql`${products.stock} + ${it.qty}` })
      .where(and(eq(products.id, it.productId), eq(products.tenantId, tenantId), eq(products.trackStock, true)));
  }
}
