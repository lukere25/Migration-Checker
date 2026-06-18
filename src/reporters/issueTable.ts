import { getJiraSettings } from "../baseUrls";
import { buildJiraCreateIssueUrl, isJiraConfigured, JiraIssuePayload } from "../jira";
import { Issue } from "../utils/status";
import { SummaryIssueRow } from "./reportSummaries";
import { escapeReportHtml } from "./pageReportLayout";

export interface IssueTableContext {
  pageName?: string;
  prodUrl?: string;
  devUrl?: string;
  reportUrl?: string;
}

function toJiraPayload(issue: Issue, context: IssueTableContext): JiraIssuePayload {
  return {
    severity: issue.severity,
    category: issue.category,
    message: issue.message,
    prodValue: issue.prodValue || "",
    devValue: issue.devValue || "",
    url: issue.url || "",
    pageName: context.pageName || "",
    prodUrl: context.prodUrl || "",
    devUrl: context.devUrl || "",
    reportUrl: context.reportUrl || ""
  };
}

export function renderJiraLinkForSummaryRow(row: SummaryIssueRow): string {
  const issue: Issue = {
    severity: row.severity,
    category: row.category || row.field || "Issue",
    source: "comparison",
    message: row.message,
    prodValue: row.prodValue,
    devValue: row.devValue,
    url: row.url
  };

  return renderIssueJiraLink(issue, {
    pageName: row.pageName,
    prodUrl: row.prodUrl,
    devUrl: row.devUrl
  });
}

export function renderIssueJiraLink(issue: Issue, context: IssueTableContext = {}): string {
  const settings = getJiraSettings();

  if (!isJiraConfigured(settings)) {
    return `<a class="jira-create-link is-unconfigured no-print" href="/settings.html" title="Configure Jira domain and project ID in Settings">Configure Jira</a>`;
  }

  try {
    const href = escapeReportHtml(buildJiraCreateIssueUrl(settings, toJiraPayload(issue, context)));
    return `<a class="jira-create-link no-print" href="${href}" target="_blank" rel="noopener noreferrer" title="Open prefilled Jira create-issue form">Create Jira issue</a>`;
  } catch {
    return `<a class="jira-create-link is-unconfigured no-print" href="/settings.html">Configure Jira</a>`;
  }
}

export function renderIssueTableRows(
  issues: Issue[],
  context: IssueTableContext = {},
  emptyColspan = 6
): string {
  if (!issues.length) {
    return `<tr><td colspan="${emptyColspan}">No issues found.</td></tr>`;
  }

  return issues
    .map(
      (issue) => `<tr>
        <td><span class="pill ${issue.severity.toLowerCase()}">${escapeReportHtml(issue.severity)}</span></td>
        <td>${escapeReportHtml(issue.category)}</td>
        <td>${escapeReportHtml(issue.message)}${issue.url ? `<br><small>${escapeReportHtml(issue.url)}</small>` : ""}</td>
        <td>${escapeReportHtml(issue.prodValue || "")}</td>
        <td>${escapeReportHtml(issue.devValue || "")}</td>
        <td class="jira-action-cell">${renderIssueJiraLink(issue, context)}</td>
      </tr>`
    )
    .join("");
}

export const issueTableCss = `
  .jira-action-cell {
    white-space: normal;
    width: 10%;
    vertical-align: top;
  }

  .jira-create-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--accent);
    background: var(--accent-soft);
    color: var(--accent);
    border-radius: 8px;
    padding: 5px 6px;
    font-size: 10px;
    font-weight: 700;
    line-height: 1.25;
    text-align: center;
    text-decoration: none;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }

  .jira-create-link:hover {
    background: var(--accent);
    color: #fff;
  }

  .jira-create-link.is-unconfigured {
    border-color: var(--border);
    background: var(--bg-elevated);
    color: var(--muted);
  }

  .jira-create-link.is-unconfigured:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-soft);
  }

  .report-issues-panel {
    margin: 28px 0 0;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--panel);
    padding: 20px 20px 16px;
    box-shadow: var(--shadow);
  }

  .report-issues-panel h2 {
    margin: 0 0 6px;
    font-size: 1.05rem;
  }

  .issues-table-wrap {
    margin-top: 12px;
    max-width: 100%;
  }

  .issues-table {
    width: 100%;
    table-layout: fixed;
    font-size: 12px;
    border-collapse: collapse;
  }

  .issues-table th,
  .issues-table td {
    word-wrap: break-word;
    overflow-wrap: anywhere;
    vertical-align: top;
    padding: 8px 6px;
  }

  .issues-table th:nth-child(1),
  .issues-table td:nth-child(1) {
    width: 8%;
  }

  .issues-table th:nth-child(2),
  .issues-table td:nth-child(2) {
    width: 11%;
  }

  .issues-table th:nth-child(3),
  .issues-table td:nth-child(3) {
    width: 28%;
  }

  .issues-table th:nth-child(4),
  .issues-table td:nth-child(4),
  .issues-table th:nth-child(5),
  .issues-table td:nth-child(5) {
    width: 20%;
  }

  .issues-table th:last-child,
  .issues-table td:last-child {
    width: 10%;
  }

  .issues-table.is-compact th:nth-child(1),
  .issues-table.is-compact td:nth-child(1) {
    width: 9%;
  }

  .issues-table.is-compact th:nth-child(2),
  .issues-table.is-compact td:nth-child(2) {
    width: 31%;
  }

  .issues-table.is-compact th:nth-child(3),
  .issues-table.is-compact td:nth-child(3),
  .issues-table.is-compact th:nth-child(4),
  .issues-table.is-compact td:nth-child(4) {
    width: 22%;
  }

  .issues-table.is-compact th:last-child,
  .issues-table.is-compact td:last-child {
    width: 10%;
  }
`;
