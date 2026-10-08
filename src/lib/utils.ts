import type { Locale } from "./i18n";

export const CURRENCIES = {
  BHD: { decimals: 3, en: "Bahraini Dinar", ar: "دينار بحريني", symbol: "BD", symbolAr: "د.ب" },
  SAR: { decimals: 2, en: "Saudi Riyal", ar: "ريال سعودي", symbol: "SR", symbolAr: "ر.س" },
  KWD: { decimals: 3, en: "Kuwaiti Dinar", ar: "دينار كويتي", symbol: "KD", symbolAr: "د.ك" },
  AED: { decimals: 2, en: "UAE Dirham", ar: "درهم إماراتي", symbol: "AED", symbolAr: "د.إ" },
  QAR: { decimals: 2, en: "Qatari Riyal", ar: "ريال قطري", symbol: "QR", symbolAr: "ر.ق" },
  OMR: { decimals: 3, en: "Omani Rial", ar: "ريال عماني", symbol: "OMR", symbolAr: "ر.ع" },
  USD: { decimals: 2, en: "US Dollar", ar: "دولار أمريكي", symbol: "$", symbolAr: "$" },
  EUR: { decimals: 2, en: "Euro", ar: "يورو", symbol: "€", symbolAr: "€" },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;
export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

export function isCurrency(v: unknown): v is CurrencyCode {
  return typeof v === "string" && v in CURRENCIES;
}

export function currencyDecimals(code: string) {
  return isCurrency(code) ? CURRENCIES[code].decimals : 2;
}

export function toNum(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function roundMoney(amount: number, currency: string) {
  const d = currencyDecimals(currency);
  const f = Math.pow(10, d);
  return Math.round((amount + Number.EPSILON) * f) / f;
}

export function moneyString(amount: number, currency: string) {
  return roundMoney(amount, currency).toFixed(currencyDecimals(currency));
}

export function formatMoney(amount: number | string, currency: string, locale: Locale = "en") {
  const n = toNum(amount);
  const d = currencyDecimals(currency);
  const formatted = new Intl.NumberFormat(locale === "ar" ? "ar-BH" : "en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(n);
  const sym = isCurrency(currency) ? (locale === "ar" ? CURRENCIES[currency].symbolAr : CURRENCIES[currency].symbol) : currency;
  return locale === "ar" ? `${formatted} ${sym}` : `${sym} ${formatted}`;
}

export function formatDate(d: Date | string | null | undefined, locale: Locale = "en", withTime = false) {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-BH" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export const RESERVED_SLUGS = new Set([
  "www", "admin", "api", "app", "dashboard", "login", "register", "s", "static", "assets", "mail", "ftp", "tajer", "support", "help", "billing", "status",
]);

export function isValidSlug(slug: string) {
  return /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/.test(slug) && !RESERVED_SLUGS.has(slug);
}

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function daysBetween(from: Date, to: Date) {
  return Math.ceil((to.getTime() - from.getTime()) / 86_400_000);
}

export function addDays(d: Date, days: number) {
  const n = new Date(d);
  n.setDate(n.getDate() + days);
  return n;
}

export function randomCode(len = 10) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

export function generateOrderNumber() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}-${randomCode(5).toUpperCase()}`;
}

export const BUSINESS_TYPES = [
  "restaurant", "cafe", "grocery", "jewelry", "fashion", "boutique", "electronics", "bakery", "perfume", "pharmacy", "general",
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const ORDER_STATUSES = ["pending", "processing", "out_for_delivery", "fulfilled", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const FULFILLMENT_TYPES = ["delivery", "pickup", "dine_in"] as const;
export const PAYMENT_METHODS = ["cash", "benefit", "card", "paypal"] as const;

export function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return { r: 16, g: 185, b: 129 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function readableTextColor(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#0F172A" : "#FFFFFF";
}

export function isStoreOpen(hours: { day: number; open: string; close: string; closed: boolean }[], now = new Date()) {
  const today = hours.find((h) => h.day === now.getDay());
  if (!today || today.closed) return false;
  const [oh, om] = today.open.split(":").map(Number);
  const [ch, cm] = today.close.split(":").map(Number);
  const mins = now.getHours() * 60 + now.getMinutes();
  const o = oh * 60 + om;
  const c = ch * 60 + cm;
  if (c <= o) return mins >= o || mins <= c;
  return mins >= o && mins <= c;
}
