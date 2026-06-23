import path from "path";
import { BrowserContext } from "@playwright/test";
import { captureFullPageScreenshot } from "../screenshots";
import { closePageOverlays, shouldCloseOverlaysBeforeCompare } from "../pageOverlays";
import { compareScreenshots } from "./visualComparator";
import { ensureDir } from "../utils/fileUtils";
import { CategoryResult, Issue } from "../utils/status";

export const MAX_LOCALE_SCREENSHOTS = 20;

export interface LocaleVisualResult {
  lang: string;
  prodUrl: string;
  devUrl: string;
  /** Relative to pageDir — used by HTML reporter */
  prodScreenshot: string;
  devScreenshot: string;
  diffScreenshot: string;
  mismatchPercent: number;
  status: "PASS" | "WARNING" | "FAIL" | "SKIPPED";
  issues: Issue[];
}

function swapBase(url: string, fromBase: string, toBase: string): string {
  const from = fromBase.replace(/\/$/, "");
  const to = toBase.replace(/\/$/, "");
  if (url.startsWith(from)) return to + url.slice(from.length);
  // Fallback: replace only the origin
  try {
    const parsed = new URL(url);
    const target = new URL(to);
    parsed.protocol = target.protocol;
    parsed.host = target.host;
    return parsed.toString();
  } catch {
    return url.replace(from, to);
  }
}

export async function captureAndCompareLocaleScreenshots(
  hreflangList: Array<{ lang: string; href: string }>,
  prodBaseUrl: string,
  devBaseUrl: string,
  prodContext: BrowserContext,
  devContext: BrowserContext,
  pageDir: string
): Promise<CategoryResult & { details: { locales: LocaleVisualResult[] } }> {
  const locales = hreflangList
    .filter((item) => item.lang && item.lang !== "x-default" && item.href)
    .slice(0, MAX_LOCALE_SCREENSHOTS);

  if (!locales.length) {
    return {
      status: "SKIPPED",
      summary: "No hreflang language variants found on this page",
      issues: [],
      details: { locales: [] }
    };
  }

  const allIssues: Issue[] = [];
  const results: LocaleVisualResult[] = [];

  for (const locale of locales) {
    const prodUrl = locale.href;
    const devUrl = swapBase(prodUrl, prodBaseUrl, devBaseUrl);

    const localeDir = path.join(pageDir, "locales", locale.lang);
    await ensureDir(localeDir);

    const prodScreenshotAbs = path.join(localeDir, "prod.png");
    const devScreenshotAbs = path.join(localeDir, "dev.png");
    const diffScreenshotAbs = path.join(localeDir, "diff.png");

    // Paths relative to pageDir for use in HTML reports
    const prodScreenshot = path.join("locales", locale.lang, "prod.png");
    const devScreenshot = path.join("locales", locale.lang, "dev.png");
    const diffScreenshot = path.join("locales", locale.lang, "diff.png");

    const prodPage = await prodContext.newPage();
    const devPage = await devContext.newPage();

    try {
      // Load both pages in parallel, then dismiss overlays on each
      await Promise.all([
        prodPage.goto(prodUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => undefined),
        devPage.goto(devUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => undefined)
      ]);

      // Wait for network to quiet down so JS-rendered overlays have time to mount
      await Promise.all([
        prodPage.waitForLoadState("load", { timeout: 15000 }).catch(() => undefined),
        devPage.waitForLoadState("load", { timeout: 15000 }).catch(() => undefined)
      ]);

      // Dismiss cookie banners, chat widgets, alerts, and any other overlays
      if (shouldCloseOverlaysBeforeCompare()) {
        await Promise.all([
          closePageOverlays(prodPage).catch(() => undefined),
          closePageOverlays(devPage).catch(() => undefined)
        ]);
      }

      await Promise.all([
        captureFullPageScreenshot(prodPage, prodScreenshotAbs),
        captureFullPageScreenshot(devPage, devScreenshotAbs)
      ]);

      const compareResult = await compareScreenshots(
        prodScreenshotAbs,
        devScreenshotAbs,
        diffScreenshotAbs
      );

      const localeIssues: Issue[] = compareResult.issues.map((issue) => ({
        ...issue,
        category: `Visual [${locale.lang}]`
      }));
      allIssues.push(...localeIssues);

      const details = compareResult.details as { mismatchPercent?: number } | undefined;

      results.push({
        lang: locale.lang,
        prodUrl,
        devUrl,
        prodScreenshot,
        devScreenshot,
        diffScreenshot,
        mismatchPercent: details?.mismatchPercent ?? 0,
        status: compareResult.status as "PASS" | "WARNING" | "FAIL" | "SKIPPED",
        issues: localeIssues
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const localeIssues: Issue[] = [
        {
          severity: "FAIL",
          category: `Visual [${locale.lang}]`,
          source: "comparison",
          message: msg
        }
      ];
      allIssues.push(...localeIssues);
      results.push({
        lang: locale.lang,
        prodUrl,
        devUrl,
        prodScreenshot: "",
        devScreenshot: "",
        diffScreenshot: "",
        mismatchPercent: 0,
        status: "FAIL",
        issues: localeIssues
      });
    } finally {
      await prodPage.close().catch(() => undefined);
      await devPage.close().catch(() => undefined);
    }
  }

  const passed = results.filter((r) => r.status === "PASS").length;
  const overallStatus = allIssues.some((i) => i.severity === "FAIL")
    ? "FAIL"
    : allIssues.some((i) => i.severity === "WARNING")
      ? "WARNING"
      : "PASS";

  return {
    status: overallStatus,
    summary: `${results.length} locale(s) compared — ${passed} passed`,
    issues: allIssues,
    details: { locales: results }
  };
}
