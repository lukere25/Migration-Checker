import path from "path";
import { config } from "../config";
import { writeJson } from "../utils/fileUtils";
import { PageReport, SummaryReport } from "./reportTypes";

export async function writePageJson(report: PageReport): Promise<void> {
  await writeJson(report.reportPaths.json, report);
}

export async function writeSummaryJson(summary: SummaryReport): Promise<void> {
  await writeJson(path.join(config.reportsDir, "summary.json"), summary);
}
