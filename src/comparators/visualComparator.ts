import fs from "fs";
import { PNG } from "pngjs";
import { config } from "../config";
import { CategoryResult, Issue } from "../utils/status";

export interface VisualResult {
  mismatchPercent: number;
  diffPixels: number;
  width: number;
  height: number;
  dimensionsMatch: boolean;
}

function readPng(filePath: string): PNG {
  return PNG.sync.read(fs.readFileSync(filePath));
}

export async function compareScreenshots(prodPath: string, devPath: string, diffPath: string): Promise<CategoryResult<VisualResult>> {
  const { default: pixelmatch } = await import("pixelmatch");
  const prod = readPng(prodPath);
  const dev = readPng(devPath);
  const width = Math.min(prod.width, dev.width);
  const height = Math.min(prod.height, dev.height);
  const dimensionsMatch = prod.width === dev.width && prod.height === dev.height;

  const prodCropped = new PNG({ width, height });
  const devCropped = new PNG({ width, height });
  PNG.bitblt(prod, prodCropped, 0, 0, width, height, 0, 0);
  PNG.bitblt(dev, devCropped, 0, 0, width, height, 0, 0);

  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(prodCropped.data, devCropped.data, diff.data, width, height, { threshold: 0.1 });
  fs.writeFileSync(diffPath, PNG.sync.write(diff));

  const mismatchPercent = (diffPixels / (width * height)) * 100;
  const issues: Issue[] = [];

  if (!dimensionsMatch) {
    issues.push({
      severity: "WARNING",
      category: "Visual diff",
      source: "comparison",
      message: "Full-page screenshot dimensions differ; diff compares the overlapping top region only",
      prodValue: `${prod.width}x${prod.height}`,
      devValue: `${dev.width}x${dev.height}`
    });
  }

  if (mismatchPercent > config.thresholds.visualWarningPercent) {
    issues.push({
      severity: "FAIL",
      category: "Visual diff",
      source: "comparison",
      message: `Visual mismatch ${mismatchPercent.toFixed(2)}% exceeds fail threshold`
    });
  } else if (mismatchPercent > config.thresholds.visualPassPercent) {
    issues.push({
      severity: "WARNING",
      category: "Visual diff",
      source: "comparison",
      message: `Visual mismatch ${mismatchPercent.toFixed(2)}% exceeds warning threshold`
    });
  }

  return {
    status: issues.some((issue) => issue.severity === "FAIL") ? "FAIL" : issues.length ? "WARNING" : "PASS",
    summary: `Mismatch ${mismatchPercent.toFixed(2)}%`,
    issues,
    details: { mismatchPercent, diffPixels, width, height, dimensionsMatch }
  };
}
