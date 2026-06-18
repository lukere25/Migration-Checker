import { Page } from "@playwright/test";
import path from "path";
import fs from "fs-extra";
import {
  drawSpacingGapMarkers,
  extractModuleSpacing,
  gapColorAt,
  ModuleSpacingData,
  removeSpacingOverlay,
  SpacingGapColor
} from "./extractors/spacingExtractor";
import { scrollPageForLazyContent } from "./screenshots";

const SCREENSHOT_TIMEOUT_MS = 90000;

async function preparePage(page: Page): Promise<void> {
  await scrollPageForLazyContent(page);
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function captureWithGapMarkers(
  page: Page,
  outputPath: string,
  palette: SpacingGapColor[]
): Promise<ModuleSpacingData> {
  const data = await extractModuleSpacing(page);
  await drawSpacingGapMarkers(page, data, palette);

  await page.screenshot({
    path: outputPath,
    fullPage: true,
    animations: "disabled",
    timeout: SCREENSHOT_TIMEOUT_MS
  });

  await removeSpacingOverlay(page);
  return data;
}

export async function captureModuleSpacingScreenshots(
  prodPage: Page,
  devPage: Page,
  outputDir: string
): Promise<{ prod: ModuleSpacingData; dev: ModuleSpacingData }> {
  await fs.ensureDir(outputDir);
  await Promise.all([preparePage(prodPage), preparePage(devPage)]);

  const [prodDraft, devDraft] = await Promise.all([
    extractModuleSpacing(prodPage),
    extractModuleSpacing(devPage)
  ]);

  const palette = Array.from(
    { length: Math.max(prodDraft.gaps.length, devDraft.gaps.length, 1) },
    (_, index) => gapColorAt(index)
  );

  const overviewProd = path.join(outputDir, "fullpage-prod.png");
  const overviewDev = path.join(outputDir, "fullpage-dev.png");

  const [prodData, devData] = await Promise.all([
    captureWithGapMarkers(prodPage, overviewProd, palette),
    captureWithGapMarkers(devPage, overviewDev, palette)
  ]);

  return {
    prod: {
      ...prodData,
      overviewProdScreenshot: overviewProd,
      overviewDevScreenshot: overviewDev
    },
    dev: {
      ...devData,
      overviewProdScreenshot: overviewProd,
      overviewDevScreenshot: overviewDev
    }
  };
}
