import path from "path";
import { chromium } from "@playwright/test";
import fs from "fs-extra";

export async function writePagePdf(htmlPath: string, pdfPath: string): Promise<void> {
  await fs.ensureDir(path.dirname(pdfPath));

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const fileUrl = `file://${path.resolve(htmlPath)}`;
    await page.goto(fileUrl, { waitUntil: "load", timeout: 120000 });
    await page.evaluate(async () => {
      await Promise.all(
        Array.from(document.images).map(
          (img) =>
            img.complete
              ? Promise.resolve()
              : new Promise<void>((resolve) => {
                  img.addEventListener("load", () => resolve(), { once: true });
                  img.addEventListener("error", () => resolve(), { once: true });
                })
        )
      );
    });
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "12mm", left: "8mm", right: "8mm" }
    });
  } finally {
    await browser.close();
  }
}

export async function writePagePdfIfMissing(htmlPath: string, pdfPath: string): Promise<boolean> {
  if (await fs.pathExists(pdfPath)) return true;
  if (!(await fs.pathExists(htmlPath))) return false;
  await writePagePdf(htmlPath, pdfPath);
  return true;
}
