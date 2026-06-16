import { PageSpeedMetrics } from "../extractors/pageSpeedExtractor";
import { CategoryResult, Issue, statusFromIssues } from "../utils/status";

function compareMetric(
  label: string,
  prodValue: number,
  devValue: number,
  warningDelta: number,
  failDelta: number,
  warningRatio: number,
  failRatio: number
): Issue[] {
  if (prodValue <= 0 && devValue <= 0) return [];

  const delta = devValue - prodValue;
  const ratio = prodValue > 0 ? devValue / prodValue : devValue > 0 ? Number.POSITIVE_INFINITY : 1;

  if (delta >= failDelta || ratio >= failRatio) {
    return [
      {
        severity: "FAIL",
        category: "Page speed",
        source: "comparison",
        message: `${label} is significantly slower on migration`,
        prodValue: `${prodValue}ms`,
        devValue: `${devValue}ms`
      }
    ];
  }

  if (delta >= warningDelta || ratio >= warningRatio) {
    return [
      {
        severity: "WARNING",
        category: "Page speed",
        source: "comparison",
        message: `${label} is slower on migration`,
        prodValue: `${prodValue}ms`,
        devValue: `${devValue}ms`
      }
    ];
  }

  return [];
}

export function comparePageSpeed(prod: PageSpeedMetrics, dev: PageSpeedMetrics): CategoryResult {
  const issues: Issue[] = [
    ...compareMetric("Time to first byte", prod.ttfbMs, dev.ttfbMs, 200, 600, 1.2, 1.5),
    ...compareMetric("DOM content loaded", prod.domContentLoadedMs, dev.domContentLoadedMs, 400, 1200, 1.25, 1.5),
    ...compareMetric("Load complete", prod.loadCompleteMs, dev.loadCompleteMs, 500, 1500, 1.25, 1.5),
    ...compareMetric("Wall clock load", prod.wallClockMs, dev.wallClockMs, 500, 1500, 1.25, 1.5)
  ];

  if (prod.transferSizeBytes > 0 && dev.transferSizeBytes > prod.transferSizeBytes * 1.35) {
    issues.push({
      severity: "WARNING",
      category: "Page speed",
      source: "comparison",
      message: "Migration page transfer size is larger than live",
      prodValue: `${prod.transferSizeBytes} bytes`,
      devValue: `${dev.transferSizeBytes} bytes`
    });
  }

  const result = statusFromIssues(issues, "Page speed matches live site");
  return {
    ...result,
    details: { prod, dev }
  };
}
