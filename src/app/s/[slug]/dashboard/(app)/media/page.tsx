import { requireStaffPage } from "@/lib/tenant";
import { getT } from "@/lib/server-i18n";
import { listMedia } from "@/actions/store";
import { MediaLibrary } from "@/components/dashboard/media-library";

export const dynamic = "force-dynamic";

export default async function MediaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireStaffPage(slug, "media");
  const { t } = await getT();
  const { folders, files } = await listMedia(slug, null);
  return <div className="space-y-4"><h1 className="text-2xl font-extrabold">{t("media_title")}</h1><MediaLibrary slug={slug} initialFolders={folders} initialFiles={files} /></div>;
}
