import "server-only";
import path from "node:path";
import { db } from "@/db";
import { orders, orderItems } from "@/db/schema";
import { and, eq, gte, lte, ne, sql, desc } from "drizzle-orm";
import { toNum, roundMoney, formatMoney, formatDate } from "./utils";
import { translate, type Locale } from "./i18n";

export type Granularity = "day" | "month" | "year";

export type ReportRow = { period: string; revenue: number; orders: number; tax: number; items: number; discount: number };
export type Report = {
  from: Date;
  to: Date;
  granularity: Granularity;
  currency: string;
  series: ReportRow[];
  totals: { revenue: number; orders: number; tax: number; items: number; discount: number; avg: number };
  byPayment: { key: string; revenue: number; orders: number }[];
  byFulfillment: { key: string; revenue: number; orders: number }[];
  topProducts: { name: string; nameAr: string; qty: number; revenue: number }[];
};

export function parseRange(sp: { from?: string; to?: string; granularity?: string; preset?: string }) {
  const now = new Date();
  let from: Date;
  let to: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  let granularity: Granularity = sp.granularity === "month" || sp.granularity === "year" ? sp.granularity : "day";
  switch (sp.preset) {
    case "today":
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "7d":
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      break;
    case "month":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "year":
      from = new Date(now.getFullYear(), 0, 1);
      granularity = sp.granularity === "day" ? "day" : "month";
      break;
    case "custom": {
      const f = sp.from ? new Date(sp.from) : null;
      const t = sp.to ? new Date(sp.to) : null;
      from = f && !Number.isNaN(f.getTime()) ? f : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
      if (t && !Number.isNaN(t.getTime())) to = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 23, 59, 59, 999);
      break;
    }
    default:
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  }
  if (from > to) [from, to] = [new Date(to.getFullYear(), to.getMonth(), to.getDate()), new Date(from.getFullYear(), from.getMonth(), from.getDate(), 23, 59, 59, 999)];
  return { from, to, granularity };
}

export async function buildReport(tenantId: number, currency: string, from: Date, to: Date, granularity: Granularity): Promise<Report> {
  const base = and(eq(orders.tenantId, tenantId), ne(orders.status, "cancelled"), gte(orders.createdAt, from), lte(orders.createdAt, to));
  const fmt = granularity === "day" ? "YYYY-MM-DD" : granularity === "month" ? "YYYY-MM" : "YYYY";
  const periodExpr = sql<string>`to_char(date_trunc(${sql.raw(`'${granularity}'`)}, ${orders.createdAt}), ${sql.raw(`'${fmt}'`)})`;

  const [seriesRaw, byPaymentRaw, byFulfillmentRaw, itemsRaw, topRaw] = await Promise.all([
    db
      .select({
        period: periodExpr,
        revenue: sql<string>`coalesce(sum(${orders.total}),0)`,
        orders: sql<number>`count(*)::int`,
        tax: sql<string>`coalesce(sum(${orders.tax}),0)`,
        discount: sql<string>`coalesce(sum(${orders.discount}),0)`,
      })
      .from(orders)
      .where(base)
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    db
      .select({ key: orders.paymentMethod, revenue: sql<string>`coalesce(sum(${orders.total}),0)`, orders: sql<number>`count(*)::int` })
      .from(orders)
      .where(base)
      .groupBy(orders.paymentMethod),
    db
      .select({ key: orders.fulfillmentType, revenue: sql<string>`coalesce(sum(${orders.total}),0)`, orders: sql<number>`count(*)::int` })
      .from(orders)
      .where(base)
      .groupBy(orders.fulfillmentType),
    db
      .select({ period: periodExpr, items: sql<number>`coalesce(sum(${orderItems.qty}),0)::int` })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(base)
      .groupBy(sql`1`),
    db
      .select({ name: orderItems.name, nameAr: orderItems.nameAr, qty: sql<number>`sum(${orderItems.qty})::int`, revenue: sql<string>`coalesce(sum(${orderItems.total}),0)` })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(base)
      .groupBy(orderItems.name, orderItems.nameAr)
      .orderBy(desc(sql`sum(${orderItems.total})`))
      .limit(10),
  ]);

  const itemsByPeriod = new Map(itemsRaw.map((r) => [r.period, r.items]));
  const series: ReportRow[] = seriesRaw.map((r) => ({
    period: r.period,
    revenue: roundMoney(toNum(r.revenue), currency),
    orders: r.orders,
    tax: roundMoney(toNum(r.tax), currency),
    discount: roundMoney(toNum(r.discount), currency),
    items: itemsByPeriod.get(r.period) ?? 0,
  }));
  const totals = series.reduce(
    (acc, r) => ({ revenue: acc.revenue + r.revenue, orders: acc.orders + r.orders, tax: acc.tax + r.tax, items: acc.items + r.items, discount: acc.discount + r.discount, avg: 0 }),
    { revenue: 0, orders: 0, tax: 0, items: 0, discount: 0, avg: 0 },
  );
  totals.revenue = roundMoney(totals.revenue, currency);
  totals.tax = roundMoney(totals.tax, currency);
  totals.discount = roundMoney(totals.discount, currency);
  totals.avg = totals.orders ? roundMoney(totals.revenue / totals.orders, currency) : 0;
  return {
    from,
    to,
    granularity,
    currency,
    series,
    totals,
    byPayment: byPaymentRaw.map((r) => ({ key: r.key, revenue: roundMoney(toNum(r.revenue), currency), orders: r.orders })),
    byFulfillment: byFulfillmentRaw.map((r) => ({ key: r.key, revenue: roundMoney(toNum(r.revenue), currency), orders: r.orders })),
    topProducts: topRaw.map((r) => ({ name: r.name, nameAr: r.nameAr, qty: r.qty, revenue: roundMoney(toNum(r.revenue), currency) })),
  };
}

/* ------------------------------ EXPORTS ------------------------------ */
type Meta = { storeName: string; locale: Locale };

const labelFor = (locale: Locale, key: string) => {
  const map: Record<string, string> = {
    cash: translate(locale, "cash"),
    card: translate(locale, "card"),
    benefit: translate(locale, "benefit"),
    paypal: translate(locale, "paypal"),
    delivery: translate(locale, "fulfillment_delivery"),
    pickup: translate(locale, "fulfillment_pickup"),
    dine_in: translate(locale, "fulfillment_dine_in"),
  };
  return map[key] ?? key;
};

export async function buildXlsx(report: Report, meta: Meta): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const t = (k: Parameters<typeof translate>[1]) => translate(meta.locale, k);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Tajer";
  wb.created = new Date();
  const rtl = meta.locale === "ar";
  const ws = wb.addWorksheet(t("sales_report"), { views: [{ rightToLeft: rtl }] });
  ws.columns = [
    { header: t("period"), key: "period", width: 18 },
    { header: t("orders_count"), key: "orders", width: 12 },
    { header: t("items_sold"), key: "items", width: 12 },
    { header: `${t("revenue")} (${report.currency})`, key: "revenue", width: 18 },
    { header: `${t("tax_collected")} (${report.currency})`, key: "tax", width: 18 },
    { header: `${t("discounts_given")} (${report.currency})`, key: "discount", width: 18 },
  ];
  ws.insertRow(1, [meta.storeName]);
  ws.insertRow(2, [`${t("sales_report")} — ${formatDate(report.from, meta.locale)} → ${formatDate(report.to, meta.locale)} (${t(report.granularity === "day" ? "daily" : report.granularity === "month" ? "monthly" : "yearly")})`]);
  ws.insertRow(3, []);
  ws.mergeCells("A1:F1");
  ws.mergeCells("A2:F2");
  ws.getRow(1).font = { bold: true, size: 16, color: { argb: "FF0F172A" } };
  ws.getRow(2).font = { italic: true, color: { argb: "FF64748B" } };
  const header = ws.getRow(4);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  header.alignment = { horizontal: "center" };
  for (const r of report.series) ws.addRow({ period: r.period, orders: r.orders, items: r.items, revenue: r.revenue, tax: r.tax, discount: r.discount });
  const totalRow = ws.addRow({ period: t("total"), orders: report.totals.orders, items: report.totals.items, revenue: report.totals.revenue, tax: report.totals.tax, discount: report.totals.discount });
  totalRow.font = { bold: true };
  totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
  const numFmt = report.currency.match(/BHD|KWD|OMR/) ? "#,##0.000" : "#,##0.00";
  ["revenue", "tax", "discount"].forEach((k) => (ws.getColumn(k).numFmt = numFmt));
  ws.eachRow((row, i) => {
    if (i >= 4) row.eachCell((c) => (c.border = { top: { style: "thin", color: { argb: "FFE2E8F0" } }, bottom: { style: "thin", color: { argb: "FFE2E8F0" } } }));
  });

  const ws2 = wb.addWorksheet(t("breakdown"), { views: [{ rightToLeft: rtl }] });
  ws2.columns = [
    { header: t("type"), key: "type", width: 22 },
    { header: t("name"), key: "name", width: 26 },
    { header: t("orders_count"), key: "orders", width: 12 },
    { header: `${t("revenue")} (${report.currency})`, key: "revenue", width: 18 },
  ];
  ws2.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws2.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF10B981" } };
  for (const r of report.byPayment) ws2.addRow({ type: t("payment_breakdown"), name: labelFor(meta.locale, r.key), orders: r.orders, revenue: r.revenue });
  for (const r of report.byFulfillment) ws2.addRow({ type: t("fulfillment_breakdown"), name: labelFor(meta.locale, r.key), orders: r.orders, revenue: r.revenue });
  for (const r of report.topProducts) ws2.addRow({ type: t("top_products"), name: meta.locale === "ar" ? r.nameAr || r.name : r.name, orders: r.qty, revenue: r.revenue });
  ws2.getColumn("revenue").numFmt = numFmt;

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}

export async function buildPdf(report: Report, meta: Meta): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;
  const t = (k: Parameters<typeof translate>[1]) => translate(meta.locale, k);
  const rtl = meta.locale === "ar";
  const regular = path.join(process.cwd(), "public", "fonts", "Tajawal-Regular.ttf");
  const bold = path.join(process.cwd(), "public", "fonts", "Tajawal-Bold.ttf");
  const doc = new PDFDocument({ size: "A4", margin: 40, info: { Title: `${meta.storeName} - ${t("sales_report")}`, Author: "Tajer" } });
  doc.registerFont("R", regular);
  doc.registerFont("B", bold);
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  const W = doc.page.width - 80;
  const align = rtl ? "right" : "left";
  const feat: PDFKit.Mixins.TextOptions = rtl ? { features: ["rtla"] } : {};
  const money = (n: number) => formatMoney(n, report.currency, "en");

  // Header band
  doc.rect(0, 0, doc.page.width, 90).fill("#0F172A");
  doc.fillColor("#FFFFFF").font("B").fontSize(20).text(meta.storeName, 40, 24, { width: W, align, ...feat });
  doc.font("R").fontSize(11).fillColor("#A7F3D0").text(`${t("sales_report")} · ${formatDate(report.from, "en")} → ${formatDate(report.to, "en")}`, 40, 54, { width: W, align, ...feat });
  doc.fillColor("#0F172A");
  doc.y = 110;

  // KPI cards
  const kpis = [
    [t("revenue"), money(report.totals.revenue)],
    [t("orders_count"), String(report.totals.orders)],
    [t("tax_collected"), money(report.totals.tax)],
    [t("avg_order_value"), money(report.totals.avg)],
  ];
  const cardW = (W - 30) / 4;
  kpis.forEach(([label, value], i) => {
    const x = 40 + i * (cardW + 10);
    doc.roundedRect(x, 110, cardW, 54, 6).fillAndStroke("#F8FAFC", "#E2E8F0");
    doc.fillColor("#64748B").font("R").fontSize(9).text(label, x + 8, 118, { width: cardW - 16, align: "center", ...feat });
    doc.fillColor("#0F172A").font("B").fontSize(13).text(value, x + 8, 136, { width: cardW - 16, align: "center" });
  });
  doc.y = 185;

  // Table
  const cols = [t("period"), t("orders_count"), t("items_sold"), t("revenue"), t("tax_collected"), t("discounts_given")];
  const widths = [W * 0.22, W * 0.13, W * 0.13, W * 0.2, W * 0.16, W * 0.16];
  const drawRow = (cells: string[], y: number, opts: { header?: boolean; total?: boolean } = {}) => {
    if (opts.header) doc.rect(40, y, W, 20).fill("#10B981");
    else if (opts.total) doc.rect(40, y, W, 20).fill("#D1FAE5");
    let x = 40;
    const order = rtl ? [...cells].reverse() : cells;
    const ws = rtl ? [...widths].reverse() : widths;
    order.forEach((c, i) => {
      doc.fillColor(opts.header ? "#FFFFFF" : "#0F172A").font(opts.header || opts.total ? "B" : "R").fontSize(9).text(c, x + 4, y + 5, { width: ws[i] - 8, align: "center", ...(rtl && /[\u0600-\u06FF]/.test(c) ? feat : {}) });
      x += ws[i];
    });
  };
  let y = doc.y;
  drawRow(cols, y, { header: true });
  y += 20;
  const rows = report.series.length ? report.series : [];
  for (const r of rows) {
    if (y > doc.page.height - 80) {
      doc.addPage();
      y = 40;
      drawRow(cols, y, { header: true });
      y += 20;
    }
    doc.rect(40, y, W, 20).strokeColor("#E2E8F0").lineWidth(0.5).stroke();
    drawRow([r.period, String(r.orders), String(r.items), money(r.revenue), money(r.tax), money(r.discount)], y);
    y += 20;
  }
  drawRow([t("total"), String(report.totals.orders), String(report.totals.items), money(report.totals.revenue), money(report.totals.tax), money(report.totals.discount)], y, { total: true });
  y += 34;

  // Breakdowns
  const section = (title: string, lines: string[][]) => {
    if (y > doc.page.height - 120) {
      doc.addPage();
      y = 40;
    }
    doc.font("B").fontSize(12).fillColor("#0F172A").text(title, 40, y, { width: W, align, ...feat });
    y += 18;
    for (const [a, b, c] of lines) {
      doc.font("R").fontSize(9).fillColor("#334155");
      if (rtl) {
        doc.text(a, 40 + W * 0.5, y, { width: W * 0.5, align: "right", ...feat });
        doc.text(`${b} · ${c}`, 40, y, { width: W * 0.5, align: "left" });
      } else {
        doc.text(a, 40, y, { width: W * 0.5, align: "left" });
        doc.text(`${b} · ${c}`, 40 + W * 0.5, y, { width: W * 0.5, align: "right" });
      }
      y += 14;
    }
    y += 10;
  };
  section(t("payment_breakdown"), report.byPayment.map((r) => [labelFor(meta.locale, r.key), `${r.orders} ${t("orders_count")}`, money(r.revenue)]));
  section(t("fulfillment_breakdown"), report.byFulfillment.map((r) => [labelFor(meta.locale, r.key), `${r.orders} ${t("orders_count")}`, money(r.revenue)]));
  section(t("top_products"), report.topProducts.map((r) => [rtl ? r.nameAr || r.name : r.name, `${r.qty} ${t("items_sold")}`, money(r.revenue)]));

  doc.font("R").fontSize(8).fillColor("#94A3B8").text(`${t("report_generated")}: ${formatDate(new Date(), "en", true)} · Tajer`, 40, doc.page.height - 50, { width: W, align: "center" });
  doc.end();
  return done;
}
