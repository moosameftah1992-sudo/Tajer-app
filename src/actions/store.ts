"use server";

import { db } from "@/db";
import {
  categories,
  products,
  staffUsers,
  customers,
  orders,
  orderItems,
  mediaFolders,
  mediaFiles,
  diningTables,
  tenants,
  tenantShippingProviders,
  shippingProviders,
  subscriptionInvoices,
  plans,
  defaultPayments,
  type ProductVariant,
  type PaymentsConfig,
  type BusinessHour,
} from "@/db/schema";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { STAFF_COOKIE, hashPassword, verifyPassword, signSession, setSessionCookie, clearSessionCookie, getStaffSession } from "@/lib/auth";
import { requireStaffAction, getTenantBySlug, getStoreBase, AuthError, getRequestOrigin } from "@/lib/tenant";
import { PERMISSIONS, ROLE_PRESETS, type Permission, type StaffRole } from "@/lib/permissions";
import { isCurrency, randomCode, ORDER_STATUSES, type OrderStatus, toNum, BUSINESS_TYPES } from "@/lib/utils";
import { getTemplate } from "@/lib/templates";
import { createOrder, OrderError, restoreStockForOrder } from "@/lib/orders";
import { removeStoredFile } from "@/lib/media";
import { dispatchShipment, LogisticsError } from "@/lib/logistics";
import type { ActionResult } from "./platform";

function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}
function num(fd: FormData, key: string, fallback = 0) {
  const n = Number(str(fd, key));
  return Number.isFinite(n) ? n : fallback;
}
function handleErr(e: unknown): ActionResult {
  if (e instanceof AuthError) return { ok: false, error: e.code === "locked" ? "subscription_expired_title" : e.code === "forbidden" ? "forbidden" : "invalid_credentials" };
  if (e instanceof OrderError) return { ok: false, error: e.code };
  if (e instanceof LogisticsError) return { ok: false, error: e.message };
  console.error(e);
  return { ok: false, error: "error_generic" };
}
function reval(slug: string, ...paths: string[]) {
  for (const p of paths) revalidatePath(`/s/${slug}${p}`);
}

/* =========================== AUTH =========================== */
export async function staffLogin(slug: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { ok: false, error: "store_not_found" };
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  const [staff] = await db
    .select()
    .from(staffUsers)
    .where(and(eq(staffUsers.tenantId, tenant.id), eq(staffUsers.email, email), eq(staffUsers.active, true)))
    .limit(1);
  if (!staff || !(await verifyPassword(password, staff.passwordHash))) return { ok: false, error: "invalid_credentials" };
  await db.update(staffUsers).set({ lastLoginAt: new Date() }).where(eq(staffUsers.id, staff.id));
  await setSessionCookie(STAFF_COOKIE, await signSession({ kind: "staff", id: staff.id, tenantId: tenant.id }));
  const base = await getStoreBase(slug);
  redirect(`${base}/dashboard`);
}

export async function staffLogout(slug: string) {
  await clearSessionCookie(STAFF_COOKIE);
  const base = await getStoreBase(slug);
  redirect(`${base}/dashboard/login`);
}

/* =========================== CATEGORIES =========================== */
export async function saveCategory(slug: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    const { tenant } = await requireStaffAction(slug, "catalog");
    const id = num(fd, "id");
    const values = { name: str(fd, "name"), nameAr: str(fd, "nameAr") || str(fd, "name"), imageUrl: str(fd, "imageUrl"), sort: num(fd, "sort"), active: fd.get("active") !== "off" };
    if (!values.name) return { ok: false, error: "required" };
    if (id) await db.update(categories).set(values).where(and(eq(categories.id, id), eq(categories.tenantId, tenant.id)));
    else await db.insert(categories).values({ ...values, tenantId: tenant.id });
    reval(slug, "/dashboard/catalog", "");
    return { ok: true };
  } catch (e) {
    return handleErr(e);
  }
}

export async function deleteCategory(slug: string, id: number): Promise<ActionResult> {
  try {
    const { tenant } = await requireStaffAction(slug, "catalog");
    await db.update(products).set({ categoryId: null }).where(and(eq(products.categoryId, id), eq(products.tenantId, tenant.id)));
    await db.delete(categories).where(and(eq(categories.id, id), eq(categories.tenantId, tenant.id)));
    reval(slug, "/dashboard/catalog", "");
    return { ok: true };
  } catch (e) {
    return handleErr(e);
  }
}

/* =========================== PRODUCTS =========================== */
function parseVariants(raw: string): ProductVariant[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v) => v && typeof v.name === "string" && v.name.trim())
      .map((v) => ({
        name: String(v.name).trim(),
        nameAr: String(v.nameAr ?? v.name).trim(),
        options: Array.isArray(v.options)
          ? v.options
              .filter((o: { label?: unknown }) => o && typeof o.label === "string" && (o.label as string).trim())
              .map((o: { label: string; labelAr?: string; priceDelta?: unknown }) => ({
                label: o.label.trim(),
                labelAr: String(o.labelAr ?? o.label).trim(),
                priceDelta: Number(o.priceDelta) || 0,
              }))
          : [],
      }));
  } catch {
    return [];
  }
}

export async function saveProduct(slug: string, _prev: ActionResult<{ id?: number }> | null, fd: FormData): Promise<ActionResult<{ id?: number }>> {
  try {
    const { tenant } = await requireStaffAction(slug, "catalog");
    const id = num(fd, "id");
    let images: string[] = [];
    try {
      const parsed = JSON.parse(str(fd, "images") || "[]");
      if (Array.isArray(parsed)) images = parsed.filter((s) => typeof s === "string").slice(0, 12);
    } catch {
      images = [];
    }
    const categoryId = num(fd, "categoryId") || null;
    if (categoryId) {
      const [cat] = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.id, categoryId), eq(categories.tenantId, tenant.id))).limit(1);
      if (!cat) return { ok: false, error: "category" };
    }
    const values = {
      categoryId,
      name: str(fd, "name"),
      nameAr: str(fd, "nameAr") || str(fd, "name"),
      description: str(fd, "description"),
      descriptionAr: str(fd, "descriptionAr"),
      price: String(Math.max(0, num(fd, "price"))),
      compareAtPrice: str(fd, "compareAtPrice") ? String(Math.max(0, num(fd, "compareAtPrice"))) : null,
      cost: str(fd, "cost") ? String(Math.max(0, num(fd, "cost"))) : null,
      sku: str(fd, "sku"),
      barcode: str(fd, "barcode"),
      stock: Math.max(0, Math.round(num(fd, "stock"))),
      trackStock: fd.get("trackStock") === "on",
      lowStockThreshold: Math.max(0, Math.round(num(fd, "lowStockThreshold", 5))),
      weight: str(fd, "weight") ? String(Math.max(0, num(fd, "weight"))) : null,
      weightUnit: str(fd, "weightUnit") || "g",
      purity: str(fd, "purity"),
      unit: str(fd, "unit") || "piece",
      imageUrl: str(fd, "imageUrl") || images[0] || "",
      images,
      variants: parseVariants(str(fd, "variants")),
      featured: fd.get("featured") === "on",
      active: fd.get("active") === "on",
      sort: num(fd, "sort"),
      updatedAt: new Date(),
    };
    if (!values.name) return { ok: false, error: "required" };
    let savedId = id;
    if (id) {
      await db.update(products).set(values).where(and(eq(products.id, id), eq(products.tenantId, tenant.id)));
    } else {
      const [p] = await db.insert(products).values({ ...values, tenantId: tenant.id }).returning({ id: products.id });
      savedId = p.id;
    }
    reval(slug, "/dashboard/catalog", "", "/dashboard/pos");
    return { ok: true, id: savedId };
  } catch (e) {
    return handleErr(e) as ActionResult<{ id?: number }>;
  }
}

export async function deleteProduct(slug: string, id: number): Promise<ActionResult> {
  try {
    const { tenant } = await requireStaffAction(slug, "catalog");
    await db.delete(products).where(and(eq(products.id, id), eq(products.tenantId, tenant.id)));
    reval(slug, "/dashboard/catalog", "");
    return { ok: true };
  } catch (e) {
    return handleErr(e);
  }
}

/* =========================== MEDIA =========================== */
export async function createFolder(slug: string, name: string, parentId: number | null): Promise<ActionResult<{ id?: number }>> {
  try {
    const { tenant } = await requireStaffAction(slug, "media");
    const clean = name.trim().slice(0, 60);
    if (!clean) return { ok: false, error: "required" };
    const [f] = await db.insert(mediaFolders).values({ tenantId: tenant.id, name: clean, parentId }).returning({ id: mediaFolders.id });
    reval(slug, "/dashboard/media");
    return { ok: true, id: f.id };
  } catch (e) {
    return handleErr(e) as ActionResult<{ id?: number }>;
  }
}

export async function deleteFolder(slug: string, id: number): Promise<ActionResult> {
  try {
    const { tenant } = await requireStaffAction(slug, "media");
    await db.update(mediaFiles).set({ folderId: null }).where(and(eq(mediaFiles.folderId, id), eq(mediaFiles.tenantId, tenant.id)));
    await db.update(mediaFolders).set({ parentId: null }).where(and(eq(mediaFolders.parentId, id), eq(mediaFolders.tenantId, tenant.id)));
    await db.delete(mediaFolders).where(and(eq(mediaFolders.id, id), eq(mediaFolders.tenantId, tenant.id)));
    reval(slug, "/dashboard/media");
    return { ok: true };
  } catch (e) {
    return handleErr(e);
  }
}

export async function deleteMedia(slug: string, id: number): Promise<ActionResult> {
  try {
    const { tenant } = await requireStaffAction(slug, "media");
    const [file] = await db.select().from(mediaFiles).where(and(eq(mediaFiles.id, id), eq(mediaFiles.tenantId, tenant.id))).limit(1);
    if (!file) return { ok: false, error: "not_found" };
    await db.delete(mediaFiles).where(eq(mediaFiles.id, file.id));
    await removeStoredFile(file.storagePath);
    reval(slug, "/dashboard/media");
    return { ok: true };
  } catch (e) {
    return handleErr(e);
  }
}

export async function listMedia(slug: string, folderId: number | null) {
  const { tenant } = await requireStaffAction(slug, "media");
  const [folders, files] = await Promise.all([
    db.select().from(mediaFolders).where(eq(mediaFolders.tenantId, tenant.id)).orderBy(asc(mediaFolders.name)),
    db
      .select()
      .from(mediaFiles)
      .where(folderId === null ? and(eq(mediaFiles.tenantId, tenant.id), sql`${mediaFiles.folderId} is null`) : and(eq(mediaFiles.tenantId, tenant.id), eq(mediaFiles.folderId, folderId)))
      .orderBy(desc(mediaFiles.createdAt)),
  ]);
  return { folders, files };
}

/* =========================== STAFF =========================== */
export async function saveStaff(slug: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    const { tenant, staff: me } = await requireStaffAction(slug, "staff");
    const id = num(fd, "id");
    const name = str(fd, "name");
    const email = str(fd, "email").toLowerCase();
    const password = str(fd, "password");
    const role = (str(fd, "role") || "cashier") as StaffRole;
    const toggles = PERMISSIONS.filter((p) => fd.get(`perm_${p}`) === "on") as Permission[];
    const permissions = role === "custom" ? toggles : toggles.length ? toggles : ROLE_PRESETS[role] ?? [];
    if (!name || !email) return { ok: false, error: "required" };
    if (id) {
      const [existing] = await db.select().from(staffUsers).where(and(eq(staffUsers.id, id), eq(staffUsers.tenantId, tenant.id))).limit(1);
      if (!existing) return { ok: false, error: "not_found" };
      const patch: Partial<typeof staffUsers.$inferInsert> = { name, email };
      if (existing.role !== "owner") {
        patch.role = role === "owner" ? "admin" : role;
        patch.permissions = permissions;
        patch.active = fd.get("active") !== "off";
      }
      if (password) {
        if (password.length < 8) return { ok: false, error: "weak_password" };
        patch.passwordHash = await hashPassword(password);
      }
      await db.update(staffUsers).set(patch).where(and(eq(staffUsers.id, id), eq(staffUsers.tenantId, tenant.id)));
    } else {
      if (password.length < 8) return { ok: false, error: "weak_password" };
      const [dup] = await db.select({ id: staffUsers.id }).from(staffUsers).where(and(eq(staffUsers.tenantId, tenant.id), eq(staffUsers.email, email))).limit(1);
      if (dup) return { ok: false, error: "email_taken" };
      await db.insert(staffUsers).values({ tenantId: tenant.id, name, email, role: role === "owner" ? "admin" : role, permissions, passwordHash: await hashPassword(password) });
    }
    void me;
    reval(slug, "/dashboard/staff");
    return { ok: true };
  } catch (e) {
    return handleErr(e);
  }
}

export async function deleteStaff(slug: string, id: number): Promise<ActionResult> {
  try {
    const { tenant, staff: me } = await requireStaffAction(slug, "staff");
    const [target] = await db.select().from(staffUsers).where(and(eq(staffUsers.id, id), eq(staffUsers.tenantId, tenant.id))).limit(1);
    if (!target) return { ok: false, error: "not_found" };
    if (target.role === "owner") return { ok: false, error: "cannot_delete_owner" };
    if (target.id === me.id) return { ok: false, error: "forbidden" };
    await db.delete(staffUsers).where(and(eq(staffUsers.id, id), eq(staffUsers.tenantId, tenant.id)));
    reval(slug, "/dashboard/staff");
    return { ok: true };
  } catch (e) {
    return handleErr(e);
  }
}

/* =========================== ORDERS =========================== */
export async function updateOrderStatus(slug: string, orderId: number, status: OrderStatus): Promise<ActionResult> {
  try {
    const { tenant } = await requireStaffAction(slug, "orders");
    if (!ORDER_STATUSES.includes(status)) return { ok: false, error: "status" };
    const [existing] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.tenantId, tenant.id))).limit(1);
    if (!existing) return { ok: false, error: "not_found" };
    if (existing.status === "cancelled" && status !== "cancelled") return { ok: false, error: "status" };
    await db.update(orders).set({ status, updatedAt: new Date() }).where(and(eq(orders.id, orderId), eq(orders.tenantId, tenant.id)));
    if (status === "cancelled" && existing.status !== "cancelled") await restoreStockForOrder(tenant.id, orderId);
    reval(slug, "/dashboard/orders", "/dashboard");
    return { ok: true };
  } catch (e) {
    return handleErr(e);
  }
}

export async function updatePaymentStatus(slug: string, orderId: number, paymentStatus: "pending" | "paid" | "failed" | "refunded"): Promise<ActionResult> {
  try {
    const { tenant } = await requireStaffAction(slug, "orders");
    await db.update(orders).set({ paymentStatus, updatedAt: new Date() }).where(and(eq(orders.id, orderId), eq(orders.tenantId, tenant.id)));
    reval(slug, "/dashboard/orders");
    return { ok: true };
  } catch (e) {
    return handleErr(e);
  }
}

export async function sendToCarrier(slug: string, orderId: number, providerId: number): Promise<ActionResult<{ tracking?: string }>> {
  try {
    const { tenant } = await requireStaffAction(slug, "orders");
    const origin = await getRequestOrigin();
    const { tracking } = await dispatchShipment(tenant, orderId, providerId, origin);
    reval(slug, "/dashboard/orders");
    return { ok: true, tracking };
  } catch (e) {
    return handleErr(e) as ActionResult<{ tracking?: string }>;
  }
}

/* =========================== CUSTOMERS =========================== */
export async function searchCustomers(slug: string, q: string) {
  const { tenant } = await requireStaffAction(slug, "pos");
  const term = `%${q.trim()}%`;
  return db
    .select({ id: customers.id, name: customers.name, phone: customers.phone, email: customers.email })
    .from(customers)
    .where(and(eq(customers.tenantId, tenant.id), q.trim() ? or(ilike(customers.name, term), ilike(customers.phone, term), ilike(customers.email, term)) : sql`true`))
    .orderBy(desc(customers.createdAt))
    .limit(12);
}

export async function quickCreateCustomer(slug: string, data: { name: string; phone: string; email: string }): Promise<ActionResult<{ id?: number }>> {
  try {
    const { tenant } = await requireStaffAction(slug, "pos");
    const name = data.name.trim();
    if (!name) return { ok: false, error: "required" };
    const email = data.email.trim().toLowerCase() || `${randomCode(8)}@pos.local`;
    const [c] = await db
      .insert(customers)
      .values({ tenantId: tenant.id, name, phone: data.phone.trim(), email })
      .onConflictDoUpdate({ target: [customers.tenantId, customers.email], set: { name, phone: data.phone.trim() } })
      .returning({ id: customers.id });
    return { ok: true, id: c.id };
  } catch (e) {
    return handleErr(e) as ActionResult<{ id?: number }>;
  }
}

/* =========================== POS =========================== */
export type PosCheckoutPayload = {
  lines: { productId: number; qty: number; options?: Record<string, string> }[];
  paymentMethod: "cash" | "benefit" | "card" | "paypal";
  customerId: number | null;
  discount: number;
  notes: string;
  fulfillmentType?: "pickup" | "dine_in" | "delivery";
};

export async function posCheckout(slug: string, payload: PosCheckoutPayload) {
  try {
    const { tenant, staff } = await requireStaffAction(slug, "pos");
    let customer: { id: number; name: string; phone: string; email: string } | undefined;
    if (payload.customerId) {
      const [c] = await db.select().from(customers).where(and(eq(customers.id, payload.customerId), eq(customers.tenantId, tenant.id))).limit(1);
      if (c) customer = { id: c.id, name: c.name, phone: c.phone, email: c.email };
    }
    const ft = payload.fulfillmentType ?? (tenant.pickupEnabled ? "pickup" : tenant.dineInEnabled ? "dine_in" : "delivery");
    const posTenant = { ...tenant, pickupEnabled: true, dineInEnabled: true, deliveryEnabled: true, minOrder: "0" };
    const { order, items } = await createOrder({
      tenant: posTenant,
      lines: payload.lines,
      fulfillmentType: ft,
      paymentMethod: payload.paymentMethod,
      paymentStatus: "paid",
      source: "pos",
      customer,
      discount: payload.discount,
      notes: payload.notes,
      staffId: staff.id,
    });
    reval(slug, "/dashboard/orders", "/dashboard");
    return { ok: true as const, order, items, staffName: staff.name };
  } catch (e) {
    return handleErr(e) as { ok: false; error: string };
  }
}

export async function posProducts(slug: string) {
  const { tenant } = await requireStaffAction(slug, "pos");
  const [cats, prods] = await Promise.all([
    db.select().from(categories).where(and(eq(categories.tenantId, tenant.id), eq(categories.active, true))).orderBy(asc(categories.sort)),
    db.select().from(products).where(and(eq(products.tenantId, tenant.id), eq(products.active, true))).orderBy(asc(products.sort), asc(products.name)),
  ]);
  return { categories: cats, products: prods };
}

/* =========================== TABLES =========================== */
export async function saveTable(slug: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    const { tenant } = await requireStaffAction(slug, "tables");
    const id = num(fd, "id");
    const name = str(fd, "name");
    const seats = Math.max(1, Math.round(num(fd, "seats", 4)));
    if (!name) return { ok: false, error: "required" };
    if (id) await db.update(diningTables).set({ name, seats, active: fd.get("active") !== "off" }).where(and(eq(diningTables.id, id), eq(diningTables.tenantId, tenant.id)));
    else await db.insert(diningTables).values({ tenantId: tenant.id, name, seats, code: `${tenant.id}-${randomCode(10)}` });
    reval(slug, "/dashboard/tables");
    return { ok: true };
  } catch (e) {
    return handleErr(e);
  }
}

export async function deleteTable(slug: string, id: number): Promise<ActionResult> {
  try {
    const { tenant } = await requireStaffAction(slug, "tables");
    await db.delete(diningTables).where(and(eq(diningTables.id, id), eq(diningTables.tenantId, tenant.id)));
    reval(slug, "/dashboard/tables");
    return { ok: true };
  } catch (e) {
    return handleErr(e);
  }
}

export async function regenerateTableCode(slug: string, id: number): Promise<ActionResult> {
  try {
    const { tenant } = await requireStaffAction(slug, "tables");
    await db.update(diningTables).set({ code: `${tenant.id}-${randomCode(10)}` }).where(and(eq(diningTables.id, id), eq(diningTables.tenantId, tenant.id)));
    reval(slug, "/dashboard/tables");
    return { ok: true };
  } catch (e) {
    return handleErr(e);
  }
}

/* =========================== SETTINGS =========================== */
export async function saveSettings(slug: string, section: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    const { tenant } = await requireStaffAction(slug, "settings");
    const patch: Partial<typeof tenants.$inferInsert> = { updatedAt: new Date() };
    switch (section) {
      case "general": {
        patch.name = str(fd, "name") || tenant.name;
        patch.nameAr = str(fd, "nameAr") || patch.name;
        patch.description = str(fd, "description");
        patch.descriptionAr = str(fd, "descriptionAr");
        patch.email = str(fd, "email") || tenant.email;
        patch.phone = str(fd, "phone");
        patch.whatsapp = str(fd, "whatsapp");
        patch.address = str(fd, "address");
        const bt = str(fd, "businessType");
        if ((BUSINESS_TYPES as readonly string[]).includes(bt)) patch.businessType = bt;
        const cur = str(fd, "currency");
        if (isCurrency(cur)) patch.currency = cur;
        patch.taxRate = String(Math.min(100, Math.max(0, num(fd, "taxRate"))));
        patch.taxInclusive = fd.get("taxInclusive") === "on";
        break;
      }
      case "branding": {
        patch.templateId = getTemplate(num(fd, "templateId", tenant.templateId)).id;
        const hex = /^#[0-9a-fA-F]{6}$/;
        patch.primaryColor = hex.test(str(fd, "primaryColor")) ? str(fd, "primaryColor") : tenant.primaryColor;
        patch.secondaryColor = hex.test(str(fd, "secondaryColor")) ? str(fd, "secondaryColor") : tenant.secondaryColor;
        patch.backgroundColor = hex.test(str(fd, "backgroundColor")) ? str(fd, "backgroundColor") : tenant.backgroundColor;
        patch.typographyScale = String(Math.min(1.4, Math.max(0.8, num(fd, "typographyScale", 1))));
        patch.fontFamily = str(fd, "fontFamily") || "default";
        patch.logoUrl = str(fd, "logoUrl");
        patch.heroUrl = str(fd, "heroUrl");
        patch.heroTitle = str(fd, "heroTitle");
        patch.heroTitleAr = str(fd, "heroTitleAr");
        patch.heroSubtitle = str(fd, "heroSubtitle");
        patch.heroSubtitleAr = str(fd, "heroSubtitleAr");
        break;
      }
      case "template": {
        patch.templateId = getTemplate(num(fd, "templateId", tenant.templateId)).id;
        if (fd.get("resetColors") === "on") {
          const tpl = getTemplate(patch.templateId);
          patch.primaryColor = tpl.palette.primary;
          patch.secondaryColor = tpl.palette.secondary;
          patch.backgroundColor = tpl.palette.background;
        }
        break;
      }
      case "fulfillment": {
        patch.deliveryEnabled = fd.get("deliveryEnabled") === "on";
        patch.pickupEnabled = fd.get("pickupEnabled") === "on";
        patch.dineInEnabled = fd.get("dineInEnabled") === "on";
        patch.deliveryFee = String(Math.max(0, num(fd, "deliveryFee")));
        patch.minOrder = String(Math.max(0, num(fd, "minOrder")));
        break;
      }
      case "hours": {
        const hours: BusinessHour[] = Array.from({ length: 7 }, (_, day) => ({
          day,
          open: /^\d{2}:\d{2}$/.test(str(fd, `open_${day}`)) ? str(fd, `open_${day}`) : "09:00",
          close: /^\d{2}:\d{2}$/.test(str(fd, `close_${day}`)) ? str(fd, `close_${day}`) : "22:00",
          closed: fd.get(`closed_${day}`) === "on",
        }));
        patch.businessHours = hours;
        break;
      }
      case "payments": {
        const current: PaymentsConfig = { ...defaultPayments, ...(tenant.payments ?? {}) };
        const next: PaymentsConfig = {
          cash: { enabled: fd.get("cash_enabled") === "on" },
          benefit: {
            enabled: fd.get("benefit_enabled") === "on",
            tranportalId: str(fd, "benefit_tranportalId") || current.benefit.tranportalId,
            tranportalPassword: str(fd, "benefit_tranportalPassword") || current.benefit.tranportalPassword,
            resourceKey: str(fd, "benefit_resourceKey") || current.benefit.resourceKey,
          },
          card: {
            enabled: fd.get("card_enabled") === "on",
            provider: "stripe",
            publishableKey: str(fd, "card_publishableKey") || current.card.publishableKey,
            secretKey: str(fd, "card_secretKey") || current.card.secretKey,
          },
          paypal: {
            enabled: fd.get("paypal_enabled") === "on",
            clientId: str(fd, "paypal_clientId") || current.paypal.clientId,
            clientSecret: str(fd, "paypal_clientSecret") || current.paypal.clientSecret,
            sandbox: fd.get("paypal_sandbox") === "on",
          },
        };
        if (next.benefit.enabled && (!next.benefit.tranportalId || !next.benefit.tranportalPassword || !next.benefit.resourceKey)) return { ok: false, error: "payment_benefit" };
        if (next.card.enabled && !next.card.secretKey) return { ok: false, error: "payment_card" };
        if (next.paypal.enabled && (!next.paypal.clientId || !next.paypal.clientSecret)) return { ok: false, error: "payment_paypal" };
        if (!next.cash.enabled && !next.benefit.enabled && !next.card.enabled && !next.paypal.enabled) next.cash.enabled = true;
        patch.payments = next;
        break;
      }
      case "shipping": {
        const providerId = num(fd, "providerId");
        const [provider] = await db.select().from(shippingProviders).where(eq(shippingProviders.id, providerId)).limit(1);
        if (!provider) return { ok: false, error: "not_found" };
        const [binding] = await db
          .select()
          .from(tenantShippingProviders)
          .where(and(eq(tenantShippingProviders.tenantId, tenant.id), eq(tenantShippingProviders.providerId, providerId)))
          .limit(1);
        if (!binding || !binding.enabledByAdmin) return { ok: false, error: "disabled_by_admin" };
        const credentials: Record<string, string> = { ...binding.credentials };
        for (const f of provider.configSchema) {
          const v = str(fd, `cred_${f.key}`);
          if (v || f.type !== "password") credentials[f.key] = v || credentials[f.key] || "";
        }
        const active = fd.get("active") === "on";
        const missing = provider.configSchema.filter((f) => f.required && !credentials[f.key]);
        if (active && missing.length) return { ok: false, error: "required" };
        await db.update(tenantShippingProviders).set({ credentials, active }).where(eq(tenantShippingProviders.id, binding.id));
        reval(slug, "/dashboard/settings", "/dashboard/orders");
        return { ok: true };
      }
      default:
        return { ok: false, error: "not_found" };
    }
    await db.update(tenants).set(patch).where(eq(tenants.id, tenant.id));
    reval(slug, "/dashboard/settings", "/dashboard", "", "/checkout", "/cart");
    return { ok: true };
  } catch (e) {
    return handleErr(e);
  }
}

/* =========================== SUBSCRIPTION =========================== */
export async function requestRenewal(slug: string, planId: number, period: "monthly" | "yearly"): Promise<ActionResult> {
  try {
    const tenant = await getTenantBySlug(slug);
    if (!tenant) return { ok: false, error: "store_not_found" };
    const staff = await getStaffSession(tenant.id);
    if (!staff) return { ok: false, error: "invalid_credentials" };
    if (staff.role !== "owner" && staff.role !== "admin") return { ok: false, error: "forbidden" };
    const [plan] = await db.select().from(plans).where(and(eq(plans.id, planId), eq(plans.active, true))).limit(1);
    if (!plan) return { ok: false, error: "not_found" };
    const [pendingInv] = await db
      .select({ id: subscriptionInvoices.id })
      .from(subscriptionInvoices)
      .where(and(eq(subscriptionInvoices.tenantId, tenant.id), eq(subscriptionInvoices.status, "pending")))
      .limit(1);
    if (pendingInv) return { ok: false, error: "renewal_pending" };
    await db.insert(subscriptionInvoices).values({
      tenantId: tenant.id,
      planId: plan.id,
      period,
      amount: period === "yearly" ? plan.yearlyPrice : plan.monthlyPrice,
      currency: plan.currency,
      status: "pending",
      method: "bank_transfer",
    });
    reval(slug, "/dashboard/subscription");
    revalidatePath("/admin/invoices");
    return { ok: true };
  } catch (e) {
    return handleErr(e);
  }
}

/* =========================== DATA HELPERS (dashboard pages) =========================== */
export async function ordersFeed(slug: string, status?: string) {
  const { tenant } = await requireStaffAction(slug, "orders");
  const where = status && ORDER_STATUSES.includes(status as OrderStatus) ? and(eq(orders.tenantId, tenant.id), eq(orders.status, status)) : eq(orders.tenantId, tenant.id);
  const list = await db.select().from(orders).where(where).orderBy(desc(orders.createdAt)).limit(200);
  const ids = list.map((o) => o.id);
  const items = ids.length ? await db.select().from(orderItems).where(and(eq(orderItems.tenantId, tenant.id), inArray(orderItems.orderId, ids))) : [];
  const grouped = new Map<number, typeof items>();
  for (const it of items) grouped.set(it.orderId, [...(grouped.get(it.orderId) ?? []), it]);
  return list.map((o) => ({ ...o, items: grouped.get(o.id) ?? [], total: toNum(o.total) }));
}

