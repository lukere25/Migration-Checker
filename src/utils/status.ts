export type Status = "PASS" | "FAIL" | "WARNING" | "SKIPPED";
export type Severity = "FAIL" | "WARNING" | "INFO";
export type IssueSource = "prod" | "dev" | "comparison";

export interface Issue {
  severity: Severity;
  category: string;
  source: IssueSource;
  message: string;
  prodValue?: string;
  devValue?: string;
  selector?: string;
  url?: string;
}

export interface CategoryResult<T = unknown> {
  status: Status;
  summary: string;
  issues: Issue[];
  details?: T;
}

export function statusFromIssues(issues: Issue[], passSummary: string, warningSummary?: string): CategoryResult {
  if (issues.some((issue) => issue.severity === "FAIL")) {
    return { status: "FAIL", summary: `${issues.filter((issue) => issue.severity === "FAIL").length} failing issue(s)`, issues };
  }

  if (issues.some((issue) => issue.severity === "WARNING")) {
    return { status: "WARNING", summary: warningSummary || `${issues.filter((issue) => issue.severity === "WARNING").length} warning(s)`, issues };
  }

  return { status: "PASS", summary: passSummary, issues };
}

export function combineOverall(categoryStatuses: Status[]): Status {
  if (categoryStatuses.includes("FAIL")) return "FAIL";
  if (categoryStatuses.includes("WARNING")) return "WARNING";
  if (categoryStatuses.every((status) => status === "SKIPPED")) return "SKIPPED";
  return "PASS";
}
