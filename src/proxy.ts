import { NextResponse, type NextRequest } from "next/server";

/**
 * Tajer multi-tenant edge router.
 *  - <slug>.<ROOT_DOMAIN>  -> /s/<slug>/...
 *  - custom domains (DB)   -> /s/<slug>/...
 *  - platform host         -> landing, onboarding, admin
 */
const domainCache = new Map<string, { slug: string | null; exp: number }>();
const CACHE_TTL_MS = 60_000;

function normalizeHost(raw: string) {
  return raw.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}

function rootDomain() {
  return (process.env.NEXT_PUBLIC_ROOT_DOMAIN || process.env.ROOT_DOMAIN || "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .replace(/:\d+$/, "");
}

async function resolveCustomDomain(host: string): Promise<string | null> {
  const hit = domainCache.get(host);
  if (hit && hit.exp > Date.now()) return hit.slug;
  let slug: string | null = null;
  try {
    const [{ db }, { domains, tenants }, { and, eq, inArray }] = await Promise.all([
      import("@/db"),
      import("@/db/schema"),
      import("drizzle-orm"),
    ]);
    const candidates = host.startsWith("www.") ? [host, host.slice(4)] : [host, `www.${host}`];
    const rows = await db
      .select({ slug: tenants.slug })
      .from(domains)
      .innerJoin(tenants, eq(tenants.id, domains.tenantId))
      .where(and(inArray(domains.host, candidates), eq(domains.verified, true), eq(domains.type, "custom")))
      .limit(1);
    slug = rows[0]?.slug ?? null;
  } catch {
    slug = null;
  }
  domainCache.set(host, { slug, exp: Date.now() + CACHE_TTL_MS });
  return slug;
}

const PASSTHROUGH = ["/s/", "/api/", "/_next/", "/fonts/", "/favicon.ico", "/robots.txt"];

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PASSTHROUGH.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const host = normalizeHost(req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "");
  const root = rootDomain();
  let slug: string | null = null;

  if (root && host !== root && host !== `www.${root}` && host.endsWith(`.${root}`)) {
    const sub = host.slice(0, -(root.length + 1));
    if (sub && sub !== "www" && !sub.includes(".")) slug = sub;
  } else if (host && host !== root && host !== `www.${root}` && host !== "localhost" && host !== "127.0.0.1") {
    slug = await resolveCustomDomain(host);
  }

  if (!slug) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = `/s/${slug}${pathname === "/" ? "" : pathname}`;
  const headers = new Headers(req.headers);
  headers.set("x-tenant-mode", "host");
  headers.set("x-tenant-slug", slug);
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/).*)"],
};
