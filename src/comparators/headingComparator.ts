import { Heading } from "../extractors/headingExtractor";
import { normalizeText, normalizeWhitespace } from "../utils/normalize";
import { CategoryResult, Issue, statusFromIssues } from "../utils/status";

export function compareHeadings(prod: Heading[], dev: Heading[]): CategoryResult {
  const issues: Issue[] = [];
  const prodH1 = prod.filter((heading) => heading.level === 1);
  const devH1 = dev.filter((heading) => heading.level === 1);

  if (!devH1.length) {
    issues.push({ severity: "FAIL", category: "Heading map", source: "dev", message: "Dev page is missing H1" });
  }
  if (prodH1.length !== devH1.length) {
    issues.push({
      severity: "FAIL",
      category: "Heading map",
      source: "comparison",
      message: "H1 count differs",
      prodValue: String(prodH1.length),
      devValue: String(devH1.length)
    });
  }
  if (prod.length !== dev.length) {
    issues.push({
      severity: "WARNING",
      category: "Heading map",
      source: "comparison",
      message: "Visible heading count differs",
      prodValue: String(prod.length),
      devValue: String(dev.length)
    });
  }

  const count = Math.min(prod.length, dev.length);
  for (let index = 0; index < count; index += 1) {
    const prodHeading = prod[index];
    const devHeading = dev[index];
    if (prodHeading.level !== devHeading.level) {
      issues.push({
        severity: "FAIL",
        category: "Heading map",
        source: "comparison",
        message: `Heading level differs at index ${index}`,
        prodValue: `h${prodHeading.level} ${prodHeading.text}`,
        devValue: `h${devHeading.level} ${devHeading.text}`
      });
    }
    if (normalizeText(prodHeading.text) !== normalizeText(devHeading.text)) {
      issues.push({
        severity: normalizeWhitespace(prodHeading.text) === normalizeWhitespace(devHeading.text) ? "WARNING" : "FAIL",
        category: "Heading map",
        source: "comparison",
        message: `Heading text differs at index ${index}`,
        prodValue: prodHeading.text,
        devValue: devHeading.text
      });
    }
  }

  const result = statusFromIssues(issues, "Heading map matches");
  return { ...result, details: { prod, dev } };
}
