import path from "path";
import { config } from "../config";
import { writeText } from "../utils/fileUtils";
import { PageReport, SummaryReport } from "./reportTypes";

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function writeSummaryCsv(summary: SummaryReport): Promise<void> {
  const headers = [
    "Page name",
    "Prod URL",
    "Dev URL",
    "Browser/device",
    "Overall status",
    "Metadata status",
    "Broken links status",
    "Heading status",
    "Content status",
    "Image status",
    "Link status",
    "Navigation status",
    "Footer status",
    "Language status",
    "Console status",
    "Network status",
    "Visual status",
    "Fail count",
    "Warning count",
    "Report link"
  ];

  const rows = summary.results.map((report: PageReport) => [
    report.pageName,
    report.prodUrl,
    report.devUrl,
    report.browserName,
    report.overallStatus,
    report.categories.metadata?.status,
    report.categories.brokenLinks?.status,
    report.categories.headings?.status,
    report.categories.content?.status,
    report.categories.images?.status,
    report.categories.links?.status,
    report.categories.navigation?.status,
    report.categories.footer?.status,
    report.categories.language?.status,
    report.categories.console?.status,
    report.categories.network?.status,
    report.categories.visual?.status,
    report.blockingIssues.length,
    report.warnings.length,
    report.reportPaths.html
  ]);

  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  await writeText(path.join(config.reportsDir, "summary.csv"), csv);
}
