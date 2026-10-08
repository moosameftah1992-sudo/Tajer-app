import "server-only";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { db } from "@/db";
import { platformAdmins, staffUsers, customers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { cache } from "react";

export const ADMIN_COOKIE = "tajer_admin";
export const STAFF_COOKIE = "tajer_staff";
export const CUSTOMER_COOKIE = "tajer_customer";

function secret() {
  const s = process.env.AUTH_SECRET || createHash("sha256").update(`tajer::${process.env.DATABASE_URL ?? ""}`).digest("hex");
  return new TextEncoder().encode(s);
}

export type SessionPayload = {
  kind: "admin" | "staff" | "customer";
  id: number;
  tenantId?: number;
};

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string) {
  if (!hash) return false;
  return bcrypt.compare(pw, hash);
}

export async function signSession(payload: SessionPayload, days = 14) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(secret());
}

export async function readSession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload || typeof payload.id !== "number" || typeof payload.kind !== "string") return null;
    return {
      kind: payload.kind as SessionPayload["kind"],
      id: payload.id,
      tenantId: typeof payload.tenantId === "number" ? payload.tenantId : undefined,
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(name: string, token: string, days = 14) {
  const store = await cookies();
  store.set(name, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: days * 86400,
  });
}

export async function clearSessionCookie(name: string) {
  const store = await cookies();
  store.set(name, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/* ---------- Session readers (request-cached) ---------- */
export const getAdminSession = cache(async () => {
  const store = await cookies();
  const s = await readSession(store.get(ADMIN_COOKIE)?.value);
  if (!s || s.kind !== "admin") return null;
  const [admin] = await db.select().from(platformAdmins).where(eq(platformAdmins.id, s.id)).limit(1);
  if (!admin || !admin.active) return null;
  return admin;
});

export const getStaffSession = cache(async (tenantId: number) => {
  const store = await cookies();
  const s = await readSession(store.get(STAFF_COOKIE)?.value);
  if (!s || s.kind !== "staff" || s.tenantId !== tenantId) return null;
  const [staff] = await db
    .select()
    .from(staffUsers)
    .where(and(eq(staffUsers.id, s.id), eq(staffUsers.tenantId, tenantId)))
    .limit(1);
  if (!staff || !staff.active) return null;
  return staff;
});

export const getCustomerSession = cache(async (tenantId: number) => {
  const store = await cookies();
  const s = await readSession(store.get(CUSTOMER_COOKIE)?.value);
  if (!s || s.kind !== "customer" || s.tenantId !== tenantId) return null;
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, s.id), eq(customers.tenantId, tenantId)))
    .limit(1);
  return customer ?? null;
});
