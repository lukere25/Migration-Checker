import {
  buildMetadataComparisonRows,
  buildMetadataSnapshot,
  getMetadataComparisonRows,
  MetadataComparisonRow,
  MetadataCompareStatus
} from "../comparators/metadataComparator";
import { PageReport } from "./reportTypes";
import { CategoryResult } from "../utils/status";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function compareStatusLabel(status: MetadataCompareStatus): string {
  switch (status) {
    case "MATCH":
      return "Match";
    case "DIFFER":
      return "Differ";
    case "MISSING_LIVE":
      return "Missing on live";
    case "MISSING_MIGRATION":
      return "Missing on migration";
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

function backfillComparisonRows(category?: CategoryResult): MetadataComparisonRow[] {
  const details = category?.details as
    | {
        prod?: ReturnType<typeof buildMetadataSnapshot>;
        dev?: ReturnType<typeof buildMetadataSnapshot>;
      }
    | undefined;

  if (details?.prod && details?.dev) {
    return buildMetadataComparisonRows(details.prod, details.dev);
  }

  const dev = details?.dev;
  if (!dev) return [];

  const empty = buildMetadataSnapshot({
    title: "",
    description: "",
    canonical: "",
    robots: "",
    keywords: "",
    openGraph: {},
    twitter: {},
    hreflang: [],
    allMeta: []
  });

  return buildMetadataComparisonRows(empty, dev);
}

export function resolveMetadataComparisonRows(report: PageReport): MetadataComparisonRow[] {
  const fromDetails = getMetadataComparisonRows(report.categories.metadata);
  if (fromDetails.length) return fromDetails;
  return backfillComparisonRows(report.categories.metadata);
}

export const metaComparisonComponentCss = `
  .meta-compare-panel {
    margin: 24px 0;
    border: 1px solid #d9e2ec;
    border-radius: 12px;
    overflow: hidden;
    background: #fff;
  }
  .meta-compare-panel h2 {
    margin: 0;
    padding: 16px 18px;
    font-size: 1.2rem;
    background: #f8fafc;
    border-bottom: 1px solid #d9e2ec;
  }
  .meta-compare-panel .panel-subtitle {
    margin: 0;
    padding: 0 18px 14px;
    background: #f8fafc;
    color: #62748e;
    font-size: 14px;
    border-bottom: 1px solid #d9e2ec;
  }
  .meta-compare-panel .panel-subtitle a { color: #0067c5; }
  .meta-compare-scroll { overflow-x: auto; }
  .meta-compare-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 720px;
  }
  .meta-compare-table th,
  .meta-compare-table td {
    border: 1px solid #d9e2ec;
    padding: 10px 12px;
    vertical-align: top;
    text-align: left;
  }
  .meta-compare-table th {
    background: #eef2f7;
    font-size: 13px;
  }
  .meta-compare-table .field-col { width: 160px; font-weight: 600; background: #f8fafc; }
  .meta-compare-table .live-col { width: 38%; }
  .meta-compare-table .migration-col { width: 38%; }
  .meta-compare-table .status-col { width: 120px; white-space: nowrap; }
  .meta-value-cell {
    font-size: 13px;
    line-height: 1.45;
    word-break: break-word;
    max-width: 420px;
  }
  .meta-value-cell.empty { color: #94a3b8; font-style: italic; }
  .meta-compare-table tr.row-differ { background: #fffbeb; }
  .meta-compare-table tr.row-missing-migration { background: #fef2f2; }
`;

function renderComparisonRow(row: MetadataComparisonRow): string {
  const rowClass =
    row.status === "DIFFER"
      ? "row-differ"
      : row.status === "MISSING_MIGRATION"
        ? "row-missing-migration"
        : "";

  const liveClass = !row.liveValue || row.liveValue === "(empty)" ? "meta-value-cell empty" : "meta-value-cell";
  const migrationClass =
    !row.migrationValue || row.migrationValue === "(empty)" ? "meta-value-cell empty" : "meta-value-cell";

  return `<tr class="${rowClass}">
    <td class="field-col">${escapeHtml(row.field)}</td>
    <td class="live-col ${liveClass}">${escapeHtml(row.liveValue || "(empty)")}</td>
    <td class="migration-col ${migrationClass}">${escapeHtml(row.migrationValue || "(empty)")}</td>
    <td class="status-col"><span class="pill ${compareStatusClass(row.status)}">${compareStatusLabel(row.status)}</span></td>
  </tr>`;
}

export function renderMetadataSideBySidePanel(report: PageReport): string {
  const rows = resolveMetadataComparisonRows(report);
  const metadataStatus = report.categories.metadata?.status || "PASS";

  const body = rows.length
    ? rows.map(renderComparisonRow).join("")
    : `<tr><td colspan="4">No metadata comparison data. Re-run the comparison to refresh.</td></tr>`;

  return `<section class="meta-compare-panel" id="metadata-comparison">
    <h2>Metadata comparison</h2>
    <p class="panel-subtitle">
      Side by side — <strong>Live</strong>
      <a href="${escapeHtml(report.prodUrl)}" target="_blank" rel="noopener">open</a>
      vs <strong>Migration</strong>
      <a href="${escapeHtml(report.devUrl)}" target="_blank" rel="noopener">open</a>
      · Overall <span class="pill ${metadataStatus.toLowerCase()}">${metadataStatus}</span>
    </p>
    <div class="meta-compare-scroll">
      <table class="meta-compare-table">
        <thead>
          <tr>
            <th class="field-col">Field</th>
            <th class="live-col">Live (www.netapp.com)</th>
            <th class="migration-col">Migration (Vercel)</th>
            <th class="status-col">Result</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  </section>`;
}
