import { ImageData } from "../extractors/imageExtractor";
import { normalizeImageKey, normalizeText } from "../utils/normalize";
import { CategoryResult, Issue, statusFromIssues } from "../utils/status";

export function compareImages(prod: ImageData[], dev: ImageData[]): CategoryResult {
  const issues: Issue[] = [];
  const prodByKey = new Map(prod.map((image) => [normalizeImageKey(image.currentSrc || image.src), image]));
  const devByKey = new Map(dev.map((image) => [normalizeImageKey(image.currentSrc || image.src), image]));

  if (prod.length !== dev.length) {
    issues.push({
      severity: "WARNING",
      category: "Images",
      source: "comparison",
      message: "Visible image count differs",
      prodValue: String(prod.length),
      devValue: String(dev.length)
    });
  }

  for (const [key, prodImage] of prodByKey) {
    const devImage = devByKey.get(key);
    if (!devImage) {
      issues.push({ severity: "FAIL", category: "Images", source: "dev", message: "Image missing on dev", prodValue: prodImage.currentSrc || prodImage.src });
      continue;
    }
    if (normalizeText(prodImage.alt) !== normalizeText(devImage.alt)) {
      issues.push({
        severity: "WARNING",
        category: "Images",
        source: "comparison",
        message: "Image alt text differs",
        prodValue: prodImage.alt,
        devValue: devImage.alt,
        url: devImage.currentSrc || devImage.src
      });
    }
  }

  for (const image of dev) {
    if (!image.isBackground && !image.alt && image.width > 20 && image.height > 20) {
      issues.push({ severity: "WARNING", category: "Images", source: "dev", message: "Meaningful image may have empty alt text", url: image.currentSrc || image.src });
    }
    if (!image.isBackground && image.naturalWidth === 0) {
      issues.push({ severity: "FAIL", category: "Images", source: "dev", message: "Broken image detected", url: image.currentSrc || image.src });
    }
  }

  const result = statusFromIssues(issues, "Images match");
  return { ...result, details: { prodCount: prod.length, devCount: dev.length } };
}
