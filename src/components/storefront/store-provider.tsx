"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartItem = { key: string; productId: number; name: string; nameAr: string; price: number; qty: number; options: Record<string, string>; image: string };

export type StoreInfo = { slug: string; base: string; tenantId: number; currency: string; name: string; nameAr: string; tableCode: string | null; customerName: string | null };

type Ctx = StoreInfo & {
  items: CartItem[];
  add: (item: Omit<CartItem, "key" | "qty">, qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  count: number;
  subtotal: number;
  hydrated: boolean;
};

const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ info, children }: { info: StoreInfo; children: ReactNode }) {
  const storageKey = `tajer_cart_${info.tenantId}`;
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      setItems([]);
    }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(storageKey, JSON.stringify(items));
  }, [items, hydrated, storageKey]);

  const add = useCallback<Ctx["add"]>((item, qty = 1) => {
    const key = `${item.productId}:${Object.entries(item.options).sort().map(([k, v]) => `${k}=${v}`).join("|")}`;
    setItems((prev) => {
      const ex = prev.find((p) => p.key === key);
      if (ex) return prev.map((p) => (p.key === key ? { ...p, qty: p.qty + qty } : p));
      return [...prev, { ...item, key, qty }];
    });
  }, []);
  const setQty = useCallback((key: string, qty: number) => setItems((prev) => (qty <= 0 ? prev.filter((p) => p.key !== key) : prev.map((p) => (p.key === key ? { ...p, qty } : p)))), []);
  const remove = useCallback((key: string) => setItems((prev) => prev.filter((p) => p.key !== key)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<Ctx>(() => ({
    ...info,
    items,
    add,
    setQty,
    remove,
    clear,
    hydrated,
    count: items.reduce((s, i) => s + i.qty, 0),
    subtotal: items.reduce((s, i) => s + i.qty * i.price, 0),
  }), [info, items, add, setQty, remove, clear, hydrated]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
