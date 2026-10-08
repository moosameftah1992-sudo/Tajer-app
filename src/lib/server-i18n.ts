import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, isLocale, translate, type Locale, type TKey } from "./i18n";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const c = store.get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  const h = await headers();
  const accept = h.get("accept-language") ?? "";
  return /^ar\b|,ar\b/i.test(accept) ? "ar" : "en";
}

export async function getT() {
  const locale = await getLocale();
  return {
    locale,
    dir: locale === "ar" ? ("rtl" as const) : ("ltr" as const),
    t: (key: TKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
  };
}
