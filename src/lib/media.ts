import "server-only";
import path from "node:path";
import { promises as fs } from "node:fs";

export const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

export function tenantDir(tenantId: number) {
  return path.join(UPLOAD_ROOT, String(tenantId));
}

export async function ensureTenantDir(tenantId: number) {
  const dir = tenantDir(tenantId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

export async function removeStoredFile(storagePath: string) {
  const abs = path.join(UPLOAD_ROOT, storagePath);
  if (!abs.startsWith(UPLOAD_ROOT)) return;
  try {
    await fs.unlink(abs);
  } catch {
    /* file already gone */
  }
}

export function publicMediaUrl(storagePath: string) {
  return `/api/media/${storagePath.split(path.sep).join("/")}`;
}
