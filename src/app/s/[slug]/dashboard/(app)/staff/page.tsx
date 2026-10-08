import { db } from "@/db";
import { staffUsers } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { requireStaffPage } from "@/lib/tenant";
import { StaffManager } from "@/components/dashboard/staff-tables";

export const dynamic = "force-dynamic";

export default async function StaffPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, staff } = await requireStaffPage(slug, "staff");
  const list = await db.select().from(staffUsers).where(eq(staffUsers.tenantId, tenant.id)).orderBy(asc(staffUsers.id));
  return <StaffManager slug={slug} staff={list} meId={staff.id} />;
}
