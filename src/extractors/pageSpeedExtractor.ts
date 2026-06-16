import { Page } from "@playwright/test";

export interface PageSpeedMetrics {
  wallClockMs: number;
  domContentLoadedMs: number;
  loadCompleteMs: number;
  ttfbMs: number;
  transferSizeBytes: number;
}

export async function extractPageSpeed(page: Page, wallClockMs: number): Promise<PageSpeedMetrics> {
  const navigation = await page.evaluate(() => {
    const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (!entry) {
      return {
        domContentLoadedMs: 0,
        loadCompleteMs: 0,
        ttfbMs: 0,
        transferSizeBytes: 0
      };
    }

    return {
      domContentLoadedMs: Math.round(entry.domContentLoadedEventEnd - entry.startTime),
      loadCompleteMs: Math.round(entry.loadEventEnd - entry.startTime),
      ttfbMs: Math.round(entry.responseStart - entry.startTime),
      transferSizeBytes: Math.round(entry.transferSize || 0)
    };
  });

  return {
    wallClockMs: Math.round(wallClockMs),
    ...navigation
  };
}
