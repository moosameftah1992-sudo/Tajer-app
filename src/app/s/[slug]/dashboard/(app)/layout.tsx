import type { ReactNode } from "react";
import { requireStaffPage } from "@/lib/tenant";
import { DashboardShell } from "@/components/dashboard/shell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ params, children }: { params: Promise<{ slug: string }>; children: ReactNode }) {
  const { slug } = await params;
  const { tenant, staff, base, sub } = await requireStaffPage(slug);
  return <DashboardShell tenant={tenant} staff={staff} base={base} sub={sub}>{children}</DashboardShell>;
}
