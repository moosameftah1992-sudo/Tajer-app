import "server-only";
import { createCipheriv, createDecipheriv } from "node:crypto";
import type { PaymentsConfig, Order, Tenant } from "@/db/schema";
import { currencyDecimals, moneyString, toNum } from "./utils";

export class PaymentError extends Error {}

/* ------------------------------------------------------------------ */
/* Stripe Checkout (merchant's own secret key)                         */
/* ------------------------------------------------------------------ */
function stripeAmount(total: number, currency: string) {
  const d = currencyDecimals(currency);
  let units = Math.round(total * Math.pow(10, d));
  if (d === 3) units = Math.round(units / 10) * 10; // three-decimal currencies must end in 0
  return units;
}

export async function stripeCreateSession(cfg: PaymentsConfig["card"], order: Order, tenant: Tenant, successUrl: string, cancelUrl: string) {
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `${successUrl}${successUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", cancelUrl);
  params.set("client_reference_id", order.orderNumber);
  params.set("metadata[order_id]", String(order.id));
  params.set("metadata[tenant_id]", String(tenant.id));
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", order.currency.toLowerCase());
  params.set("line_items[0][price_data][unit_amount]", String(stripeAmount(toNum(order.total), order.currency)));
  params.set("line_items[0][price_data][product_data][name]", `${tenant.name} — #${order.orderNumber}`);
  if (order.customerEmail) params.set("customer_email", order.customerEmail);
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    signal: AbortSignal.timeout(20000),
  });
  const json = (await res.json()) as { url?: string; id?: string; error?: { message?: string } };
  if (!res.ok || !json.url) throw new PaymentError(json.error?.message || "stripe");
  return { url: json.url, sessionId: json.id ?? "" };
}

export async function stripeVerifySession(cfg: PaymentsConfig["card"], sessionId: string) {
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${cfg.secretKey}` },
    signal: AbortSignal.timeout(20000),
  });
  const json = (await res.json()) as { payment_status?: string; client_reference_id?: string; payment_intent?: string };
  return { paid: res.ok && json.payment_status === "paid", reference: json.client_reference_id ?? "", intent: json.payment_intent ?? "" };
}

/* ------------------------------------------------------------------ */
/* PayPal Orders v2 (merchant's own REST app)                          */
/* ------------------------------------------------------------------ */
const PAYPAL_SUPPORTED = new Set(["USD", "EUR", "GBP", "AUD", "CAD", "JPY", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "ILS", "MXN", "BRL", "NZD", "SGD", "HKD", "THB", "PHP", "TWD", "MYR"]);
/** Official central-bank USD pegs for GCC currencies (units of local currency per 1 USD). */
const USD_PEG: Record<string, number> = { BHD: 0.376, SAR: 3.75, AED: 3.6725, QAR: 3.64, OMR: 0.3845, KWD: 0.3067 };

export function paypalAmount(total: number, currency: string) {
  if (PAYPAL_SUPPORTED.has(currency)) return { value: moneyString(total, currency), currency_code: currency };
  const peg = USD_PEG[currency];
  if (!peg) throw new PaymentError("currency");
  return { value: (total / peg).toFixed(2), currency_code: "USD" };
}

function paypalBase(cfg: PaymentsConfig["paypal"]) {
  return cfg.sandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
}

async function paypalToken(cfg: PaymentsConfig["paypal"]) {
  const res = await fetch(`${paypalBase(cfg)}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(20000),
  });
  const json = (await res.json()) as { access_token?: string };
  if (!res.ok || !json.access_token) throw new PaymentError("paypal_auth");
  return json.access_token;
}

export async function paypalCreateOrder(cfg: PaymentsConfig["paypal"], order: Order, tenant: Tenant, returnUrl: string, cancelUrl: string) {
  const token = await paypalToken(cfg);
  const amount = paypalAmount(toNum(order.total), order.currency);
  const res = await fetch(`${paypalBase(cfg)}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{ reference_id: order.orderNumber, custom_id: String(order.id), description: `${tenant.name} #${order.orderNumber} (${moneyString(toNum(order.total), order.currency)} ${order.currency})`, amount }],
      payment_source: { paypal: { experience_context: { return_url: returnUrl, cancel_url: cancelUrl, user_action: "PAY_NOW", brand_name: tenant.name, shipping_preference: "NO_SHIPPING" } } },
    }),
    signal: AbortSignal.timeout(20000),
  });
  const json = (await res.json()) as { id?: string; links?: { rel: string; href: string }[] };
  const approve = json.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
  if (!res.ok || !json.id || !approve) throw new PaymentError("paypal_create");
  return { url: approve, paypalOrderId: json.id };
}

export async function paypalCapture(cfg: PaymentsConfig["paypal"], paypalOrderId: string) {
  const token = await paypalToken(cfg);
  const res = await fetch(`${paypalBase(cfg)}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  const json = (await res.json()) as { status?: string; purchase_units?: { reference_id?: string }[] };
  return { paid: res.ok && json.status === "COMPLETED", reference: json.purchase_units?.[0]?.reference_id ?? "" };
}

/* ------------------------------------------------------------------ */
/* BENEFIT Payment Gateway (Bahrain) — hosted page with AES trandata   */
/* ------------------------------------------------------------------ */
const BENEFIT_IV = "PGKEYENCDECIVSPC";
const BENEFIT_HOSTED_URL = "https://www.benefit-gateway.bh/payment/API/hosted.htm";

function benefitKey(resourceKey: string) {
  return Buffer.from(resourceKey.padEnd(32, "0").slice(0, 32), "utf8");
}

export function benefitEncrypt(plain: string, resourceKey: string) {
  const cipher = createCipheriv("aes-256-cbc", benefitKey(resourceKey), Buffer.from(BENEFIT_IV, "utf8"));
  return Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]).toString("hex").toUpperCase();
}

export function benefitDecrypt(hex: string, resourceKey: string) {
  const decipher = createDecipheriv("aes-256-cbc", benefitKey(resourceKey), Buffer.from(BENEFIT_IV, "utf8"));
  return Buffer.concat([decipher.update(Buffer.from(hex, "hex")), decipher.final()]).toString("utf8");
}

export async function benefitCreatePayment(cfg: PaymentsConfig["benefit"], order: Order, responseUrl: string, errorUrl: string) {
  const trandata = [
    {
      amt: moneyString(toNum(order.total), "BHD"),
      action: "1",
      password: cfg.tranportalPassword,
      id: cfg.tranportalId,
      currencycode: "048",
      trackId: order.orderNumber,
      udf1: String(order.id),
      udf2: order.customerPhone,
      udf3: "",
      udf4: "",
      udf5: "",
      responseURL: responseUrl,
      errorURL: errorUrl,
      langid: "USA",
    },
  ];
  const encrypted = benefitEncrypt(JSON.stringify(trandata), cfg.resourceKey);
  const res = await fetch(BENEFIT_HOSTED_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([{ id: cfg.tranportalId, trandata: encrypted, responseURL: responseUrl, errorURL: errorUrl }]),
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let parsed: { status?: string; result?: string }[] = [];
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new PaymentError("benefit_response");
  }
  const first = parsed[0];
  if (!first || first.status !== "1" || !first.result || !first.result.includes(":")) throw new PaymentError(first?.result || "benefit");
  const idx = first.result.indexOf(":");
  const paymentId = first.result.slice(0, idx);
  const url = first.result.slice(idx + 1);
  return { url: `${url}?PaymentID=${encodeURIComponent(paymentId)}`, paymentId };
}

export function benefitParseResponse(trandataHex: string, resourceKey: string) {
  const plain = benefitDecrypt(trandataHex, resourceKey);
  const arr = JSON.parse(plain) as { result?: string; trackId?: string; paymentId?: string; tranId?: string; ref?: string; udf1?: string; amt?: string }[];
  const r = arr[0] ?? {};
  return { paid: r.result === "CAPTURED", trackId: r.trackId ?? "", paymentId: r.paymentId ?? "", tranId: r.tranId ?? "", ref: r.ref ?? "", orderId: Number(r.udf1) || 0 };
}
