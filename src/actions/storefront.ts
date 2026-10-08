"use server";

import { db } from "@/db";
import { customers, orders, orderItems, diningTables, defaultPayments, type PaymentsConfig } from "@/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { CUSTOMER_COOKIE, hashPassword, verifyPassword, signSession, setSessionCookie, clearSessionCookie, getCustomerSession } from "@/lib/auth";
import { getTenantBySlug, getStoreBase, getRequestOrigin, subscriptionState } from "@/lib/tenant";
import { createOrder, OrderError, restoreStockForOrder } from "@/lib/orders";
import { stripeCreateSession, paypalCreateOrder, benefitCreatePayment, PaymentError } from "@/lib/payments";
import type { ActionResult } from "./platform";

function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function customerRegister(slug: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { ok: false, error: "store_not_found" };
  const name = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  const phone = str(fd, "phone");
  const password = str(fd, "password");
  if (!name || !email) return { ok: false, error: "required" };
  if (password.length < 8) return { ok: false, error: "weak_password" };
  const [existing] = await db.select().from(customers).where(and(eq(customers.tenantId, tenant.id), eq(customers.email, email))).limit(1);
  let id: number;
  if (existing) {
    if (existing.passwordHash) return { ok: false, error: "email_taken" };
    await db.update(customers).set({ name, phone, passwordHash: await hashPassword(password) }).where(eq(customers.id, existing.id));
    id = existing.id;
  } else {
    const [c] = await db.insert(customers).values({ tenantId: tenant.id, name, email, phone, passwordHash: await hashPassword(password) }).returning({ id: customers.id });
    id = c.id;
  }
  await setSessionCookie(CUSTOMER_COOKIE, await signSession({ kind: "customer", id, tenantId: tenant.id }, 30), 30);
  const base = await getStoreBase(slug);
  redirect(`${base}${str(fd, "next") || "/account"}`);
}

export async function customerLogin(slug: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { ok: false, error: "store_not_found" };
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  const [c] = await db.select().from(customers).where(and(eq(customers.tenantId, tenant.id), eq(customers.email, email))).limit(1);
  if (!c || !(await verifyPassword(password, c.passwordHash))) return { ok: false, error: "invalid_credentials" };
  await setSessionCookie(CUSTOMER_COOKIE, await signSession({ kind: "customer", id: c.id, tenantId: tenant.id }, 30), 30);
  const base = await getStoreBase(slug);
  redirect(`${base}${str(fd, "next") || "/account"}`);
}

export async function customerLogout(slug: string) {
  await clearSessionCookie(CUSTOMER_COOKIE);
  const base = await getStoreBase(slug);
  redirect(`${base}`);
}

export async function updateCustomerProfile(slug: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { ok: false, error: "store_not_found" };
  const me = await getCustomerSession(tenant.id);
  if (!me) return { ok: false, error: "invalid_credentials" };
  const patch: Partial<typeof customers.$inferInsert> = { name: str(fd, "name") || me.name, phone: str(fd, "phone"), address: str(fd, "address"), city: str(fd, "city") };
  const password = str(fd, "password");
  if (password) {
    if (password.length < 8) return { ok: false, error: "weak_password" };
    patch.passwordHash = await hashPassword(password);
  }
  await db.update(customers).set(patch).where(and(eq(customers.id, me.id), eq(customers.tenantId, tenant.id)));
  return { ok: true };
}

export async function customerOrders(slug: string) {
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return [];
  const me = await getCustomerSession(tenant.id);
  if (!me) return [];
  const list = await db.select().from(orders).where(and(eq(orders.tenantId, tenant.id), eq(orders.customerId, me.id))).orderBy(desc(orders.createdAt)).limit(50);
  const ids = list.map((o) => o.id);
  const items = ids.length ? await db.select().from(orderItems).where(and(eq(orderItems.tenantId, tenant.id), inArray(orderItems.orderId, ids))) : [];
  return list.map((o) => ({ ...o, items: items.filter((i) => i.orderId === o.id) }));
}

export type PlaceOrderPayload = {
  lines: { productId: number; qty: number; options?: Record<string, string> }[];
  fulfillmentType: "delivery" | "pickup" | "dine_in";
  paymentMethod: "cash" | "benefit" | "card" | "paypal";
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  tableCode?: string;
};

export type PlaceOrderResult = { ok: true; orderNumber: string; redirectUrl?: string } | { ok: false; error: string; detail?: string };

export async function placeOrder(slug: string, payload: PlaceOrderPayload): Promise<PlaceOrderResult> {
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { ok: false, error: "store_not_found" };
  if (!subscriptionState(tenant).active) return { ok: false, error: "maintenance_title" };
  const pay: PaymentsConfig = { ...defaultPayments, ...(tenant.payments ?? {}) };
  const method = payload.paymentMethod;
  if (!pay[method]?.enabled) return { ok: false, error: "payment_method_sf" };
  if (!payload.name.trim() || !payload.phone.trim()) return { ok: false, error: "required" };
  if (payload.fulfillmentType === "delivery" && !payload.address.trim()) return { ok: false, error: "delivery_address" };

  const me = await getCustomerSession(tenant.id);
  let tableId: number | null = null;
  if (payload.fulfillmentType === "dine_in") {
    const jar = await cookies();
    const code = payload.tableCode || jar.get(`tajer_table_${tenant.id}`)?.value || "";
    if (code) {
      const [table] = await db.select().from(diningTables).where(and(eq(diningTables.tenantId, tenant.id), eq(diningTables.code, code), eq(diningTables.active, true))).limit(1);
      tableId = table?.id ?? null;
    }
  }

  let customerId: number | null = me?.id ?? null;
  const email = payload.email.trim().toLowerCase();
  if (!customerId && email) {
    const [existing] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.tenantId, tenant.id), eq(customers.email, email))).limit(1);
    if (existing) customerId = existing.id;
    else {
      const [c] = await db.insert(customers).values({ tenantId: tenant.id, name: payload.name.trim(), email, phone: payload.phone.trim(), address: payload.address.trim() }).returning({ id: customers.id });
      customerId = c.id;
    }
  }

  let created: Awaited<ReturnType<typeof createOrder>>;
  try {
    created = await createOrder({
      tenant,
      lines: payload.lines,
      fulfillmentType: payload.fulfillmentType,
      paymentMethod: method,
      paymentStatus: "pending",
      source: "storefront",
      customer: { id: customerId, name: payload.name.trim(), phone: payload.phone.trim(), email, address: payload.address.trim() },
      tableId,
      notes: payload.notes.slice(0, 500),
    });
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code, detail: e.detail };
    console.error(e);
    return { ok: false, error: "error_generic" };
  }
  const { order } = created;
  if (method === "cash") return { ok: true, orderNumber: order.orderNumber };

  const origin = await getRequestOrigin();
  const base = await getStoreBase(slug);
  const orderUrl = `${origin}${base}/order/${order.orderNumber}`;
  const ret = `${origin}/api/store/${slug}/payments/${method}/return?order=${encodeURIComponent(order.orderNumber)}&base=${encodeURIComponent(base)}`;
  try {
    let url = "";
    let ref = "";
    if (method === "card") {
      const r = await stripeCreateSession(pay.card, order, tenant, ret, `${orderUrl}?payment=cancelled`);
      url = r.url;
      ref = r.sessionId;
    } else if (method === "paypal") {
      const r = await paypalCreateOrder(pay.paypal, order, tenant, ret, `${orderUrl}?payment=cancelled`);
      url = r.url;
      ref = r.paypalOrderId;
    } else if (method === "benefit") {
      const r = await benefitCreatePayment(pay.benefit, order, ret, `${ret}&error=1`);
      url = r.url;
      ref = r.paymentId;
    }
    await db.update(orders).set({ paymentRef: ref }).where(and(eq(orders.id, order.id), eq(orders.tenantId, tenant.id)));
    return { ok: true, orderNumber: order.orderNumber, redirectUrl: url };
  } catch (e) {
    await db.update(orders).set({ status: "cancelled", paymentStatus: "failed", updatedAt: new Date() }).where(and(eq(orders.id, order.id), eq(orders.tenantId, tenant.id)));
    await restoreStockForOrder(tenant.id, order.id);
    return { ok: false, error: "payment_failed_sf", detail: e instanceof PaymentError ? e.message : undefined };
  }
}
