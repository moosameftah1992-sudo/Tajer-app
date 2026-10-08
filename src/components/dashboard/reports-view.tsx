"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/components/locale-provider";
import { StatCard, BarChart, LineChart, DonutChart } from "@/components/ui";
import { formatMoney, formatDate, cn } from "@/lib/utils";
import type { Report } from "@/lib/reports";
import type { TKey } from "@/lib/i18n";

export function ReportsView({ slug, report, params }: { slug: string; report: Report; params: { preset: string; from: string; to: string; granularity: string } }) {
  const { t, locale } = useT();
  const router = useRouter();
  const sp = useSearchParams();
  const [from, setFrom] = useState(params.from);
  const [to, setTo] = useState(params.to);
  const [gran, setGran] = useState(params.granularity);
  const go = (patch: Record<string, string>) => { const q = new URLSearchParams(sp.toString()); Object.entries(patch).forEach(([k, v]) => (v ? q.set(k, v) : q.delete(k))); router.push(`?${q.toString()}`); };
  const exportUrl = (format: "xlsx" | "pdf") => `/api/store/${slug}/reports/export?${new URLSearchParams({ format, preset: params.preset, from: params.from, to: params.to, granularity: params.granularity }).toString()}`;
  const presets = [["today", t("today")], ["7d", t("last_7")], ["30d", t("last_30")], ["month", t("this_month")], ["year", t("this_year")], ["custom", t("custom_range")]] as const;
  const money = (v: number) => formatMoney(v, report.currency, locale);
  const label = (k: string) => t(({ cash: "cash", card: "card", benefit: "benefit", paypal: "paypal", delivery: "fulfillment_delivery", pickup: "fulfillment_pickup", dine_in: "fulfillment_dine_in" } as Record<string, TKey>)[k] ?? (k as TKey));
  const colors = ["#10B981", "#0F172A", "#F59E0B", "#3B82F6", "#EC4899"];
  return (
    <div className="space-y-6">
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase text-slate-500">{t("quick_ranges")}</span>
          {presets.map(([k, l]) => <button key={k} onClick={() => go({ preset: k })} className={cn("rounded-full px-3 py-1 text-sm font-semibold", params.preset === k ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700")}>{l}</button>)}
          <div className="ms-auto flex gap-2"><a href={exportUrl("xlsx")} className="btn-accent">📊 {t("export_excel")}</a><a href={exportUrl("pdf")} className="btn-primary">📄 {t("export_pdf")}</a></div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block"><span className="label">{t("from")}</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" dir="ltr" /></label>
          <label className="block"><span className="label">{t("to")}</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" dir="ltr" /></label>
          <label className="block"><span className="label">{t("granularity")}</span><select value={gran} onChange={(e) => setGran(e.target.value)} className="input"><option value="day">{t("daily")}</option><option value="month">{t("monthly")}</option><option value="year">{t("yearly")}</option></select></label>
          <button onClick={() => go({ preset: "custom", from, to, granularity: gran })} className="btn-outline">{t("apply")}</button>
          <span className="text-xs text-slate-500">{formatDate(report.from, locale)} → {formatDate(report.to, locale)}</span>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("revenue")} value={money(report.totals.revenue)} accent />
        <StatCard label={t("orders_count")} value={report.totals.orders} sub={`${report.totals.items} ${t("items_sold")}`} />
        <StatCard label={t("tax_collected")} value={money(report.totals.tax)} sub={`${t("discounts_given")}: ${money(report.totals.discount)}`} />
        <StatCard label={t("avg_order_value")} value={money(report.totals.avg)} />
      </div>
      {report.series.length ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card"><h3 className="mb-3 font-bold">{t("revenue_chart")}</h3><BarChart data={report.series.map((r) => ({ label: r.period, value: r.revenue }))} format={money} /></div>
          <div className="card"><h3 className="mb-3 font-bold">{t("orders_chart")}</h3><LineChart data={report.series.map((r) => ({ label: r.period, value: r.orders }))} /></div>
          <div className="card"><h3 className="mb-3 font-bold">{t("payment_breakdown")}</h3><DonutChart data={report.byPayment.map((r, i) => ({ label: `${label(r.key)} (${money(r.revenue)})`, value: r.revenue, color: colors[i % colors.length] }))} /></div>
          <div className="card"><h3 className="mb-3 font-bold">{t("fulfillment_breakdown")}</h3><DonutChart data={report.byFulfillment.map((r, i) => ({ label: `${label(r.key)} (${r.orders})`, value: r.orders, color: colors[(i + 2) % colors.length] }))} /></div>
          <div className="card lg:col-span-2 overflow-x-auto">
            <h3 className="mb-3 font-bold">{t("breakdown")}</h3>
            <table className="table"><thead><tr><th>{t("period")}</th><th>{t("orders_count")}</th><th>{t("items_sold")}</th><th>{t("revenue")}</th><th>{t("tax_collected")}</th><th>{t("discounts_given")}</th></tr></thead>
              <tbody>{report.series.map((r) => <tr key={r.period}><td className="font-mono">{r.period}</td><td>{r.orders}</td><td>{r.items}</td><td>{money(r.revenue)}</td><td>{money(r.tax)}</td><td>{money(r.discount)}</td></tr>)}<tr className="bg-emerald-50 font-bold"><td>{t("total")}</td><td>{report.totals.orders}</td><td>{report.totals.items}</td><td>{money(report.totals.revenue)}</td><td>{money(report.totals.tax)}</td><td>{money(report.totals.discount)}</td></tr></tbody></table>
          </div>
          <div className="card lg:col-span-2"><h3 className="mb-3 font-bold">{t("top_products")}</h3><table className="table"><thead><tr><th>{t("product_name")}</th><th>{t("items_sold")}</th><th>{t("revenue")}</th></tr></thead><tbody>{report.topProducts.map((p) => <tr key={p.name}><td>{locale === "ar" ? p.nameAr || p.name : p.name}</td><td>{p.qty}</td><td>{money(p.revenue)}</td></tr>)}</tbody></table></div>
        </div>
      ) : <div className="card text-center text-slate-500">{t("no_data")}</div>}
    </div>
  );
}
