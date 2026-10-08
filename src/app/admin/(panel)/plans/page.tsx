import { db } from "@/db";
import { plans } from "@/db/schema";
import { asc } from "drizzle-orm";
import { requireAdminPage, getActivePlans } from "@/lib/tenant";
import { PlansManager } from "@/components/admin/forms";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  await requireAdminPage("plans");
  await getActivePlans();
  const all = await db.select().from(plans).orderBy(asc(plans.sort), asc(plans.id));
  return <PlansManager plans={all} />;
}
