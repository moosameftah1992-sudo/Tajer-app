"use server";

import { db } from "@/db";
import {
  tenants,
  domains,
  staffUsers,
  platformAdmins,
  plans,
  shippingProviders,
  tenantShippingProviders,
  subscriptionInvoices,
  platformSettings,
  type ProviderField,
} from "@/db/schema";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  ADMIN_COOKIE,
  STAFF_COOKIE,
  hashPassword,
  verifyPassword,
  signSession,
  setSessionCookie,
  clearSessionCookie,
} from "@/lib/auth";
import { getPlatformSettings, requireAdminAction, rootDomain, AuthError } from "@/lib/tenant";
import { PERMISSIONS, ADMIN_ROLE_PRESETS, ADMIN_PERMISSIONS, type AdminRole } from "@/lib/permissions";
import { isValidSlug, isCurrency, slugify, addDays, randomCode, BUSINESS_TYPES } from "@/lib/utils";
import { getTemplate, TEMPLATE_FOR_BUSINESS } from "@/lib/templates";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type ActionResult<T extends object = {}> = ({ ok: true } & T) | { ok: false; error: string };

function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function handleErr(e: unknown): ActionResult {
  if (e instanceof AuthError) return { ok: false, error: e.code === "locked" ? "subscription_expired_title" : "forbidden" };
  console.error(e);
  return { ok: false, error: "error_generic" };
}

/* =========================== ONBOARDING =========================== */
export async function registerStore(
  _prev: ActionResult<{ slug?: string; trialEndsAt?: string }> | null,
  fd: FormData,
): Promise<ActionResult<{ slug?: string; trialEndsAt?: string }>> {
  const name = str(fd, "name");
  const nameAr = str(fd, "nameAr") || name;
  const slug = slugify(str(fd, "slug") || name);
  const businessType = str(fd, "businessType");
  const ownerName = str(fd, "ownerName");
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  const phone = str(fd, "phone");
  const currency = str(fd, "currency") || "BHD";
  const country = str(fd, "country") || "BH";
  const templateIdRaw = Number(str(fd, "templateId"));

  if (!name || !ownerName || !email) return { ok: false, error: "required" };
  if (!isValidSlug(slug)) return { ok: false, error: "invalid_slug" };
  if (password.length < 8) return { ok: false, error: "weak_password" };
  if (!isCurrency(currency)) return { ok: false, error: "currency" };
  const bt = (BUSINESS_TYPES as readonly string[]).includes(businessType) ? businessType : "general";
  const templateId = templateIdRaw > 0 ? templateIdRaw : TEMPLATE_FOR_BUSINESS[bt] ?? 1;
  const tpl = getTemplate(templateId);

  const [exists] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (exists) return { ok: false, error: "slug_taken" };

  const settings = await getPlatformSettings();
  const now = new Date();
  const trialEndsAt = addDays(now, settings.trialDays || 30);
  const passwordHash = await hashPassword(password);
  const root = rootDomain();

  let tenantId = 0;
  let staffId = 0;
  await db.transaction(async (tx) => {
    const [tenant] = await tx
      .insert(tenants)
      .values({
        slug,
        name,
        nameAr,
        businessType: bt,
        email,
        phone,
        country,
        currency,
        templateId: tpl.id,
        primaryColor: tpl.palette.primary,
        secondaryColor: tpl.palette.secondary,
        backgroundColor: tpl.palette.background,
        heroTitle: name,
        heroTitleAr: nameAr,
        dineInEnabled: bt === "restaurant" || bt === "cafe",
        billingCycle: "trial",
        trialEndsAt,
        subscriptionEndsAt: trialEndsAt,
      })
      .returning({ id: tenants.id });
    tenantId = tenant.id;
    await tx.insert(domains).values({
      tenantId,
      host: root ? `${slug}.${root}` : slug,
      type: "subdomain",
      verified: true,
      isPrimary: true,
    });
    const [owner] = await tx
      .insert(staffUsers)
      .values({ tenantId, name: ownerName, email, passwordHash, role: "owner", permissions: [...PERMISSIONS], lastLoginAt: now })
      .returning({ id: staffUsers.id });
    staffId = owner.id;
    const providers = await tx.select({ id: shippingProviders.id }).from(shippingProviders).where(eq(shippingProviders.active, true));
    if (providers.length) {
      await tx.insert(tenantShippingProviders).values(providers.map((p) => ({ tenantId, providerId: p.id, enabledByAdmin: true, active: false })));
    }
  });

  const token = await signSession({ kind: "staff", id: staffId, tenantId });
  await setSessionCookie(STAFF_COOKIE, token);
  return { ok: true, slug, trialEndsAt: trialEndsAt.toISOString() };
}

export async function checkSlugAvailable(raw: string): Promise<{ slug: string; available: boolean }> {
  const slug = slugify(raw);
  if (!isValidSlug(slug)) return { slug, available: false };
  const [exists] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, slug)).limit(1);
  return { slug, available: !exists };
}

/* =========================== MERCHANT LOGIN (platform) =========================== */
export type MerchantLoginState = ActionResult<{ stores?: { slug: string; name: string; nameAr: string }[] }> | null;

export async function merchantLogin(_prev: MerchantLoginState, fd: FormData): Promise<MerchantLoginState> {
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  const chosenSlug = str(fd, "slug");
  if (!email || !password) return { ok: false, error: "required" };

  const rows = await db
    .select({ staff: staffUsers, tenant: { id: tenants.id, slug: tenants.slug, name: tenants.name, nameAr: tenants.nameAr } })
    .from(staffUsers)
    .innerJoin(tenants, eq(tenants.id, staffUsers.tenantId))
    .where(and(eq(staffUsers.email, email), eq(staffUsers.active, true)));

  const matches: typeof rows = [];
  for (const r of rows) {
    if (await verifyPassword(password, r.staff.passwordHash)) matches.push(r);
  }
  if (!matches.length) return { ok: false, error: "invalid_credentials" };
  const target = chosenSlug ? matches.find((m) => m.tenant.slug === chosenSlug) : matches.length === 1 ? matches[0] : null;
  if (!target) return { ok: true, stores: matches.map((m) => m.tenant) };

  await db.update(staffUsers).set({ lastLoginAt: new Date() }).where(eq(staffUsers.id, target.staff.id));
  const token = await signSession({ kind: "staff", id: target.staff.id, tenantId: target.tenant.id });
  await setSessionCookie(STAFF_COOKIE, token);
  redirect(`/s/${target.tenant.slug}/dashboard`);
}

/* =========================== SUPER ADMIN AUTH =========================== */
export async function adminCount() {
  const [{ value }] = await db.select({ value: count() }).from(platformAdmins);
  return value;
}

export async function adminSetup(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const n = await adminCount();
  if (n > 0) return { ok: false, error: "forbidden" };
  const name = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  if (!name || !email) return { ok: false, error: "required" };
  if (password.length < 8) return { ok: false, error: "weak_password" };
  const [admin] = await db
    .insert(platformAdmins)
    .values({ name, email, passwordHash: await hashPassword(password), role: "super", permissions: [...ADMIN_PERMISSIONS], lastLoginAt: new Date() })
    .returning({ id: platformAdmins.id });
  await setSessionCookie(ADMIN_COOKIE, await signSession({ kind: "admin", id: admin.id }, 7), 7);
  redirect("/admin");
}

export async function adminLogin(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  const [admin] = await db.select().from(platformAdmins).where(eq(platformAdmins.email, email)).limit(1);
  if (!admin || !admin.active || !(await verifyPassword(password, admin.passwordHash))) return { ok: false, error: "invalid_credentials" };
  await db.update(platformAdmins).set({ lastLoginAt: new Date() }).where(eq(platformAdmins.id, admin.id));
  await setSessionCookie(ADMIN_COOKIE, await signSession({ kind: "admin", id: admin.id }, 7), 7);
  redirect("/admin");
}

export async function adminLogout() {
  await clearSessionCookie(ADMIN_COOKIE);
  redirect("/admin/login");
}

/* =========================== PLATFORM ADMINS CRUD =========================== */
export async function saveAdmin(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    await requireAdminAction("admins");
    const id = Number(str(fd, "id")) || 0;
    const name = str(fd, "name");
    const email = str(fd, "email").toLowerCase();
    const password = str(fd, "password");
    const role = (str(fd, "role") || "manager") as AdminRole;
    const permissions = ADMIN_PERMISSIONS.filter((p) => fd.get(`perm_${p}`) === "on");
    const perms = role === "super" ? [...ADMIN_PERMISSIONS] : permissions.length ? permissions : ADMIN_ROLE_PRESETS[role] ?? [];
    if (!name || !email) return { ok: false, error: "required" };
    if (id) {
      const patch: Partial<typeof platformAdmins.$inferInsert> = { name, email, role, permissions: perms, active: fd.get("active") !== "off" };
      if (password) {
        if (password.length < 8) return { ok: false, error: "weak_password" };
        patch.passwordHash = await hashPassword(password);
      }
      await db.update(platformAdmins).set(patch).where(eq(platformAdmins.id, id));
    } else {
      if (password.length < 8) return { ok: false, error: "weak_password" };
      const [dup] = await db.select({ id: platformAdmins.id }).from(platformAdmins).where(eq(platformAdmins.email, email)).limit(1);
      if (dup) return { ok: false, error: "email_taken" };
      await db.insert(platformAdmins).values({ name, email, role, permissions: perms, passwordHash: await hashPassword(password) });
    }
    revalidatePath("/admin/admins");
    return { ok: true };
  } catch (e) {
    return handleErr(e);
  }
}

export async function deleteAdmin(id: number): Promise<ActionResult> {
  try {
    const me = await requireAdminAction("admins");
    if (me.id === id) return { ok: false, error: "forbidden" };
    await db.delete(platformAdmins).where(eq(platformAdmins.id, id));
    revalidatePath("/admin/admins");
    return { ok: true };
  } catch (e) {
    return handleErr(e);
  }
}

/* =========================== PLANS =========================== */
export async function savePlan(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    await requireAdminAction("plans");
    const id = Number(str(fd, "id")) || 0;
    const values = {
      name: str(fd, "name"),
      nameAr: str(fd, "nameAr") || str(fd, "name"),
      monthlyPrice: String(Math.max(0, Number(str(fd, "monthlyPrice")) || 0)),
      yearlyPrice: String(Math.max(0, Number(str(fd, "yearlyPrice")) || 0)),
      currency: isCurrency(str(fd, "currency")) ? str(fd, "currency") : "USD",
      features: str(fd, "features").split("\n").map((s) => s.trim()).filter(Boolean),
      featuresAr: str(fd, "featuresAr").split("\n").map((s) => s.trim()).filter(Boolean),
      active: fd.get("active") === "on",
      sort: Number(str(fd, "sort")) || 0,
    };
    if (!values.name) return { ok: false, error: "required" };
    if (id) await db.update(plans).set(values).where(eq(plans.id, id));
    else await db.insert(plans).values(values);
    revalidatePath("/admin/plans");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return handleErr(e);
  }
}

export async function deletePlan(id: number): Promise<ActionResult> {
  try {
    await requireAdminAction("plans");
    await db.update(plans).set({ active: false }).where(eq(plans.id, id));
    revalidatePath("/admin/plans");
    return { ok: true };
  } catch (e) {
    return handleErr(e);
  }
}

/* =========================== MERCHANT CONTROL =========================== */
export async function updateTenantSubscription(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    await requireAdminAction("merchants");
    const tenantId = Number(str(fd, "tenantId"));
    const mode = str(fd, "mode");
    const [t] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    if (!t) return { ok: false, error: "not_found" };
    const patch: Partial<typeof tenants.$inferInsert> = { updatedAt: new Date() };
    const base = new Date(Math.max(new Date(t.subscriptionEndsAt).getTime(), Date.now()));
    if (mode === "extend30") patch.subscriptionEndsAt = addDays(base, 30);
    else if (mode === "extend365") patch.subscriptionEndsAt = addDays(base, 365);
    else if (mode === "date") {
      const d = new Date(str(fd, "date"));
      if (Number.isNaN(d.getTime())) return { ok: false, error: "date" };
      patch.subscriptionEndsAt = d;
    } else if (mode === "plan") {
      const planId = Number(str(fd, "planId")) || null;
      const cycle = str(fd, "billingCycle");
      patch.planId = planId;
      if (["trial", "monthly", "yearly"].includes(cycle)) patch.billingCycle = cycle;
    } else if (mode === "status") {
      patch.status = str(fd, "status") === "suspended" ? "suspended" : "active";
    } else if (mode === "template") {
      patch.templateId = getTemplate(Number(str(fd, "templateId"))).id;
    } else if (mode === "currency") {
      const c = str(fd, "currency");
      if (!isCurrency(c)) return { ok: false, error: "currency" };
      patch.currency = c;
    }
    await db.update(tenants).set(patch).where(eq(tenants.id, tenantId));
    revalidatePath(`/admin/merchants/${tenantId}`);
    revalidatePath("/admin/merchants");
    return { ok: true };
  } catch (e) {
    return handleErr(e);
  }
}

export async function addTenantDomain(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    await requireAdminAction("merchants");
    const tenantId = Number(str(fd, "tenantId"));
    const host = str(fd, "host").toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return { ok: false, error: "domain_hint" };
    const [dup] = await db.select({ id: domains.id }).from(domains).where(eq(domains.host, host)).limit(1);
    if (dup) return { ok: false, error: "slug_taken" };
    const isPrimary = fd.get("isPrimary") === "on";
    if (isPrimary) await db.update(domains).set({ isPrimary: false }).where(and(eq(domains.tenantId, tenantId), eq(domains.type, "custom")));
    await db.insert(domains).values({ tenantId, host, type: "custom", verified: fd.get("verified") !== "off", isPrimary });
    revalidatePath(`/admin/merchants/${tenantId}`);
    return { ok: true };
  } catch (e) {
    return handleErr(e);
  }
}

export async function removeTenantDomain(id: number, tenantId: number): Promise<ActionResult> {
  try {
    await requireAdminAction("merchants");
    await db.delete(domains).where(and(eq(domains.id, id), eq(domains.tenantId, tenantId), eq(domains.type, "custom")));
    revalidatePath(`/admin/merchants/${tenantId}`);
    return { ok: true };
  } catch (e) {
    return handleErr(e);
  }
}

/* =========================== LOGISTICS HUB =========================== */
export async function saveProvider(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    await requireAdminAction("logistics");
    const id = Number(str(fd, "id")) || 0;
    const code = slugify(str(fd, "code") || str(fd, "name"));
    if (!code) return { ok: false, error: "required" };
    let schema: ProviderField[] = [];
    try {
      const parsed = JSON.parse(str(fd, "configSchema") || "[]");
      if (Array.isArray(parsed)) {
        schema = parsed
          .filter((f) => f && typeof f.key === "string" && f.key.trim())
          .map((f) => ({
            key: String(f.key).trim(),
            label: String(f.label ?? f.key),
            labelAr: String(f.labelAr ?? f.label ?? f.key),
            type: f.type === "password" || f.type === "number" ? f.type : "text",
            required: Boolean(f.required),
          }));
      }
    } catch {
      return { ok: false, error: "config_schema" };
    }
    const values = {
      name: str(fd, "name"),
      nameAr: str(fd, "nameAr") || str(fd, "name"),
      code,
      webhookUrl: str(fd, "webhookUrl"),
      authHeader: str(fd, "authHeader") || "Authorization",
      outboundSecret: str(fd, "outboundSecret"),
      configSchema: schema,
      defaultFee: String(Math.max(0, Number(str(fd, "defaultFee")) || 0)),
      trackingUrlTemplate: str(fd, "trackingUrlTemplate"),
      active: fd.get("active") === "on",
    };
    if (!values.name) return { ok: false, error: "required" };
    if (id) {
      const inbound = str(fd, "inboundSecret");
      await db.update(shippingProviders).set(inbound ? { ...values, inboundSecret: inbound } : values).where(eq(shippingProviders.id, id));
    } else {
      const [dup] = await db.select({ id: shippingProviders.id }).from(shippingProviders).where(eq(shippingProviders.code, code)).limit(1);
      if (dup) return { ok: false, error: "slug_taken" };
      const [p] = await db
        .insert(shippingProviders)
        .values({ ...values, inboundSecret: str(fd, "inboundSecret") || randomCode(32) })
        .returning({ id: shippingProviders.id });
      // cascade to every tenant
      const all = await db.select({ id: tenants.id }).from(tenants);
      if (all.length) {
        await db
          .insert(tenantShippingProviders)
          .values(all.map((t) => ({ tenantId: t.id, providerId: p.id, enabledByAdmin: true, active: false })))
          .onConflictDoNothing();
      }
    }
    revalidatePath("/admin/logistics");
    return { ok: true };
  } catch (e) {
    return handleErr(e);
  }
}

export async function deleteProvider(id: number): Promise<ActionResult> {
  try {
    await requireAdminAction("logistics");
    await db.delete(tenantShippingProviders).where(eq(tenantShippingProviders.providerId, id));
    await db.delete(shippingProviders).where(eq(shippingProviders.id, id));
    revalidatePath("/admin/logistics");
    return { ok: true };
  } catch (e) {
    return handleErr(e);
  }
}

export async function toggleTenantProvider(tenantId: number, providerId: number, enabled: boolean): Promise<ActionResult> {
  try {
    await requireAdminAction("logistics");
    await db
      .insert(tenantShippingProviders)
      .values({ tenantId, providerId, enabledByAdmin: enabled, active: false })
      .onConflictDoUpdate({
        target: [tenantShippingProviders.tenantId, tenantShippingProviders.providerId],
        set: { enabledByAdmin: enabled, ...(enabled ? {} : { active: false }) },
      });
    revalidatePath(`/admin/merchants/${tenantId}`);
    revalidatePath("/admin/logistics");
    return { ok: true };
  } catch (e) {
    return handleErr(e);
  }
}

/* =========================== BILLING =========================== */
export async function settleInvoice(id: number, action: "paid" | "cancelled"): Promise<ActionResult> {
  try {
    await requireAdminAction("billing");
    const [inv] = await db.select().from(subscriptionInvoices).where(eq(subscriptionInvoices.id, id)).limit(1);
    if (!inv || inv.status !== "pending") return { ok: false, error: "not_found" };
    if (action === "cancelled") {
      await db.update(subscriptionInvoices).set({ status: "cancelled" }).where(eq(subscriptionInvoices.id, id));
    } else {
      await db.transaction(async (tx) => {
        await tx.update(subscriptionInvoices).set({ status: "paid", paidAt: new Date() }).where(eq(subscriptionInvoices.id, id));
        const [t] = await tx.select().from(tenants).where(eq(tenants.id, inv.tenantId)).limit(1);
        if (t) {
          const base = new Date(Math.max(new Date(t.subscriptionEndsAt).getTime(), Date.now()));
          await tx
            .update(tenants)
            .set({ subscriptionEndsAt: addDays(base, inv.period === "yearly" ? 365 : 30), planId: inv.planId, billingCycle: inv.period, status: "active", updatedAt: new Date() })
            .where(eq(tenants.id, t.id));
        }
      });
    }
    revalidatePath("/admin/invoices");
    revalidatePath("/admin/merchants");
    return { ok: true };
  } catch (e) {
    return handleErr(e);
  }
}

export async function savePlatformSettings(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    await requireAdminAction("settings");
    const s = await getPlatformSettings();
    await db
      .update(platformSettings)
      .set({
        commissionRate: String(Math.min(100, Math.max(0, Number(str(fd, "commissionRate")) || 0))),
        trialDays: Math.max(1, Number(str(fd, "trialDays")) || 30),
        supportEmail: str(fd, "supportEmail") || s.supportEmail,
        bankDetails: str(fd, "bankDetails"),
        updatedAt: new Date(),
      })
      .where(eq(platformSettings.id, s.id));
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return handleErr(e);
  }
}

/* =========================== HELPERS FOR ADMIN VIEWS =========================== */
export async function tenantsWithProviders(providerIds: number[]) {
  if (!providerIds.length) return [];
  return db
    .select({ tenantId: tenantShippingProviders.tenantId, providerId: tenantShippingProviders.providerId, enabledByAdmin: tenantShippingProviders.enabledByAdmin })
    .from(tenantShippingProviders)
    .where(inArray(tenantShippingProviders.providerId, providerIds));
}

export async function platformStats() {
  const now = new Date();
  const [{ total }] = await db.select({ total: count() }).from(tenants);
  const [{ active }] = await db
    .select({ active: count() })
    .from(tenants)
    .where(and(sql`${tenants.subscriptionEndsAt} > now()`, eq(tenants.status, "active"), sql`${tenants.billingCycle} <> 'trial'`));
  const [{ trial }] = await db
    .select({ trial: count() })
    .from(tenants)
    .where(and(sql`${tenants.subscriptionEndsAt} > now()`, eq(tenants.billingCycle, "trial")));
  const [{ expired }] = await db.select({ expired: count() }).from(tenants).where(sql`${tenants.subscriptionEndsAt} <= now()`);
  void now;
  return { total, active, trial, expired };
}
