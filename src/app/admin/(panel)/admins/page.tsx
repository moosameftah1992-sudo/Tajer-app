import { db } from "@/db";
import { platformAdmins } from "@/db/schema";
import { asc } from "drizzle-orm";
import { requireAdminPage } from "@/lib/tenant";
import { AdminsManager } from "@/components/admin/forms";

export const dynamic = "force-dynamic";

export default async function AdminsPage() {
  const me = await requireAdminPage("admins");
  const admins = await db.select().from(platformAdmins).orderBy(asc(platformAdmins.id));
  return <AdminsManager admins={admins} meId={me.id} />;
}
