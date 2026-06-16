import { PageReport } from "./reportTypes";
import { resolveMetadataCheckItems } from "./metaChecksComponent";
import { Issue, Status } from "../utils/status";

export interface SummaryIssueRow {
  pageName: string;
  path: string;
  browserName: string;
  severity: Issue["severity"];
  message: string;
  url?: string;
  prodValue?: string;
  devValue?: string;
  field?: string;
}

export interface MetadataSummaryBox {
  scope: string;
  checkedFields: string[];
  excludedFields: string[];
  totals: { pass: number; warning: number; fail: number };
  issueCount: number;
  rows: SummaryIssueRow[];
}

export interface BrokenLinksSummaryBox {
  totals: { broken: number; redirect: number; other: number };
  issueCount: number;
  rows: SummaryIssueRow[];
}

function countStatus(results: PageReport[], category: string): { pass: number; warning: number; fail: number } {
  const counts = { pass: 0, warning: 0, fail: 0 };
  for (const report of results) {
    const status = report.categories[category]?.status as Status | undefined;
    if (status === "PASS") counts.pass += 1;
    else if (status === "WARNING") counts.warning += 1;
    else if (status === "FAIL") counts.fail += 1;
  }
  return counts;
}

function issueToRow(report: PageReport, issue: Issue, field?: string): SummaryIssueRow {
  return {
    pageName: report.pageName,
    path: report.path,
    browserName: report.browserName,
    severity: issue.severity,
    message: issue.message,
    url: issue.url,
    prodValue: issue.prodValue,
    devValue: issue.devValue,
    field
  };
}

export function buildMetadataSummary(results: PageReport[]): MetadataSummaryBox {
  const rows: SummaryIssueRow[] = [];

  for (const report of results) {
    const items = resolveMetadataCheckItems(report);
    if (items.length) {
      for (const item of items) {
        if (item.status === "PASS") continue;
        rows.push({
          pageName: report.pageName,
          path: report.path,
          browserName: report.browserName,
          severity: item.status === "FAIL" ? "FAIL" : "WARNING",
          message: item.message,
          field: item.field,
          devValue: item.value
        });
      }
      continue;
    }

    for (const issue of report.issues.filter((issue) => issue.category === "Metadata")) {
      rows.push(issueToRow(report, issue, issue.message.replace(/ is missing or empty$/, "")));
    }
  }

  return {
    scope: "Live vs migration metadata comparison",
    checkedFields: [
      "Meta title / name",
      "Meta description",
      "Open Graph tags (og:locale excluded)",
      "Taxonomy-related metadata (article:tag, article:section, taxonomy*)"
    ],
    excludedFields: ["Twitter tags", "og:locale", "robots", "keywords", "canonical", "hreflang"],
    totals: countStatus(results, "metadata"),
    issueCount: rows.length,
    rows
  };
}

export function buildBrokenLinksSummary(results: PageReport[]): BrokenLinksSummaryBox {
  const rows: SummaryIssueRow[] = [];
  const totals = { broken: 0, redirect: 0, other: 0 };

  for (const report of results) {
    const brokenIssues = report.issues.filter((issue) => issue.category === "Broken links");
    for (const issue of brokenIssues) {
      rows.push(issueToRow(report, issue));
      if (/redirect/i.test(issue.message)) totals.redirect += 1;
      else if (/broken link/i.test(issue.message)) totals.broken += 1;
      else totals.other += 1;
    }
  }

  return {
    totals,
    issueCount: rows.length,
    rows
  };
}
