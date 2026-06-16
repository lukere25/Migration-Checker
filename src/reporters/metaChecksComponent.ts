import {
  getMetadataCheckItems,
  MetadataCheckItem,
  MetadataCheckStatus,
  REQUIRED_OG_FIELDS
} from "../comparators/metadataComparator";
import { PageReport } from "./reportTypes";
import { CategoryResult, Issue } from "../utils/status";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pillLabel(status: MetadataCheckStatus): string {
  return status === "WARNING" ? "WARN" : status;
}

function pillClass(status: MetadataCheckStatus): string {
  return status === "WARNING" ? "warning" : status.toLowerCase();
}

/** Rebuild item list from stored dev snapshot when older reports lack `details.items`. */
function backfillMetadataItems(category?: CategoryResult): MetadataCheckItem[] {
  const details = category?.details as
    | {
        dev?: {
          title?: string;
          description?: string;
          openGraph?: Record<string, string>;
          taxonomy?: Record<string, string>;
        };
      }
    | undefined;

  const dev = details?.dev;
  if (!dev) return [];

  const issueByField = new Map<string, Issue>();
  for (const issue of category?.issues ?? []) {
    const field = issue.message
      .replace(/ is missing or empty$/, "")
      .replace(/ is missing$/, "")
      .trim();
    issueByField.set(field, issue);
  }

  const specs: Array<{ field: string; value: string }> = [
    { field: "Meta title", value: dev.title || "" },
    { field: "Meta description", value: dev.description || "" },
    ...REQUIRED_OG_FIELDS.map(({ label, key }) => ({
      field: label,
      value: dev.openGraph?.[key] || ""
    }))
  ];

  const taxonomySummary = dev.taxonomy
    ? Object.entries(dev.taxonomy)
        .map(([key, value]) => `${key}: ${value}`)
        .join("; ")
    : "";

  const items = specs.map(({ field, value }) => {
    const issue = issueByField.get(field);
    if (issue) {
      return {
        field,
        status: issue.severity === "WARNING" ? ("WARNING" as const) : ("FAIL" as const),
        message: issue.message,
        value: issue.devValue
      };
    }
    return {
      field,
      status: "PASS" as const,
      value: value || undefined,
      message: "Present on migration site"
    };
  });

  const taxonomyIssue = issueByField.get("Taxonomy metadata");
  if (taxonomyIssue || !taxonomySummary) {
    items.push({
      field: "Taxonomy metadata",
      status: taxonomyIssue
        ? taxonomyIssue.severity === "WARNING"
          ? "WARNING"
          : "FAIL"
        : "WARNING",
      message: taxonomyIssue?.message || "Taxonomy metadata is missing",
      value: taxonomyIssue?.devValue
    });
  } else {
    items.push({
      field: "Taxonomy metadata",
      status: "PASS",
      value: taxonomySummary,
      message: "Present on migration site"
    });
  }

  return items;
}

export function resolveMetadataCheckItems(report: PageReport): MetadataCheckItem[] {
  const fromDetails = getMetadataCheckItems(report.categories.metadata);
  if (fromDetails.length) return fromDetails;
  return backfillMetadataItems(report.categories.metadata);
}

export const metaChecksComponentCss = `
  .meta-checks-panel {
    background: #1e293b;
    color: #e2e8f0;
    border-radius: 12px;
    padding: 20px 22px;
    margin: 24px 0;
  }
  .meta-checks-panel h2 {
    margin: 0 0 6px;
    font-size: 1.2rem;
    color: #f8fafc;
  }
  .meta-checks-panel .panel-subtitle {
    margin: 0 0 16px;
    color: #94a3b8;
    font-size: 14px;
  }
  .meta-checks-panel .panel-subtitle a { color: #7dd3fc; }
  .meta-check-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .meta-check-item {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: #334155;
    border: 1px solid #475569;
    border-radius: 8px;
    font-size: 14px;
  }
  .meta-check-item .field {
    font-weight: 600;
    color: #f1f5f9;
  }
  .meta-check-item .meta-value {
    display: block;
    margin-top: 4px;
    font-size: 12px;
    font-weight: 400;
    color: #94a3b8;
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta-check-item.has-value {
    flex-direction: column;
    align-items: flex-start;
  }
  .meta-check-item.has-value .pill-row {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    justify-content: space-between;
  }
`;

export function renderMetaChecksByItemPanel(report: PageReport): string {
  const items = resolveMetadataCheckItems(report);
  const metadataStatus = report.categories.metadata?.status || "PASS";

  const chips = items.length
    ? items
        .map((item) => {
          const hasValue = Boolean(item.value && item.status === "PASS");
          return `<div class="meta-check-item${hasValue ? " has-value" : ""}">
        ${
          hasValue
            ? `<div class="pill-row"><span class="field">${escapeHtml(item.field)}</span><span class="pill ${pillClass(item.status)}">${pillLabel(item.status)}</span></div>
           <span class="meta-value" title="${escapeHtml(item.value)}">${escapeHtml(item.value)}</span>`
            : `<span class="field">${escapeHtml(item.field)}</span><span class="pill ${pillClass(item.status)}">${pillLabel(item.status)}</span>`
        }
      </div>`;
        })
        .join("")
    : `<p class="panel-subtitle">No metadata checks recorded. Re-run the comparison to refresh this page.</p>`;

  return `<section class="meta-checks-panel" id="meta-checks-by-item">
    <h2>Meta checks by item</h2>
    <p class="panel-subtitle">
      Migration URL only —
      <span class="pill ${metadataStatus.toLowerCase()}">${metadataStatus}</span>
      · <a href="${escapeHtml(report.devUrl)}" target="_blank" rel="noopener">${escapeHtml(report.devUrl)}</a>
    </p>
    <div class="meta-check-grid">${chips}</div>
  </section>`;
}
