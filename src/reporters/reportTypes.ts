import { PageMapping } from "../urlMapper";
import { CategoryResult, Issue, Status } from "../utils/status";
import { BrokenLinksSummaryBox, MetadataSummaryBox } from "./reportSummaries";

export interface PageReport {
  pageName: string;
  prodUrl: string;
  devUrl: string;
  path: string;
  browserName: string;
  overallStatus: Status;
  testedAt: string;
  categories: Record<string, CategoryResult>;
  issues: Issue[];
  blockingIssues: Issue[];
  warnings: Issue[];
  screenshots: {
    prod: string;
    dev: string;
    diff: string;
  };
  reportPaths: {
    html: string;
    json: string;
    pdf?: string;
  };
  mapping: PageMapping;
  enabledModules?: string[];
}

export interface SummaryReport {
  generatedAt: string;
  totals: {
    totalPages: number;
    totalBrowserRuns: number;
    passed: number;
    failed: number;
    warning: number;
    skipped: number;
  };
  results: PageReport[];
  metadataSummary?: MetadataSummaryBox;
  brokenLinksSummary?: BrokenLinksSummaryBox;
}
