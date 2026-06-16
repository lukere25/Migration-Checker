import { TextStyleSample, styleSignature } from "../extractors/textStyleExtractor";
import { normalizeText } from "../utils/normalize";
import { CategoryResult, Issue, statusFromIssues } from "../utils/status";

const STYLE_FIELDS: Array<keyof TextStyleSample["styles"]> = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "color",
  "letterSpacing",
  "textTransform"
];

function labelStyleField(field: keyof TextStyleSample["styles"]): string {
  return field.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

export function compareTextStyles(prod: TextStyleSample[], dev: TextStyleSample[]): CategoryResult {
  const issues: Issue[] = [];
  const prodByKey = new Map(prod.map((sample) => [sample.key, sample]));
  const devByKey = new Map(dev.map((sample) => [sample.key, sample]));

  for (const [key, prodSample] of prodByKey) {
    const devSample = devByKey.get(key);
    if (!devSample) {
      issues.push({
        severity: "WARNING",
        category: "Text style",
        source: "comparison",
        message: `Missing matching ${key} on migration page`,
        prodValue: prodSample.text
      });
      continue;
    }

    if (normalizeText(prodSample.text) !== normalizeText(devSample.text)) {
      issues.push({
        severity: "WARNING",
        category: "Text style",
        source: "comparison",
        message: `Text differs for ${key}`,
        prodValue: prodSample.text,
        devValue: devSample.text
      });
    }

    for (const field of STYLE_FIELDS) {
      if (prodSample.styles[field] !== devSample.styles[field]) {
        issues.push({
          severity: field === "fontFamily" || field === "fontSize" || field === "fontWeight" ? "FAIL" : "WARNING",
          category: "Text style",
          source: "comparison",
          message: `${labelStyleField(field)} differs for ${key}`,
          prodValue: prodSample.styles[field],
          devValue: devSample.styles[field]
        });
      }
    }
  }

  for (const [key, devSample] of devByKey) {
    if (!prodByKey.has(key)) {
      issues.push({
        severity: "WARNING",
        category: "Text style",
        source: "comparison",
        message: `Extra styled element ${key} on migration page`,
        devValue: devSample.text
      });
    }
  }

  const prodSignatures = prod.map(styleSignature);
  const devSignatures = dev.map(styleSignature);
  if (prodSignatures.join("||") === devSignatures.join("||") && !issues.length) {
    return {
      status: "PASS",
      summary: "Text styles match",
      issues: [],
      details: { prod, dev }
    };
  }

  const result = statusFromIssues(issues, "Text styles match");
  return { ...result, details: { prod, dev } };
}
