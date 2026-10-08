"use client";

import { useFormStatus } from "react-dom";
import { useEffect, type ReactNode } from "react";
import { useT } from "./locale-provider";
import type { TKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function Logo({ size = 36, withText = true, light = false }: { size?: number; withText?: boolean; light?: boolean }) {
  const navy = light ? "#FFFFFF" : "#0F172A";
  return (
    <span className="inline-flex items-center gap-2 select-none" dir="ltr">
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
        <path d="M18 44h30a10 10 0 0 0 1.6-19.9A14 14 0 0 0 23 20.5 11.5 11.5 0 0 0 18 44Z" stroke={navy} strokeWidth="4.5" strokeLinejoin="round" />
        <rect x="24" y="30" width="5" height="9" fill="#10B981" />
        <rect x="31" y="26" width="5" height="13" fill="#10B981" />
        <rect x="38" y="22" width="5" height="17" fill="#10B981" />
        <path d="M22 40c8 0 16-4 22-12" stroke="#10B981" strokeWidth="3" strokeLinecap="round" />
        <path d="M44 24l3 6-7 .5" fill="#10B981" />
        <path d="M22 48h24" stroke={navy} strokeWidth="4" strokeLinecap="round" />
        <circle cx="27" cy="55" r="3.5" fill={navy} />
        <circle cx="42" cy="55" r="3.5" fill={navy} />
      </svg>
      {withText && (
        <span className="leading-none">
          <span className="block text-lg font-extrabold tracking-tight" style={{ color: navy }}>
            Tajer
          </span>
          <span className="block text-[11px] font-bold text-emerald-500">تاجر</span>
        </span>
      )}
    </span>
  );
}

export function SubmitButton({ children, className = "btn-accent", pendingText }: { children: ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  const { t } = useT();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingText ?? t("loading") : children}
    </button>
  );
}

export function Alert({ kind = "error", messageKey, message, className = "" }: { kind?: "error" | "success" | "info"; messageKey?: string; message?: string; className?: string }) {
  const { t } = useT();
  const text = message ?? (messageKey ? t(messageKey as TKey) : "");
  if (!text) return null;
  const styles = kind === "error" ? "bg-rose-50 text-rose-700 border-rose-200" : kind === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-sky-50 text-sky-700 border-sky-200";
  return <div className={cn("rounded-lg border px-3 py-2 text-sm", styles, className)}>{text}</div>;
}

export function Field({ label, children, hint, className = "" }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export function Toggle({ name, label, defaultChecked, checked, onChange, disabled }: { name?: string; label: string; defaultChecked?: boolean; checked?: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={cn("flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2", disabled && "opacity-50")}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className="relative inline-flex">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} checked={checked} onChange={(e) => onChange?.(e.target.checked)} disabled={disabled} className="peer sr-only" />
        <span className="switch bg-slate-300 peer-checked:bg-emerald-500" />
        <span className="pointer-events-none absolute top-1 start-1 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-5 rtl:peer-checked:-translate-x-5" />
      </span>
    </label>
  );
}

export function StatCard({ label, value, sub, accent = false }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className={cn("card", accent && "border-emerald-200 bg-emerald-50/50")}>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-extrabold text-slate-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className={cn("max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl", wide ? "max-w-5xl" : "max-w-lg")} onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            <button type="button" onClick={onClose} className="btn-ghost px-2 py-1 text-xl leading-none" aria-label="Close">
              ×
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <div className="mb-2 text-3xl">🗂️</div>
      <p className="text-sm text-slate-500">{title}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "amber" | "rose" | "blue" | "violet" }) {
  const tones = { slate: "bg-slate-100 text-slate-700", green: "bg-emerald-100 text-emerald-700", amber: "bg-amber-100 text-amber-700", rose: "bg-rose-100 text-rose-700", blue: "bg-sky-100 text-sky-700", violet: "bg-violet-100 text-violet-700" };
  return <span className={cn("badge", tones[tone])}>{children}</span>;
}

/* ------------------------------ Charts ------------------------------ */
export function BarChart({ data, height = 180, format }: { data: { label: string; value: number }[]; height?: number; format?: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / Math.max(1, data.length);
  return (
    <div className="w-full" dir="ltr">
      <svg viewBox={`0 0 100 ${height / 4}`} preserveAspectRatio="none" className="h-auto w-full" style={{ height }}>
        {data.map((d, i) => {
          const h = (d.value / max) * (height / 4 - 4);
          return <rect key={i} x={i * w + w * 0.15} y={height / 4 - h} width={w * 0.7} height={h} rx={0.6} fill="#10B981" opacity={0.9}>
            <title>{`${d.label}: ${format ? format(d.value) : d.value}`}</title>
          </rect>;
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{data[0]?.label ?? ""}</span>
        <span>{data[Math.floor(data.length / 2)]?.label ?? ""}</span>
        <span>{data[data.length - 1]?.label ?? ""}</span>
      </div>
    </div>
  );
}

export function LineChart({ data, height = 180, color = "#0F172A", format }: { data: { label: string; value: number }[]; height?: number; color?: string; format?: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const H = height / 4;
  const pts = data.map((d, i) => [data.length > 1 ? (i / (data.length - 1)) * 100 : 50, H - (d.value / max) * (H - 4)] as const);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
  const area = pts.length ? `${path} L100,${H} L0,${H} Z` : "";
  return (
    <div className="w-full" dir="ltr">
      <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        {area && <path d={area} fill={color} opacity={0.08} />}
        {path && <path d={path} fill="none" stroke={color} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />}
        {pts.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={0.9} fill={color}>
            <title>{`${data[i].label}: ${format ? format(data[i].value) : data[i].value}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{data[0]?.label ?? ""}</span>
        <span>{data[data.length - 1]?.label ?? ""}</span>
      </div>
    </div>
  );
}

export function DonutChart({ data, size = 140 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let acc = 0;
  const r = 15.915;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 42 42" width={size} height={size} className="shrink-0">
        <circle cx="21" cy="21" r={r} fill="transparent" stroke="#E2E8F0" strokeWidth="6" />
        {data.map((d, i) => {
          const pct = (d.value / total) * 100;
          const el = <circle key={i} cx="21" cy="21" r={r} fill="transparent" stroke={d.color} strokeWidth="6" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={25 - acc} transform="rotate(0 21 21)" />;
          acc += pct;
          return el;
        })}
      </svg>
      <ul className="space-y-1 text-xs">
        {data.map((d, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
            <span className="text-slate-600">{d.label}</span>
            <span className="font-semibold text-slate-900">{Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
