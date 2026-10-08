import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit", "exceljs", "sharp", "bcryptjs", "qrcode"],
  outputFileTracingIncludes: {
    "/api/store/[slug]/reports/export": ["./public/fonts/**/*", "./node_modules/pdfkit/js/data/**/*"],
  },
  poweredByHeader: false,
};

export default nextConfig;
