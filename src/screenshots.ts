import { Page } from "@playwright/test";
import { config } from "./config";

const SCROLLBAR_STYLE = `
  html {
    overflow-y: scroll !important;
    scrollbar-gutter: stable;
  }
  body {
    overflow-y: visible !important;
  }
  ::-webkit-scrollbar {
    width: 14px;
    height: 14px;
  }
  ::-webkit-scrollbar-track {
    background: #f1f5f9;
  }
  ::-webkit-scrollbar-thumb {
    background: #94a3b8;
    border-radius: 8px;
    border: 3px solid #f1f5f9;
  }
`;

export async function scrollPageForLazyContent(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const height = Math.max(
      document.body?.scrollHeight ?? 0,
      document.documentElement.scrollHeight,
      document.body?.offsetHeight ?? 0
    );
    const step = Math.max(window.innerHeight, 700);
    let position = 0;

    while (position < height) {
      window.scrollTo(0, position);
      await delay(40);
      position += step;
    }

    window.scrollTo(0, 0);
    await delay(100);
  });
}

/** Capture page screenshot for visual comparison. */
export async function captureFullPageScreenshot(page: Page, filePath: string, timeoutMs = 90000): Promise<void> {
  if (config.fastVisual) {
    await page.screenshot({
      path: filePath,
      fullPage: false,
      timeout: Math.min(timeoutMs, 30000),
      animations: "disabled"
    });
    return;
  }

  await page.addStyleTag({ content: SCROLLBAR_STYLE }).catch(() => undefined);
  await scrollPageForLazyContent(page);
  await page.evaluate(() => window.scrollTo(0, 0));

  await page.screenshot({
    path: filePath,
    fullPage: true,
    timeout: timeoutMs,
    animations: "disabled"
  });
}
