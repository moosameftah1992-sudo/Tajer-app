import { requireAdminPage, getPlatformSettings } from "@/lib/tenant";
import { getT } from "@/lib/server-i18n";
import { PlatformSettingsForm } from "@/components/admin/forms";

export const dynamic = "force-dynamic";

export default async function PlatformSettingsPage() {
  await requireAdminPage("settings");
  const { t } = await getT();
  const s = await getPlatformSettings();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">{t("admin_settings")}</h1>
      <PlatformSettingsForm settings={{ commissionRate: s.commissionRate, trialDays: s.trialDays, supportEmail: s.supportEmail, bankDetails: s.bankDetails }} />
    </div>
  );
}
