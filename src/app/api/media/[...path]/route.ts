import { NextResponse, type NextRequest } from "next/server";
import path from "node:path";
import { promises as fs } from "node:fs";
import { UPLOAD_ROOT } from "@/lib/media";

const TYPES: Record<string, string> = { ".webp": "image/webp", ".gif": "image/gif", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".avif": "image/avif" };

export async function GET(_req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params;
  const rel = parts.map((p) => p.replace(/[^a-zA-Z0-9._-]/g, "")).join("/");
  const abs = path.join(UPLOAD_ROOT, rel);
  if (!abs.startsWith(UPLOAD_ROOT) || rel.includes("..")) return new NextResponse("Not found", { status: 404 });
  try {
    const data = await fs.readFile(abs);
    const type = TYPES[path.extname(abs).toLowerCase()] ?? "application/octet-stream";
    return new NextResponse(new Uint8Array(data), { headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable", "Content-Length": String(data.length) } });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
