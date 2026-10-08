import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { tenants, plans, platformSettings, domains, type Tenant } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { getStaffSession, getAdminSession } from "./auth";
import { hasPermission, adminHas, type Permission, type AdminPermission } from "./permissions";
import { daysBetween } from "./utils";

export const getTenantBySlug = cache(async (slug: string): Promise<Tenant | null> => {
  const [t] = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
  return t ?? null;
});

export const getTenantById = cache(async (id: number): Promise<Tenant | null> => {
  const [t] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  return t ?? null;
});

/** Base path for links: "" when served on the store's own host, "/s/<slug>" when path-routed. */
export async function getStoreBase(slug: string) {
  const h = await headers();
  return h.get("x-tenant-mode") === "host" ? "" : `/s/${slug}`;
}

export async function getRequestOrigin() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export function rootDomain() {
  return (process.env.NEXT_PUBLIC_ROOT_DOMAIN || process.env.ROOT_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** Public absolute URL of a store (subdomain when a root domain is configured). */
export async function publicStoreUrl(slug: string) {
  const root = rootDomain();
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (root) {
    const tenant = await getTenantBySlug(slug);
    if (tenant) {
      const [primary] = await db
        .select({ host: domains.host })
        .from(domains)
        .where(and(eq(domains.tenantId, tenant.id), eq(domains.type, "custom"), eq(domains.verified, true), eq(domains.isPrimary, true)))
        .limit(1);
      if (primary) return `${proto}://${primary.host}`;
    }
    return `${proto}://${slug}.${root}`;
  }
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}/s/${slug}`;
}

export function subscriptionState(t: Pick<Tenant, "subscriptionEndsAt" | "trialEndsAt" | "billingCycle" | "status">) {
  const now = new Date();
  const ends = new Date(t.subscriptionEndsAt);
  const expired = ends.getTime() <= now.getTime();
  const suspended = t.status === "suspended";
  return {
    active: !expired && !suspended,
    expired,
    suspended,
    isTrial: t.billingCycle === "trial",
    daysLeft: Math.max(0, daysBetween(now, ends)),
    endsAt: ends,
  };
}

export class AuthError extends Error {
  constructor(public code: "unauthenticated" | "forbidden" | "locked") {
    super(code);
  }
}

/** For server components: redirects. */
export async function requireStaffPage(slug: string, perm?: Permission, opts?: { allowLocked?: boolean }) {
  const tenant = await getTenantBySlug(slug);
  if (!tenant) redirect("/");
  const base = await getStoreBase(slug);
  const staff = await getStaffSession(tenant.id);
  if (!staff) redirect(`${base}/dashboard/login`);
  const sub = subscriptionState(tenant);
  if (!sub.active && !opts?.allowLocked) redirect(`${base}/dashboard/subscription`);
  if (perm && !hasPermission(staff.permissions, staff.role, perm)) redirect(`${base}/dashboard?forbidden=1`);
  return { tenant, staff, base, sub };
}

/** For server actions / route handlers: throws. */
export async function requireStaffAction(slug: string, perm?: Permission, opts?: { allowLocked?: boolean }) {
  const tenant = await getTenantBySlug(slug);
  if (!tenant) throw new AuthError("unauthenticated");
  const staff = await getStaffSession(tenant.id);
  if (!staff) throw new AuthError("unauthenticated");
  const sub = subscriptionState(tenant);
  if (!sub.active && !opts?.allowLocked) throw new AuthError("locked");
  if (perm && !hasPermission(staff.permissions, staff.role, perm)) throw new AuthError("forbidden");
  return { tenant, staff, sub };
}

export async function requireAdminPage(perm?: AdminPermission) {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin/login");
  if (perm && !adminHas(admin.permissions, admin.role, perm)) redirect("/admin?forbidden=1");
  return admin;
}

export async function requireAdminAction(perm?: AdminPermission) {
  const admin = await getAdminSession();
  if (!admin) throw new AuthError("unauthenticated");
  if (perm && !adminHas(admin.permissions, admin.role, perm)) throw new AuthError("forbidden");
  return admin;
}

/* ---------- Platform defaults ---------- */
export const getPlatformSettings = cache(async () => {
  const [row] = await db.select().from(platformSettings).orderBy(asc(platformSettings.id)).limit(1);
  if (row) return row;
  const [created] = await db.insert(platformSettings).values({}).returning();
  return created;
});

export const getActivePlans = cache(async () => {
  const rows = await db.select().from(plans).where(eq(plans.active, true)).orderBy(asc(plans.sort), asc(plans.id));
  if (rows.length) return rows;
  const existing = await db.select({ id: plans.id }).from(plans).limit(1);
  if (existing.length) return rows;
  const inserted = await db
    .insert(plans)
    .values([
      {
        name: "Starter",
        nameAr: "الأساسية",
        monthlyPrice: "15",
        yearlyPrice: "150",
        currency: "USD",
        features: ["Storefront on your own link", "Cloud POS", "Unlimited products", "Media library", "Basic reports"],
        featuresAr: ["متجر على رابطك الخاص", "نقطة بيع سحابية", "منتجات غير محدودة", "مكتبة الوسائط", "تقارير أساسية"],
        sort: 1,
      },
      {
        name: "Growth",
        nameAr: "النمو",
        monthlyPrice: "35",
        yearlyPrice: "350",
        currency: "USD",
        features: ["Everything in Starter", "Advanced reports & exports", "Unlimited staff accounts", "QR dine-in tables", "All payment gateways"],
        featuresAr: ["كل ما في الأساسية", "تقارير متقدمة وتصدير", "حسابات موظفين غير محدودة", "طاولات QR للطلب الداخلي", "جميع بوابات الدفع"],
        sort: 2,
      },
      {
        name: "Enterprise",
        nameAr: "المؤسسات",
        monthlyPrice: "79",
        yearlyPrice: "790",
        currency: "USD",
        features: ["Everything in Growth", "Custom domain", "Logistics integrations", "Priority support", "Multi-branch ready"],
        featuresAr: ["كل ما في النمو", "نطاق مخصص", "تكاملات الشحن", "دعم ذو أولوية", "جاهز لتعدد الفروع"],
        sort: 3,
      },
    ])
    .returning();
  return inserted;
});

export async function mustTenant(slug: string): Promise<Tenant> {
  const t = await getTenantBySlug(slug);
  if (!t) notFound();
  return t;
}
