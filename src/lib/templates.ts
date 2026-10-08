import { readableTextColor } from "./utils";

export type TemplateFont = "sans" | "serif" | "display" | "mono" | "rounded";
export type TemplateConfig = {
  id: number;
  name: string;
  nameAr: string;
  category: string;
  palette: { primary: string; secondary: string; background: string; surface: string; text: string; muted: string };
  font: TemplateFont;
  radius: "none" | "sm" | "md" | "lg" | "full";
  header: "classic" | "centered" | "minimal" | "bar" | "transparent";
  hero: "split" | "fullbleed" | "minimal" | "centered" | "card" | "none" | "mosaic";
  card: "classic" | "overlay" | "minimal" | "bordered" | "horizontal" | "luxury" | "tile";
  categoryNav: "pills" | "sidebar" | "tabs" | "grid" | "scroll";
  grid: 2 | 3 | 4;
  dark: boolean;
  decor: "dots" | "lines" | "gradient" | "none";
  sectionTitleKey: "shop_all" | "our_menu" | "new_arrivals" | "best_sellers";
};

const T = (c: TemplateConfig) => c;

export const TEMPLATES: TemplateConfig[] = [
  T({ id: 1, name: "Minimal Clean", nameAr: "البسيط النظيف", category: "general", palette: { primary: "#10B981", secondary: "#0F172A", background: "#FFFFFF", surface: "#F8FAFC", text: "#0F172A", muted: "#64748B" }, font: "sans", radius: "md", header: "classic", hero: "split", card: "classic", categoryNav: "pills", grid: 4, dark: false, decor: "none", sectionTitleKey: "shop_all" }),
  T({ id: 2, name: "Restaurant Classic", nameAr: "المطعم الكلاسيكي", category: "restaurant", palette: { primary: "#B91C1C", secondary: "#1C1917", background: "#FFF7ED", surface: "#FFFFFF", text: "#1C1917", muted: "#78716C" }, font: "serif", radius: "sm", header: "centered", hero: "fullbleed", card: "horizontal", categoryNav: "tabs", grid: 2, dark: false, decor: "lines", sectionTitleKey: "our_menu" }),
  T({ id: 3, name: "Dark Menu", nameAr: "القائمة الداكنة", category: "restaurant", palette: { primary: "#F59E0B", secondary: "#FBBF24", background: "#0B0F19", surface: "#111827", text: "#F9FAFB", muted: "#9CA3AF" }, font: "sans", radius: "lg", header: "bar", hero: "centered", card: "overlay", categoryNav: "sidebar", grid: 3, dark: true, decor: "gradient", sectionTitleKey: "our_menu" }),
  T({ id: 4, name: "Café Warm", nameAr: "المقهى الدافئ", category: "cafe", palette: { primary: "#92400E", secondary: "#451A03", background: "#FDF6EC", surface: "#FFFFFF", text: "#451A03", muted: "#A16207" }, font: "rounded", radius: "lg", header: "classic", hero: "card", card: "minimal", categoryNav: "scroll", grid: 3, dark: false, decor: "dots", sectionTitleKey: "our_menu" }),
  T({ id: 5, name: "Grocery Fresh", nameAr: "البقالة الطازجة", category: "grocery", palette: { primary: "#16A34A", secondary: "#14532D", background: "#F0FDF4", surface: "#FFFFFF", text: "#052E16", muted: "#4D7C0F" }, font: "sans", radius: "md", header: "classic", hero: "split", card: "bordered", categoryNav: "sidebar", grid: 4, dark: false, decor: "none", sectionTitleKey: "shop_all" }),
  T({ id: 6, name: "Supermarket Grid", nameAr: "شبكة السوبرماركت", category: "grocery", palette: { primary: "#2563EB", secondary: "#1E3A8A", background: "#FFFFFF", surface: "#F1F5F9", text: "#0F172A", muted: "#64748B" }, font: "sans", radius: "sm", header: "bar", hero: "none", card: "tile", categoryNav: "grid", grid: 4, dark: false, decor: "none", sectionTitleKey: "best_sellers" }),
  T({ id: 7, name: "Jewelry Luxe", nameAr: "المجوهرات الفاخرة", category: "jewelry", palette: { primary: "#B8860B", secondary: "#F5E6C8", background: "#0A0A0A", surface: "#171717", text: "#FAFAF9", muted: "#A8A29E" }, font: "serif", radius: "none", header: "centered", hero: "fullbleed", card: "luxury", categoryNav: "pills", grid: 3, dark: true, decor: "lines", sectionTitleKey: "new_arrivals" }),
  T({ id: 8, name: "Gold & Diamonds", nameAr: "الذهب والألماس", category: "jewelry", palette: { primary: "#C9A227", secondary: "#1F2937", background: "#FFFDF7", surface: "#FFFFFF", text: "#1F2937", muted: "#8A7A4A" }, font: "serif", radius: "none", header: "centered", hero: "centered", card: "luxury", categoryNav: "tabs", grid: 3, dark: false, decor: "lines", sectionTitleKey: "new_arrivals" }),
  T({ id: 9, name: "Fashion Editorial", nameAr: "الأزياء التحريرية", category: "fashion", palette: { primary: "#111827", secondary: "#6B7280", background: "#FFFFFF", surface: "#F9FAFB", text: "#111827", muted: "#6B7280" }, font: "display", radius: "none", header: "minimal", hero: "mosaic", card: "minimal", categoryNav: "tabs", grid: 3, dark: false, decor: "none", sectionTitleKey: "new_arrivals" }),
  T({ id: 10, name: "Streetwear Bold", nameAr: "ستريت وير الجريء", category: "fashion", palette: { primary: "#EF4444", secondary: "#111111", background: "#FAFAFA", surface: "#FFFFFF", text: "#111111", muted: "#525252" }, font: "display", radius: "lg", header: "bar", hero: "fullbleed", card: "overlay", categoryNav: "scroll", grid: 2, dark: false, decor: "gradient", sectionTitleKey: "new_arrivals" }),
  T({ id: 11, name: "Boutique Elegant", nameAr: "البوتيك الأنيق", category: "boutique", palette: { primary: "#BE185D", secondary: "#500724", background: "#FFF1F2", surface: "#FFFFFF", text: "#4C0519", muted: "#9F1239" }, font: "serif", radius: "lg", header: "centered", hero: "split", card: "classic", categoryNav: "pills", grid: 3, dark: false, decor: "dots", sectionTitleKey: "new_arrivals" }),
  T({ id: 12, name: "Electronics Tech", nameAr: "الإلكترونيات التقنية", category: "electronics", palette: { primary: "#0EA5E9", secondary: "#0C4A6E", background: "#F8FAFC", surface: "#FFFFFF", text: "#0F172A", muted: "#475569" }, font: "sans", radius: "md", header: "classic", hero: "card", card: "bordered", categoryNav: "sidebar", grid: 4, dark: false, decor: "none", sectionTitleKey: "best_sellers" }),
  T({ id: 13, name: "Gadgets Neon", nameAr: "الأجهزة النيون", category: "electronics", palette: { primary: "#22D3EE", secondary: "#A855F7", background: "#030712", surface: "#0F172A", text: "#F1F5F9", muted: "#94A3B8" }, font: "mono", radius: "sm", header: "bar", hero: "centered", card: "overlay", categoryNav: "tabs", grid: 3, dark: true, decor: "gradient", sectionTitleKey: "best_sellers" }),
  T({ id: 14, name: "Bakery Sweet", nameAr: "المخبز الحلو", category: "bakery", palette: { primary: "#D97706", secondary: "#78350F", background: "#FFFBEB", surface: "#FFFFFF", text: "#451A03", muted: "#B45309" }, font: "rounded", radius: "full", header: "centered", hero: "card", card: "classic", categoryNav: "scroll", grid: 3, dark: false, decor: "dots", sectionTitleKey: "best_sellers" }),
  T({ id: 15, name: "Perfume Noir", nameAr: "العطور الليلية", category: "perfume", palette: { primary: "#A78BFA", secondary: "#C4B5FD", background: "#0F0A1F", surface: "#1E1538", text: "#F5F3FF", muted: "#A78BFA" }, font: "serif", radius: "none", header: "minimal", hero: "fullbleed", card: "luxury", categoryNav: "pills", grid: 4, dark: true, decor: "gradient", sectionTitleKey: "new_arrivals" }),
  T({ id: 16, name: "Pharmacy Clean", nameAr: "الصيدلية النظيفة", category: "pharmacy", palette: { primary: "#0D9488", secondary: "#134E4A", background: "#F0FDFA", surface: "#FFFFFF", text: "#042F2E", muted: "#115E59" }, font: "sans", radius: "md", header: "classic", hero: "split", card: "bordered", categoryNav: "sidebar", grid: 4, dark: false, decor: "none", sectionTitleKey: "shop_all" }),
  T({ id: 17, name: "Bookstore Classic", nameAr: "المكتبة الكلاسيكية", category: "books", palette: { primary: "#7C2D12", secondary: "#292524", background: "#FEF3C7", surface: "#FFFBEB", text: "#292524", muted: "#78350F" }, font: "serif", radius: "sm", header: "classic", hero: "split", card: "horizontal", categoryNav: "tabs", grid: 2, dark: false, decor: "lines", sectionTitleKey: "best_sellers" }),
  T({ id: 18, name: "Kids Playful", nameAr: "الأطفال المرح", category: "kids", palette: { primary: "#F97316", secondary: "#8B5CF6", background: "#FFF7ED", surface: "#FFFFFF", text: "#1E1B4B", muted: "#7C3AED" }, font: "rounded", radius: "full", header: "bar", hero: "centered", card: "tile", categoryNav: "pills", grid: 3, dark: false, decor: "dots", sectionTitleKey: "shop_all" }),
  T({ id: 19, name: "Furniture Modern", nameAr: "الأثاث العصري", category: "furniture", palette: { primary: "#44403C", secondary: "#A8A29E", background: "#FAFAF9", surface: "#FFFFFF", text: "#1C1917", muted: "#78716C" }, font: "sans", radius: "none", header: "minimal", hero: "mosaic", card: "minimal", categoryNav: "tabs", grid: 3, dark: false, decor: "none", sectionTitleKey: "new_arrivals" }),
  T({ id: 20, name: "Flowers Pastel", nameAr: "الزهور الباستيل", category: "flowers", palette: { primary: "#DB2777", secondary: "#9D174D", background: "#FDF2F8", surface: "#FFFFFF", text: "#500724", muted: "#BE185D" }, font: "serif", radius: "lg", header: "centered", hero: "card", card: "overlay", categoryNav: "scroll", grid: 3, dark: false, decor: "gradient", sectionTitleKey: "new_arrivals" }),
  T({ id: 21, name: "Hypermarket Deals", nameAr: "عروض الهايبر", category: "grocery", palette: { primary: "#DC2626", secondary: "#FACC15", background: "#FFFFFF", surface: "#FEF2F2", text: "#111827", muted: "#6B7280" }, font: "sans", radius: "sm", header: "bar", hero: "fullbleed", card: "tile", categoryNav: "grid", grid: 4, dark: false, decor: "none", sectionTitleKey: "best_sellers" }),
  T({ id: 22, name: "Luxury Boutique Dark", nameAr: "بوتيك فاخر داكن", category: "boutique", palette: { primary: "#E5E7EB", secondary: "#9CA3AF", background: "#111111", surface: "#1C1C1C", text: "#F5F5F5", muted: "#A3A3A3" }, font: "display", radius: "none", header: "minimal", hero: "mosaic", card: "luxury", categoryNav: "pills", grid: 3, dark: true, decor: "none", sectionTitleKey: "new_arrivals" }),
];

export function getTemplate(id: number): TemplateConfig {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

export const TEMPLATE_FOR_BUSINESS: Record<string, number> = {
  restaurant: 2,
  cafe: 4,
  grocery: 5,
  jewelry: 8,
  fashion: 9,
  boutique: 11,
  electronics: 12,
  bakery: 14,
  perfume: 15,
  pharmacy: 16,
  general: 1,
};

export const FONT_STACKS: Record<TemplateFont, string> = {
  sans: "'Inter', 'Cairo', ui-sans-serif, system-ui, sans-serif",
  serif: "'Playfair Display', 'Amiri', 'Cairo', Georgia, serif",
  display: "'Oswald', 'Cairo', 'Arial Narrow', sans-serif",
  mono: "'JetBrains Mono', 'Cairo', ui-monospace, monospace",
  rounded: "'Nunito', 'Tajawal', 'Cairo', system-ui, sans-serif",
};

export const MERCHANT_FONTS: Record<string, string> = {
  default: "",
  cairo: "'Cairo', 'Inter', system-ui, sans-serif",
  tajawal: "'Tajawal', 'Inter', system-ui, sans-serif",
  inter: "'Inter', 'Cairo', system-ui, sans-serif",
  serif: "'Playfair Display', 'Amiri', Georgia, serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
};

const RADII = { none: "0px", sm: "4px", md: "10px", lg: "18px", full: "28px" } as const;

export type ThemeInput = {
  templateId: number;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  typographyScale: string | number;
  fontFamily: string;
};

/** Resolve DB-driven style variables merged with template defaults into CSS custom properties. */
export function resolveTheme(input: ThemeInput) {
  const tpl = getTemplate(input.templateId);
  const primary = input.primaryColor || tpl.palette.primary;
  const secondary = input.secondaryColor || tpl.palette.secondary;
  const background = input.backgroundColor || tpl.palette.background;
  const dark = readableTextColor(background) === "#FFFFFF";
  const text = dark ? "#F8FAFC" : tpl.palette.text;
  const surface = dark ? mix(background, "#FFFFFF", 0.07) : tpl.dark ? "#FFFFFF" : tpl.palette.surface;
  const muted = dark ? "#A1A1AA" : tpl.palette.muted;
  const border = dark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.1)";
  const scale = Math.min(1.4, Math.max(0.8, Number(input.typographyScale) || 1));
  const font = MERCHANT_FONTS[input.fontFamily] || FONT_STACKS[tpl.font];
  const vars: Record<string, string> = {
    "--sf-primary": primary,
    "--sf-primary-fg": readableTextColor(primary),
    "--sf-secondary": secondary,
    "--sf-secondary-fg": readableTextColor(secondary),
    "--sf-bg": background,
    "--sf-surface": surface,
    "--sf-text": text,
    "--sf-muted": muted,
    "--sf-border": border,
    "--sf-radius": RADII[tpl.radius],
    "--sf-scale": String(scale),
    "--sf-font": font,
    "--sf-primary-soft": `color-mix(in srgb, ${primary} 12%, ${background})`,
  };
  return { tpl, vars, dark };
}

function mix(a: string, b: string, w: number) {
  const pa = parseInt(a.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  const pb = parseInt(b.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - w) + ((pb >> shift) & 255) * w);
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}
