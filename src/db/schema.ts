import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ---------- Shared JSON types ---------- */
export type PaymentsConfig = {
  cash: { enabled: boolean };
  benefit: {
    enabled: boolean;
    tranportalId: string;
    tranportalPassword: string;
    resourceKey: string;
  };
  card: {
    enabled: boolean;
    provider: "stripe";
    publishableKey: string;
    secretKey: string;
  };
  paypal: {
    enabled: boolean;
    clientId: string;
    clientSecret: string;
    sandbox: boolean;
  };
};

export type ProductVariant = {
  name: string;
  nameAr: string;
  options: { label: string; labelAr: string; priceDelta: number }[];
};

export type BusinessHour = {
  day: number;
  open: string;
  close: string;
  closed: boolean;
};

export type ProviderField = {
  key: string;
  label: string;
  labelAr: string;
  type: "text" | "password" | "number";
  required: boolean;
};

export const defaultPayments: PaymentsConfig = {
  cash: { enabled: true },
  benefit: { enabled: false, tranportalId: "", tranportalPassword: "", resourceKey: "" },
  card: { enabled: false, provider: "stripe", publishableKey: "", secretKey: "" },
  paypal: { enabled: false, clientId: "", clientSecret: "", sandbox: false },
};

export const defaultBusinessHours: BusinessHour[] = Array.from({ length: 7 }, (_, day) => ({
  day,
  open: "09:00",
  close: "22:00",
  closed: false,
}));

/* ---------- Platform level ---------- */
export const platformAdmins = pgTable("platform_admins", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("manager"), // super | manager | support
  permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
  active: boolean("active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const platformSettings = pgTable("platform_settings", {
  id: serial("id").primaryKey(),
  commissionRate: numeric("commission_rate", { precision: 6, scale: 3 }).notNull().default("0"),
  trialDays: integer("trial_days").notNull().default(30),
  supportEmail: text("support_email").notNull().default("support@tajer.com"),
  bankDetails: text("bank_details").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  monthlyPrice: numeric("monthly_price", { precision: 12, scale: 3 }).notNull().default("0"),
  yearlyPrice: numeric("yearly_price", { precision: 12, scale: 3 }).notNull().default("0"),
  currency: text("currency").notNull().default("USD"),
  features: jsonb("features").$type<string[]>().notNull().default([]),
  featuresAr: jsonb("features_ar").$type<string[]>().notNull().default([]),
  active: boolean("active").notNull().default(true),
  sort: integer("sort").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ---------- Tenants ---------- */
export const tenants = pgTable(
  "tenants",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    nameAr: text("name_ar").notNull(),
    description: text("description").notNull().default(""),
    descriptionAr: text("description_ar").notNull().default(""),
    businessType: text("business_type").notNull().default("general"),
    email: text("email").notNull(),
    phone: text("phone").notNull().default(""),
    whatsapp: text("whatsapp").notNull().default(""),
    address: text("address").notNull().default(""),
    country: text("country").notNull().default("BH"),
    currency: text("currency").notNull().default("BHD"),
    templateId: integer("template_id").notNull().default(1),
    primaryColor: text("primary_color").notNull().default("#10B981"),
    secondaryColor: text("secondary_color").notNull().default("#0F172A"),
    backgroundColor: text("background_color").notNull().default("#FFFFFF"),
    typographyScale: numeric("typography_scale", { precision: 4, scale: 2 }).notNull().default("1.00"),
    fontFamily: text("font_family").notNull().default("default"),
    logoUrl: text("logo_url").notNull().default(""),
    heroUrl: text("hero_url").notNull().default(""),
    heroTitle: text("hero_title").notNull().default(""),
    heroTitleAr: text("hero_title_ar").notNull().default(""),
    heroSubtitle: text("hero_subtitle").notNull().default(""),
    heroSubtitleAr: text("hero_subtitle_ar").notNull().default(""),
    taxRate: numeric("tax_rate", { precision: 6, scale: 3 }).notNull().default("0"),
    taxInclusive: boolean("tax_inclusive").notNull().default(false),
    businessHours: jsonb("business_hours").$type<BusinessHour[]>().notNull().default(defaultBusinessHours),
    deliveryEnabled: boolean("delivery_enabled").notNull().default(true),
    pickupEnabled: boolean("pickup_enabled").notNull().default(true),
    dineInEnabled: boolean("dine_in_enabled").notNull().default(false),
    deliveryFee: numeric("delivery_fee", { precision: 12, scale: 3 }).notNull().default("0"),
    minOrder: numeric("min_order", { precision: 12, scale: 3 }).notNull().default("0"),
    payments: jsonb("payments").$type<PaymentsConfig>().notNull().default(defaultPayments),
    status: text("status").notNull().default("active"), // active | suspended
    planId: integer("plan_id"),
    billingCycle: text("billing_cycle").notNull().default("trial"), // trial | monthly | yearly
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }).notNull(),
    subscriptionEndsAt: timestamp("subscription_ends_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("tenants_status_idx").on(t.status), index("tenants_sub_idx").on(t.subscriptionEndsAt)],
);

export const domains = pgTable(
  "domains",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    host: text("host").notNull().unique(),
    type: text("type").notNull().default("subdomain"), // subdomain | custom
    verified: boolean("verified").notNull().default(true),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("domains_tenant_idx").on(t.tenantId)],
);

export const staffUsers = pgTable(
  "staff_users",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("cashier"), // owner | admin | manager | cashier | stock_keeper | custom
    permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
    active: boolean("active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("staff_tenant_idx").on(t.tenantId), uniqueIndex("staff_tenant_email_uq").on(t.tenantId, t.email)],
);

export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull().default(""),
    passwordHash: text("password_hash").notNull().default(""),
    address: text("address").notNull().default(""),
    city: text("city").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("customers_tenant_idx").on(t.tenantId), uniqueIndex("customers_tenant_email_uq").on(t.tenantId, t.email)],
);

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    name: text("name").notNull(),
    nameAr: text("name_ar").notNull(),
    imageUrl: text("image_url").notNull().default(""),
    sort: integer("sort").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("categories_tenant_idx").on(t.tenantId)],
);

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    categoryId: integer("category_id"),
    name: text("name").notNull(),
    nameAr: text("name_ar").notNull(),
    description: text("description").notNull().default(""),
    descriptionAr: text("description_ar").notNull().default(""),
    price: numeric("price", { precision: 14, scale: 3 }).notNull().default("0"),
    compareAtPrice: numeric("compare_at_price", { precision: 14, scale: 3 }),
    cost: numeric("cost", { precision: 14, scale: 3 }),
    sku: text("sku").notNull().default(""),
    barcode: text("barcode").notNull().default(""),
    stock: integer("stock").notNull().default(0),
    trackStock: boolean("track_stock").notNull().default(true),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
    weight: numeric("weight", { precision: 12, scale: 3 }),
    weightUnit: text("weight_unit").notNull().default("g"),
    purity: text("purity").notNull().default(""),
    unit: text("unit").notNull().default("piece"),
    imageUrl: text("image_url").notNull().default(""),
    images: jsonb("images").$type<string[]>().notNull().default([]),
    variants: jsonb("variants").$type<ProductVariant[]>().notNull().default([]),
    featured: boolean("featured").notNull().default(false),
    active: boolean("active").notNull().default(true),
    sort: integer("sort").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("products_tenant_idx").on(t.tenantId),
    index("products_tenant_category_idx").on(t.tenantId, t.categoryId),
    index("products_tenant_barcode_idx").on(t.tenantId, t.barcode),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    orderNumber: text("order_number").notNull(),
    customerId: integer("customer_id"),
    customerName: text("customer_name").notNull().default(""),
    customerPhone: text("customer_phone").notNull().default(""),
    customerEmail: text("customer_email").notNull().default(""),
    address: text("address").notNull().default(""),
    fulfillmentType: text("fulfillment_type").notNull().default("pickup"), // delivery | pickup | dine_in
    tableId: integer("table_id"),
    paymentMethod: text("payment_method").notNull().default("cash"), // cash | benefit | card | paypal
    paymentStatus: text("payment_status").notNull().default("pending"), // pending | paid | failed | refunded
    paymentRef: text("payment_ref").notNull().default(""),
    status: text("status").notNull().default("pending"), // pending | processing | out_for_delivery | fulfilled | cancelled
    subtotal: numeric("subtotal", { precision: 14, scale: 3 }).notNull().default("0"),
    tax: numeric("tax", { precision: 14, scale: 3 }).notNull().default("0"),
    deliveryFee: numeric("delivery_fee", { precision: 14, scale: 3 }).notNull().default("0"),
    discount: numeric("discount", { precision: 14, scale: 3 }).notNull().default("0"),
    total: numeric("total", { precision: 14, scale: 3 }).notNull().default("0"),
    currency: text("currency").notNull(),
    notes: text("notes").notNull().default(""),
    source: text("source").notNull().default("storefront"), // storefront | pos
    shippingProviderId: integer("shipping_provider_id"),
    shippingTracking: text("shipping_tracking").notNull().default(""),
    shippingStatus: text("shipping_status").notNull().default(""),
    staffId: integer("staff_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("orders_tenant_idx").on(t.tenantId),
    index("orders_tenant_created_idx").on(t.tenantId, t.createdAt),
    index("orders_tenant_status_idx").on(t.tenantId, t.status),
    uniqueIndex("orders_tenant_number_uq").on(t.tenantId, t.orderNumber),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    orderId: integer("order_id").notNull(),
    productId: integer("product_id"),
    name: text("name").notNull(),
    nameAr: text("name_ar").notNull().default(""),
    variant: text("variant").notNull().default(""),
    qty: integer("qty").notNull().default(1),
    unitPrice: numeric("unit_price", { precision: 14, scale: 3 }).notNull().default("0"),
    total: numeric("total", { precision: 14, scale: 3 }).notNull().default("0"),
  },
  (t) => [index("order_items_tenant_idx").on(t.tenantId), index("order_items_order_idx").on(t.orderId)],
);

export const mediaFolders = pgTable(
  "media_folders",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    name: text("name").notNull(),
    parentId: integer("parent_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("media_folders_tenant_idx").on(t.tenantId)],
);

export const mediaFiles = pgTable(
  "media_files",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    folderId: integer("folder_id"),
    name: text("name").notNull(),
    storagePath: text("storage_path").notNull(),
    url: text("url").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull().default(0),
    width: integer("width").notNull().default(0),
    height: integer("height").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("media_files_tenant_idx").on(t.tenantId), index("media_files_folder_idx").on(t.tenantId, t.folderId)],
);

export const diningTables = pgTable(
  "dining_tables",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    name: text("name").notNull(),
    code: text("code").notNull().unique(),
    seats: integer("seats").notNull().default(4),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("dining_tables_tenant_idx").on(t.tenantId)],
);

/* ---------- Logistics hub ---------- */
export const shippingProviders = pgTable("shipping_providers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  code: text("code").notNull().unique(),
  webhookUrl: text("webhook_url").notNull().default(""),
  authHeader: text("auth_header").notNull().default("Authorization"),
  outboundSecret: text("outbound_secret").notNull().default(""),
  inboundSecret: text("inbound_secret").notNull(),
  configSchema: jsonb("config_schema").$type<ProviderField[]>().notNull().default([]),
  defaultFee: numeric("default_fee", { precision: 12, scale: 3 }).notNull().default("0"),
  trackingUrlTemplate: text("tracking_url_template").notNull().default(""),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tenantShippingProviders = pgTable(
  "tenant_shipping_providers",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    providerId: integer("provider_id").notNull(),
    enabledByAdmin: boolean("enabled_by_admin").notNull().default(true),
    active: boolean("active").notNull().default(false),
    credentials: jsonb("credentials").$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("tsp_tenant_idx").on(t.tenantId), uniqueIndex("tsp_tenant_provider_uq").on(t.tenantId, t.providerId)],
);

export const shipments = pgTable(
  "shipments",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    orderId: integer("order_id").notNull(),
    providerId: integer("provider_id").notNull(),
    trackingNumber: text("tracking_number").notNull().default(""),
    status: text("status").notNull().default("created"),
    requestPayload: jsonb("request_payload").$type<Record<string, unknown>>().notNull().default({}),
    responsePayload: jsonb("response_payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("shipments_tenant_idx").on(t.tenantId), index("shipments_tracking_idx").on(t.trackingNumber)],
);

export const logisticsEvents = pgTable(
  "logistics_events",
  {
    id: serial("id").primaryKey(),
    providerId: integer("provider_id").notNull(),
    tenantId: integer("tenant_id"),
    orderId: integer("order_id"),
    tracking: text("tracking").notNull().default(""),
    event: text("event").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("logistics_events_provider_idx").on(t.providerId)],
);

/* ---------- Billing ---------- */
export const subscriptionInvoices = pgTable(
  "subscription_invoices",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    planId: integer("plan_id").notNull(),
    period: text("period").notNull(), // monthly | yearly
    amount: numeric("amount", { precision: 12, scale: 3 }).notNull(),
    currency: text("currency").notNull(),
    status: text("status").notNull().default("pending"), // pending | paid | cancelled
    method: text("method").notNull().default("bank_transfer"),
    reference: text("reference").notNull().default(""),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("invoices_tenant_idx").on(t.tenantId), index("invoices_status_idx").on(t.status)],
);

export type Tenant = typeof tenants.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type StaffUser = typeof staffUsers.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type PlatformAdmin = typeof platformAdmins.$inferSelect;
export type ShippingProvider = typeof shippingProviders.$inferSelect;
export type TenantShippingProvider = typeof tenantShippingProviders.$inferSelect;
export type DiningTable = typeof diningTables.$inferSelect;
export type MediaFile = typeof mediaFiles.$inferSelect;
export type MediaFolder = typeof mediaFolders.$inferSelect;
export type Domain = typeof domains.$inferSelect;
export type SubscriptionInvoice = typeof subscriptionInvoices.$inferSelect;
