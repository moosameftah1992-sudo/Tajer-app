export const PERMISSIONS = [
  "dashboard",
  "orders",
  "pos",
  "catalog",
  "media",
  "customers",
  "reports",
  "staff",
  "tables",
  "settings",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const STAFF_ROLES = ["owner", "admin", "manager", "cashier", "stock_keeper", "custom"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const ROLE_PRESETS: Record<StaffRole, Permission[]> = {
  owner: [...PERMISSIONS],
  admin: [...PERMISSIONS],
  manager: ["dashboard", "orders", "pos", "catalog", "media", "customers", "reports", "tables"],
  cashier: ["pos", "orders", "customers"],
  stock_keeper: ["catalog", "media"],
  custom: [],
};

export const ADMIN_ROLES = ["super", "manager", "support"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_PERMISSIONS = ["merchants", "plans", "admins", "logistics", "billing", "settings"] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export const ADMIN_ROLE_PRESETS: Record<AdminRole, AdminPermission[]> = {
  super: [...ADMIN_PERMISSIONS],
  manager: ["merchants", "plans", "logistics", "billing"],
  support: ["merchants"],
};

export function hasPermission(perms: string[] | null | undefined, role: string, p: Permission) {
  if (role === "owner") return true;
  return Array.isArray(perms) && perms.includes(p);
}

export function adminHas(perms: string[] | null | undefined, role: string, p: AdminPermission) {
  if (role === "super") return true;
  return Array.isArray(perms) && perms.includes(p);
}
