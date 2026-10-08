"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createFolder, deleteFolder, deleteMedia, listMedia } from "@/actions/store";
import { useT } from "@/components/locale-provider";
import { Modal } from "@/components/ui";
import type { MediaFile, MediaFolder } from "@/db/schema";
import { cn } from "@/lib/utils";

type Props = { slug: string; initialFolders: MediaFolder[]; initialFiles: MediaFile[]; onSelect?: (url: string) => void; compact?: boolean };

export function MediaLibrary({ slug, initialFolders, initialFiles, onSelect, compact }: Props) {
  const { t } = useT();
  const [folders, setFolders] = useState(initialFolders);
  const [files, setFiles] = useState(initialFiles);
  const [folderId, setFolderId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [newFolder, setNewFolder] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [, start] = useTransition();

  const refresh = useCallback(async (fid: number | null) => {
    const r = await listMedia(slug, fid);
    setFolders(r.folders);
    setFiles(r.files);
  }, [slug]);

  useEffect(() => { refresh(folderId); }, [folderId, refresh]);

  const upload = async (list: FileList | File[]) => {
    const arr = Array.from(list).filter((f) => f.type.startsWith("image/"));
    if (!arr.length) return;
    setUploading(true);
    setError("");
    const fd = new FormData();
    fd.set("slug", slug);
    if (folderId) fd.set("folderId", String(folderId));
    arr.forEach((f) => fd.append("files", f));
    try {
      const res = await fetch("/api/media/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.ok) setError(t("error_generic"));
      await refresh(folderId);
    } catch {
      setError(t("error_generic"));
    } finally {
      setUploading(false);
    }
  };

  const currentFolders = folders.filter((f) => (f.parentId ?? null) === folderId);
  const parent = folderId ? folders.find((f) => f.id === folderId)?.parentId ?? null : null;
  const fmtSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

  return (
    <div className={cn("grid gap-4", compact ? "" : "lg:grid-cols-[220px_1fr]")}>
      <aside className={cn("space-y-2", compact && "flex flex-wrap items-center gap-2 space-y-0")}>
        <button onClick={() => setFolderId(null)} className={cn("block w-full rounded-lg px-3 py-2 text-start text-sm font-medium", folderId === null ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-100", compact && "w-auto")}>📁 {t("root_folder")}</button>
        {!compact && folders.filter((f) => !f.parentId).map((f) => (
          <div key={f.id} className="group flex items-center">
            <button onClick={() => setFolderId(f.id)} className={cn("flex-1 rounded-lg px-3 py-2 text-start text-sm font-medium", folderId === f.id ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-100")}>📁 {f.name}</button>
            <button onClick={() => start(async () => { await deleteFolder(slug, f.id); if (folderId === f.id) setFolderId(null); await refresh(folderId === f.id ? null : folderId); })} className="ms-1 hidden text-rose-500 group-hover:block" title={t("delete_folder")}>×</button>
          </div>
        ))}
        <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); if (!newFolder.trim()) return; start(async () => { await createFolder(slug, newFolder, folderId); setNewFolder(""); await refresh(folderId); }); }}>
          <input value={newFolder} onChange={(e) => setNewFolder(e.target.value)} className="input !py-1.5 text-xs" placeholder={t("folder_name")} />
          <button className="btn-outline !px-2 !py-1 text-xs">+</button>
        </form>
      </aside>
      <div>
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className={cn("flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition", drag ? "border-emerald-500 bg-emerald-50" : "border-slate-300 bg-white hover:border-slate-400")}
        >
          <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && upload(e.target.files)} />
          <div className="text-3xl">{uploading ? "⏳" : "📤"}</div>
          <p className="mt-2 text-sm font-medium text-slate-700">{uploading ? t("uploading") : t("drop_here")}</p>
          <p className="text-xs text-slate-400">{t("compressed_hint")}</p>
          {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          {folderId !== null && <button onClick={() => setFolderId(parent)} className="btn-ghost !px-2 !py-1">←</button>}
          <span>{folderId === null ? t("root_folder") : folders.find((f) => f.id === folderId)?.name}</span>
          <span>· {files.length}</span>
        </div>
        {compact && currentFolders.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{currentFolders.map((f) => <button key={f.id} onClick={() => setFolderId(f.id)} className="badge bg-slate-100 text-slate-700">📁 {f.name}</button>)}</div>}
        {!compact && folderId !== null && currentFolders.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{currentFolders.map((f) => <button key={f.id} onClick={() => setFolderId(f.id)} className="badge bg-slate-100 text-slate-700">📁 {f.name}</button>)}</div>}
        {files.length ? (
          <div className={cn("mt-3 grid gap-3", compact ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-5" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5")}>
            {files.map((f) => (
              <div key={f.id} className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white">
                <button type="button" onClick={() => onSelect?.(f.url)} className={cn("block aspect-square w-full bg-slate-50", onSelect && "cursor-pointer")}>
                  <img src={f.url} alt={f.name} className="h-full w-full object-cover" loading="lazy" />
                </button>
                <div className="truncate px-2 py-1 text-[10px] text-slate-500" title={f.name}>{f.name} · {fmtSize(f.size)} · {f.width}×{f.height}</div>
                {onSelect && <button type="button" onClick={() => onSelect(f.url)} className="absolute inset-x-2 bottom-7 hidden rounded-md bg-emerald-500 py-1 text-xs font-semibold text-white group-hover:block">{t("insert")}</button>}
                <button type="button" onClick={() => start(async () => { await deleteMedia(slug, f.id); await refresh(folderId); })} className="absolute end-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-white/90 text-rose-600 shadow group-hover:flex" title={t("delete_file")}>×</button>
              </div>
            ))}
          </div>
        ) : <p className="mt-6 text-center text-sm text-slate-400">{t("no_media")}</p>}
      </div>
    </div>
  );
}

export function MediaPicker({ slug, value, onChange, label }: { slug: string; value: string; onChange: (url: string) => void; label?: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">{value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <span className="text-2xl opacity-40">🖼️</span>}</div>
        <div className="space-y-1">
          <button type="button" onClick={() => setOpen(true)} className="btn-outline">{label ?? t("pick_from_library")}</button>
          {value && <button type="button" onClick={() => onChange("")} className="btn-ghost block text-rose-600">{t("remove_image")}</button>}
        </div>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={t("select_image")} wide>
        <MediaLibrary slug={slug} initialFolders={[]} initialFiles={[]} compact onSelect={(url) => { onChange(url); setOpen(false); }} />
      </Modal>
    </div>
  );
}
