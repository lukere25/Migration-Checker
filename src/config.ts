import path from "path";

export const config = {
  prodBaseUrl: process.env.PROD_BASE_URL || "https://www.netapp.com",
  devBaseUrl: process.env.DEV_BASE_URL || "https://netapp-e25migration.vercel.app",
  devPassword: process.env.DEV_PASSWORD || "T2'U,0_(pl69",
  /** CLI fallback only — UI runs always pass EXCEL_PATH to the uploaded file. */
  excelPath: "Copy of Netapp - QA Regression.xlsx",
  reportsDir: process.env.REPORTS_DIR || "reports",
  authStoragePath: path.join(".auth", "dev-storage.json"),
  startIndex: 1,
  maxPages: process.env.MAX_PAGES ? Number(process.env.MAX_PAGES) : undefined,
  thresholds: {
    contentSimilarityPass: 0.95,
    contentSimilarityWarning: 0.85,
    visualPassPercent: 2,
    visualWarningPercent: 8
  },
  linkStatusCheckLimit: process.env.LINK_STATUS_CHECK_LIMIT
    ? Number(process.env.LINK_STATUS_CHECK_LIMIT)
    : 12,
  /** Set GENERATE_PDF=true to build per-page PDF reports (slower). */
  generatePdf: process.env.GENERATE_PDF === "true",
  /** Set FAST_VISUAL=true for viewport screenshots instead of full-page scroll capture. */
  fastVisual: process.env.FAST_VISUAL === "true",
  /** Default Playwright project (desktop Chrome). Set PLAYWRIGHT_ALL_BROWSERS=true to run iPad + Safari too. */
  defaultPlaywrightProject: process.env.PLAYWRIGHT_PROJECT || "chromium-desktop"
};

export type AppConfig = typeof config;
