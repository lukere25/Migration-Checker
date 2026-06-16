import { Browser, BrowserContext, chromium, Page } from "@playwright/test";
import { isPlaywrightHeadless } from "./headless";
import { logger } from "./utils/logger";

const chromeLaunchOptions = {
  channel: "chrome" as const,
  headless: isPlaywrightHeadless(),
  ignoreDefaultArgs: ["--enable-automation"],
  args: ["--disable-blink-features=AutomationControlled"]
};

const chromiumFallbackOptions = {
  headless: isPlaywrightHeadless(),
  ignoreDefaultArgs: ["--enable-automation"],
  args: ["--disable-blink-features=AutomationControlled"]
};

export function ensureHttps(url: string): string {
  const parsed = new URL(url);
  if (parsed.protocol === "http:") {
    parsed.protocol = "https:";
  }
  return parsed.toString();
}

/** Live site loads use installed Google Chrome when available (same as a normal browser window). */
export async function launchLiveSiteBrowser(): Promise<Browser> {
  try {
    return await chromium.launch(chromeLaunchOptions);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Could not launch Google Chrome (${message}). Falling back to Chromium.`);
    return chromium.launch(chromiumFallbackOptions);
  }
}

/** Reuse the same Chrome/Chromium launch path for migration site pages. */
export async function launchDevSiteBrowser(): Promise<Browser> {
  return launchLiveSiteBrowser();
}

const blockedResourcePattern =
  /google-analytics\.com|googletagmanager\.com|doubleclick\.net|facebook\.net|hotjar\.com|clarity\.ms|segment\.io|fullstory\.com|optimizely\.com/i;

export async function configureFastContext(context: BrowserContext): Promise<void> {
  await context.route("**/*", (route) => {
    const type = route.request().resourceType();
    if (type === "media" || blockedResourcePattern.test(route.request().url())) {
      return route.abort();
    }
    return route.continue();
  });
}

export async function newProdContext(
  browser: Browser,
  options: { viewport: { width: number; height: number }; isMobile?: boolean; hasTouch?: boolean }
): Promise<BrowserContext> {
  const isMobile = options.isMobile ?? options.viewport.width < 900;
  const hasTouch = options.hasTouch ?? isMobile;

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: "en-US",
    timezoneId: "America/Los_Angeles",
    viewport: options.viewport,
    deviceScaleFactor: isMobile ? 2 : 1,
    isMobile,
    hasTouch
  });
  await configureFastContext(context);
  return context;
}

export async function newDevContext(
  browser: Browser,
  storageState: string,
  viewport: { width: number; height: number },
  options?: { isMobile?: boolean; hasTouch?: boolean }
): Promise<BrowserContext> {
  const isMobile = options?.isMobile ?? viewport.width < 900;
  const hasTouch = options?.hasTouch ?? isMobile;

  const context = await browser.newContext({
    storageState,
    ignoreHTTPSErrors: true,
    locale: "en-US",
    viewport,
    isMobile,
    hasTouch
  });
  await configureFastContext(context);
  return context;
}

export async function isAccessDeniedPage(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const text = (document.body?.innerText || "").replace(/\s+/g, " ");
    return (
      /access denied/i.test(text) &&
      (/edgesuite\.net|akamai|you don't have permission to access/i.test(text) || document.title === "Access Denied")
    );
  });
}

export async function waitForProdPageContent(page: Page): Promise<void> {
  await page
    .locator('header, nav, main, [role="main"], article, body')
    .first()
    .waitFor({ state: "visible", timeout: 8000 })
    .catch(() => undefined);
}
