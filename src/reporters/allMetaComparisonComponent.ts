import { AllMetaTagRow, getAllMetaTagRows } from "../comparators/allMetaComparator";
import { MetadataCompareStatus } from "../comparators/metadataComparator";
import { PageReport } from "./reportTypes";
import { escapeReportHtml } from "./pageReportLayout";

function compareStatusLabel(status: MetadataCompareStatus): string {
  switch (status) {
    case "MATCH":
      return "Match";
    case "DIFFER":
      return "Differ";
    case "MISSING_LIVE":
      return "Live only";
    case "MISSING_MIGRATION":
      return "Migration only";
    case "BOTH_EMPTY":
      return "Both empty";
    default:
      return status;
  }
}

function compareStatusClass(status: MetadataCompareStatus): string {
  switch (status) {
    case "MATCH":
      return "pass";
    case "DIFFER":
      return "warning";
    case "MISSING_MIGRATION":
      return "fail";
    case "MISSING_LIVE":
      return "warning";
    case "BOTH_EMPTY":
      return "skipped";
    default:
      return "info";
  }
}

export function resolveAllMetaTagRows(report: PageReport): AllMetaTagRow[] {
  return getAllMetaTagRows(report.categories.metadata?.details);
}

export const allMetaComparisonComponentCss = `
  .all-meta-scroll { max-height: 520px; overflow: auto; border: 1px solid var(--border); border-radius: 10px; }
  .all-meta-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 760px;
    font-size: 13px;
  }
  .all-meta-table th,
  .all-meta-table td {
    border: 1px solid var(--border);
    padding: 8px 10px;
    vertical-align: top;
    text-align: left;
  }
  .all-meta-table th {
    background: var(--table-head);
    position: sticky;
    top: 0;
    z-index: 1;
  }
  .all-meta-table .tag-col {
    width: 180px;
    font-family: ui-monospace, monospace;
    font-size: 12px;
  }
  .all-meta-table tr.row-differ { background: var(--row-warn); }
  .all-meta-table tr.row-migration-only { background: var(--row-fail); }
`;

function renderRow(row: AllMetaTagRow): string {
  const rowClass =
    row.status === "DIFFER" ? "row-differ" : row.status === "MISSING_MIGRATION" ? "row-migration-only" : "";

  return `<tr class="${rowClass}">
    <td class="tag-col">${escapeReportHtml(row.tag)}</td>
    <td class="meta-value-cell">${escapeReportHtml(row.liveValue || "(empty)")}</td>
    <td class="meta-value-cell">${escapeReportHtml(row.migrationValue || "(empty)")}</td>
    <td class="status-col"><span class="pill ${compareStatusClass(row.status)}">${compareStatusLabel(row.status)}</span></td>
  </tr>`;
}

export function renderAllMetaTagsComparisonBody(report: PageReport): string {
  const rows = resolveAllMetaTagRows(report);
  const metadataStatus = report.categories.metadata?.status || "PASS";

  const body = rows.length
    ? rows.map(renderRow).join("")
    : `<tr><td colspan="4">No meta tag data. Re-run the comparison to refresh.</td></tr>`;

  return `<p class="panel-subtitle">
      Side by side — <strong>Live</strong>
      <a href="${escapeReportHtml(report.prodUrl)}" target="_blank" rel="noopener">open</a>
      vs <strong>Migration</strong>
      <a href="${escapeReportHtml(report.devUrl)}" target="_blank" rel="noopener">open</a>
      · Overall <span class="pill ${metadataStatus.toLowerCase()}">${metadataStatus}</span>
    </p>
    <div class="all-meta-scroll">
      <table class="all-meta-table meta-compare-table">
        <thead>
          <tr>
            <th class="tag-col">Meta tag</th>
            <th class="live-col">Live</th>
            <th class="migration-col">Migration</th>
            <th class="status-col">Result</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}
