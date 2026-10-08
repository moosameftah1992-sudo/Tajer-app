"use client";

import { createContext, useContext, useMemo, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, dictionaries, interpolate, type Locale, type TKey } from "@/lib/i18n";

type Ctx = {
  locale: Locale;
  dir: "rtl" | "ltr";
  t: (key: TKey, vars?: Record<string, string | number>) => string;
  setLocale: (l: Locale) => void;
};

const LocaleContext = createContext<Ctx | null>(null);

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const value = useMemo<Ctx>(() => {
    const dict = dictionaries[locale];
    return {
      locale,
      dir: locale === "ar" ? "rtl" : "ltr",
      t: (key, vars) => interpolate(dict[key] ?? key, vars),
      setLocale: (l) => {
        document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
        document.documentElement.lang = l;
        document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
        startTransition(() => router.refresh());
      },
    };
  }, [locale, router]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useT() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useT must be used inside LocaleProvider");
  return ctx;
}

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useT();
  const other: Locale = locale === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      onClick={() => setLocale(other)}
      className={`inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 ${className}`}
      aria-label="Switch language"
    >
      <span aria-hidden>🌐</span>
      {other === "ar" ? "العربية" : "English"}
    </button>
  );
}
