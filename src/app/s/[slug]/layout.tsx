import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function TenantLayout({ params, children }: { params: Promise<{ slug: string }>; children: ReactNode }) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  return <>{children}</>;
}
