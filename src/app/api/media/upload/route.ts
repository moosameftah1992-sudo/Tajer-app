import { NextResponse, type NextRequest } from "next/server";
import path from "node:path";
import { promises as fs } from "node:fs";
import sharp from "sharp";
import { db } from "@/db";
import { mediaFiles, mediaFolders } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireStaffAction, AuthError } from "@/lib/tenant";
import { ensureTenantDir, safeFileName, publicMediaUrl } from "@/lib/media";
import { randomCode } from "@/lib/utils";

export const dynamic = "force-dynamic";
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/heic", "image/heif"]);

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const slug = String(form.get("slug") ?? "");
    const folderRaw = Number(form.get("folderId"));
    const { tenant } = await requireStaffAction(slug, "media");
    let folderId: number | null = Number.isInteger(folderRaw) && folderRaw > 0 ? folderRaw : null;
    if (folderId) {
      const [f] = await db.select({ id: mediaFolders.id }).from(mediaFolders).where(and(eq(mediaFolders.id, folderId), eq(mediaFolders.tenantId, tenant.id))).limit(1);
      if (!f) folderId = null;
    }
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (!files.length) return NextResponse.json({ ok: false, error: "required" }, { status: 400 });
    const dir = await ensureTenantDir(tenant.id);
    const saved = [];
    for (const file of files.slice(0, 20)) {
      if (!ALLOWED.has(file.type) || file.size > MAX_BYTES) continue;
      const input = Buffer.from(await file.arrayBuffer());
      const image = sharp(input, { failOn: "none" }).rotate();
      const meta = await image.metadata();
      const isAnimated = file.type === "image/gif" && (meta.pages ?? 1) > 1;
      const baseName = safeFileName(path.parse(file.name).name) || "image";
      const fileName = `${Date.now()}-${randomCode(6)}-${baseName}.${isAnimated ? "gif" : "webp"}`;
      const output = isAnimated
        ? input
        : await image.resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 80, effort: 4 }).toBuffer();
      const outMeta = isAnimated ? meta : await sharp(output).metadata();
      await fs.writeFile(path.join(dir, fileName), output);
      const storagePath = `${tenant.id}/${fileName}`;
      const [row] = await db
        .insert(mediaFiles)
        .values({
          tenantId: tenant.id,
          folderId,
          name: file.name.slice(0, 120),
          storagePath,
          url: publicMediaUrl(storagePath),
          mime: isAnimated ? "image/gif" : "image/webp",
          size: output.length,
          width: outMeta.width ?? 0,
          height: outMeta.height ?? 0,
        })
        .returning();
      saved.push(row);
    }
    return NextResponse.json({ ok: true, files: saved });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ ok: false, error: e.code }, { status: e.code === "forbidden" ? 403 : 401 });
    console.error(e);
    return NextResponse.json({ ok: false, error: "error_generic" }, { status: 500 });
  }
}
