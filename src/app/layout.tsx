import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { getLocale } from "@/lib/server-i18n";
import { LocaleProvider } from "@/components/locale-provider";

export const metadata: Metadata = {
  title: "Tajer | تاجر — Cloud Commerce & POS",
  description: "Multi-tenant e-commerce & POS platform for GCC merchants. Independent storefronts, cloud POS, QR dine-in, logistics and advanced reporting.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Inter:wght@400;500;600;700;800&family=Tajawal:wght@400;500;700&family=Playfair+Display:wght@400;600;700&family=Nunito:wght@400;600;700;800&family=Oswald:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#F8FAFC] text-[#0F172A] antialiased">
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
