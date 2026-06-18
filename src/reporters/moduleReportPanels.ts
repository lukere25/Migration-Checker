import { Heading } from "../extractors/headingExtractor";
import { CategoryResult, Issue } from "../utils/status";
import { PageReport } from "./reportTypes";
import { headingTreeCss, renderHeadingTree } from "./headingTreeView";
import { escapeReportHtml, statusClass } from "./pageReportLayout";
import { IssueTableContext, renderIssueJiraLink, renderIssueTableRows } from "./issueTable";

export { headingTreeCss };

function issueContext(report: PageReport): IssueTableContext {
  return {
    pageName: report.pageName,
    prodUrl: report.prodUrl,
    devUrl: report.devUrl
  };
}

function renderIssuesTable(
  issues: Issue[],
  context: IssueTableContext,
  emptyMessage = "No issues found."
): string {
  if (!issues.length) {
    return `<p class="panel-subtitle">${escapeReportHtml(emptyMessage)}</p>`;
  }

  const rows = issues
    .map(
      (issue) => `<tr>
        <td><span class="pill ${statusClass(issue.severity)}">${escapeReportHtml(issue.severity)}</span></td>
        <td>${escapeReportHtml(issue.message)}${issue.url ? `<br><small>${escapeReportHtml(issue.url)}</small>` : ""}</td>
        <td>${escapeReportHtml(issue.prodValue || "")}</td>
        <td>${escapeReportHtml(issue.devValue || "")}</td>
        <td class="jira-action-cell">${renderIssueJiraLink(issue, context)}</td>
      </tr>`
    )
    .join("");

  return `<div class="issues-table-wrap"><table class="issues-table is-compact">
    <thead><tr><th>Severity</th><th>Message</th><th>Live</th><th>Migration</th><th>Jira</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function renderCategoryIntro(result: CategoryResult | undefined, fallback: string): string {
  const summary = result?.summary || fallback;
  return `<p class="panel-subtitle">${escapeReportHtml(summary)}</p>`;
}

function metricRow(label: string, prodValue: string, devValue: string): string {
  return `<tr><td>${escapeReportHtml(label)}</td><td>${escapeReportHtml(prodValue)}</td><td>${escapeReportHtml(devValue)}</td></tr>`;
}

function issueIndexSet(values: number[] | undefined): Set<number> {
  return new Set(values ?? []);
}

export function renderHTagHierarchyBody(report: PageReport): string {
  const details = report.categories.hTagHierarchy?.details as
    | {
        prod?: Heading[];
        dev?: Heading[];
        prodSequence?: string[];
        devSequence?: string[];
        prodIssueIndexes?: number[];
        devIssueIndexes?: number[];
      }
    | undefined;

  const prodHeadings = details?.prod ?? [];
  const devHeadings = details?.dev ?? [];
  const prodCount = prodHeadings.length || details?.prodSequence?.length || 0;
  const devCount = devHeadings.length || details?.devSequence?.length || 0;

  if (!prodHeadings.length && !devHeadings.length) {
    const prodSequence = details?.prodSequence?.join(" → ") || "—";
    const devSequence = details?.devSequence?.join(" → ") || "—";
    return `<p class="panel-subtitle">Compares visible heading order and checks for skipped heading levels.</p>
      <table>
        <thead><tr><th>Site</th><th>Heading sequence</th></tr></thead>
        <tbody>
          <tr><td>Live</td><td>${escapeReportHtml(prodSequence)}</td></tr>
          <tr><td>Migration</td><td>${escapeReportHtml(devSequence)}</td></tr>
        </tbody>
      </table>`;
  }

  return `<p class="panel-subtitle">Visible heading hierarchy on live and migration pages. Items with issues are highlighted.</p>
    <div class="heading-tree-columns">
      <section class="heading-tree-panel">
        <h3 class="heading-tree-panel-title">Live (${prodCount} headings)</h3>
        <div class="heading-tree-scroll">
          ${renderHeadingTree(prodHeadings, issueIndexSet(details?.prodIssueIndexes))}
        </div>
      </section>
      <section class="heading-tree-panel">
        <h3 class="heading-tree-panel-title">Migration (${devCount} headings)</h3>
        <div class="heading-tree-scroll">
          ${renderHeadingTree(devHeadings, issueIndexSet(details?.devIssueIndexes))}
        </div>
      </section>
    </div>`;
}

export function renderTextStyleBody(report: PageReport): string {
  const result = report.categories.textStyle;
  const details = result?.details as
    | {
        comparisonRows?: Array<{
          key: string;
          tag: string;
          liveText: string;
          migrationText: string;
          fields: Array<{
            field: string;
            label: string;
            liveValue: string;
            migrationValue: string;
            status: string;
          }>;
        }>;
      }
    | undefined;

  const rows = details?.comparisonRows ?? [];
  if (!rows.length) {
    return `<p class="panel-subtitle">No text style samples were captured for this page.</p>`;
  }

  const styleValueCell = (field: string, value: string): string => {
    if (!value) return `<span class="text-style-empty">—</span>`;
    if (field !== "color") return escapeReportHtml(value);

    return `<span class="text-style-color-value">
      <span class="text-style-color-swatch" style="background:${escapeReportHtml(value)}"></span>
      ${escapeReportHtml(value)}
    </span>`;
  };

  const blocks = rows
    .map((row) => {
      const fieldRows = row.fields
        .map((field) => {
          const statusClass =
            field.status === "MATCH"
              ? "is-match"
              : field.status === "MISSING_MIGRATION"
                ? "is-fail"
                : "is-differ";

          return `<tr class="${statusClass}">
            <td>${escapeReportHtml(field.label)}</td>
            <td>${styleValueCell(field.field, field.liveValue)}</td>
            <td>${styleValueCell(field.field, field.migrationValue)}</td>
            <td><span class="pill ${textStyleStatusClass(field.status)}">${escapeReportHtml(field.status)}</span></td>
          </tr>`;
        })
        .join("");

      return `<section class="text-style-compare-block">
        <h3 class="panel-section-title">${escapeReportHtml(row.key)} <span class="text-style-tag">${escapeReportHtml(row.tag)}</span></h3>
        <div class="text-style-preview-grid">
          <div class="text-style-preview-col">
            <span class="language-tags-label">Live sample</span>
            <p class="text-style-preview">${escapeReportHtml(row.liveText || "(missing on live)")}</p>
          </div>
          <div class="text-style-preview-col">
            <span class="language-tags-label">Migration sample</span>
            <p class="text-style-preview">${escapeReportHtml(row.migrationText || "(missing on migration)")}</p>
          </div>
        </div>
        <div class="issues-table-wrap">
          <table class="issues-table is-compact text-style-table">
            <thead><tr><th>Style</th><th>Live</th><th>Migration</th><th>Status</th></tr></thead>
            <tbody>${fieldRows}</tbody>
          </table>
        </div>
      </section>`;
    })
    .join("");

  return `${renderCategoryIntro(
    result,
    "Side-by-side computed styles for visible headings and sample paragraphs on live vs migration."
  )}
    ${blocks}
    ${renderIssuesTable(result?.issues ?? [], issueContext(report), "No text style issues recorded.")}`;
}

function textStyleStatusClass(status: string): string {
  if (status === "MATCH") return "pass";
  if (status === "MISSING_MIGRATION") return "fail";
  return "warning";
}

export function renderPageSpeedBody(report: PageReport): string {
  const details = report.categories.pageSpeed?.details as
    | {
        prod?: {
          wallClockMs: number;
          domContentLoadedMs: number;
          loadCompleteMs: number;
          ttfbMs: number;
          transferSizeBytes: number;
        };
        dev?: {
          wallClockMs: number;
          domContentLoadedMs: number;
          loadCompleteMs: number;
          ttfbMs: number;
          transferSizeBytes: number;
        };
      }
    | undefined;

  const prod = details?.prod;
  const dev = details?.dev;
  if (!prod || !dev) {
    return `<p class="panel-subtitle">Page speed metrics were not captured for this run.</p>`;
  }

  return `<p class="panel-subtitle">Migration load timing compared against the live page.</p>
    <table>
      <thead><tr><th>Metric</th><th>Live</th><th>Migration</th></tr></thead>
      <tbody>
        ${metricRow("Time to first byte", `${prod.ttfbMs} ms`, `${dev.ttfbMs} ms`)}
        ${metricRow("DOM content loaded", `${prod.domContentLoadedMs} ms`, `${dev.domContentLoadedMs} ms`)}
        ${metricRow("Load complete", `${prod.loadCompleteMs} ms`, `${dev.loadCompleteMs} ms`)}
        ${metricRow("Wall clock load", `${prod.wallClockMs} ms`, `${dev.wallClockMs} ms`)}
        ${metricRow("Transfer size", `${prod.transferSizeBytes} bytes`, `${dev.transferSizeBytes} bytes`)}
      </tbody>
    </table>`;
}

export function renderHeadingsBody(report: PageReport): string {
  const result = report.categories.headings;
  const details = result?.details as { prod?: Heading[]; dev?: Heading[] } | undefined;
  const prod = details?.prod ?? [];
  const dev = details?.dev ?? [];

  const rows = Array.from({ length: Math.max(prod.length, dev.length) }, (_, index) => {
    const prodHeading = prod[index];
    const devHeading = dev[index];
    return `<tr>
      <td>${prodHeading ? `H${prodHeading.level} ${escapeReportHtml(prodHeading.text)}` : "—"}</td>
      <td>${devHeading ? `H${devHeading.level} ${escapeReportHtml(devHeading.text)}` : "—"}</td>
    </tr>`;
  }).join("");

  return `${renderCategoryIntro(result, "Compares visible heading text and levels between live and migration pages.")}
    <table>
      <thead><tr><th>Live heading</th><th>Migration heading</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="2">No headings captured.</td></tr>`}</tbody>
    </table>
    ${renderIssuesTable(result?.issues ?? [], issueContext(report), "No heading issues recorded.")}`;
}

function schemaCompareStatusClass(status: string): string {
  if (status === "MATCH") return "pass";
  if (status === "DIFFER") return "warning";
  if (status === "MISSING_MIGRATION") return "fail";
  if (status === "MISSING_LIVE") return "warning";
  return "";
}

export function renderSchemaBody(report: PageReport): string {
  const result = report.categories.schema;
  const details = result?.details as
    | {
        prod?: { blocks?: unknown[]; items?: unknown[] };
        dev?: { blocks?: unknown[]; items?: unknown[] };
        comparisonRows?: Array<{
          schemaLabel: string;
          field: string;
          liveValue: string;
          migrationValue: string;
          status: string;
        }>;
        checkItems?: Array<{ field: string; status: string; value?: string; message: string }>;
      }
    | undefined;

  const prodBlocks = details?.prod?.blocks?.length ?? 0;
  const devBlocks = details?.dev?.blocks?.length ?? 0;
  const prodItems = details?.prod?.items?.length ?? 0;
  const devItems = details?.dev?.items?.length ?? 0;

  const checkRows = (details?.checkItems ?? [])
    .map(
      (item) => `<tr>
        <td>${escapeReportHtml(item.field)}</td>
        <td><span class="pill ${statusClass(item.status)}">${escapeReportHtml(item.status)}</span></td>
        <td>${escapeReportHtml(item.value || "—")}</td>
        <td>${escapeReportHtml(item.message)}</td>
      </tr>`
    )
    .join("");

  const comparisonRows = (details?.comparisonRows ?? [])
    .filter((row) => row.status !== "BOTH_EMPTY")
    .map(
      (row) => `<tr>
        <td>${escapeReportHtml(row.schemaLabel)}</td>
        <td>${escapeReportHtml(row.field)}</td>
        <td>${escapeReportHtml(row.liveValue || "—")}</td>
        <td>${escapeReportHtml(row.migrationValue || "—")}</td>
        <td><span class="pill ${schemaCompareStatusClass(row.status)}">${escapeReportHtml(row.status)}</span></td>
      </tr>`
    )
    .join("");

  return `${renderCategoryIntro(result, "Compares JSON-LD structured data from script tags between live and migration pages.")}
    <table>
      <thead><tr><th>Metric</th><th>Live</th><th>Migration</th></tr></thead>
      <tbody>
        <tr><td>JSON-LD blocks</td><td>${prodBlocks}</td><td>${devBlocks}</td></tr>
        <tr><td>Schema items</td><td>${prodItems}</td><td>${devItems}</td></tr>
      </tbody>
    </table>
    ${
      checkRows
        ? `<h3 class="panel-section-title">Migration checks</h3>
    <div class="issues-table-wrap">
      <table class="issues-table is-compact">
        <thead><tr><th>Check</th><th>Status</th><th>Value</th><th>Notes</th></tr></thead>
        <tbody>${checkRows}</tbody>
      </table>
    </div>`
        : ""
    }
    ${
      comparisonRows
        ? `<h3 class="panel-section-title">Live vs migration fields</h3>
    <div class="issues-table-wrap">
      <table class="issues-table">
        <thead><tr><th>Schema</th><th>Field</th><th>Live</th><th>Migration</th><th>Status</th></tr></thead>
        <tbody>${comparisonRows}</tbody>
      </table>
    </div>`
        : `<p class="panel-subtitle">No JSON-LD structured data found on either site.</p>`
    }
    ${renderIssuesTable(result?.issues ?? [], issueContext(report), "No schema issues recorded.")}`;
}

function embedCompareStatusClass(status: string): string {
  if (status === "MATCH") return "pass";
  if (status === "DIFFER") return "warning";
  if (status === "MISSING_MIGRATION") return "fail";
  if (status === "MISSING_LIVE") return "warning";
  return "";
}

export function renderEmbedsBody(report: PageReport): string {
  const result = report.categories.embeds;
  const details = result?.details as
    | {
        prod?: { items?: Array<{ kind: string; src: string; label: string; visible: boolean }> };
        dev?: { items?: Array<{ kind: string; src: string; label: string; visible: boolean }> };
        comparisonRows?: Array<{
          embedLabel: string;
          field: string;
          liveValue: string;
          migrationValue: string;
          status: string;
        }>;
        checkItems?: Array<{ field: string; status: string; value?: string; message: string }>;
      }
    | undefined;

  const prodCount = details?.prod?.items?.length ?? 0;
  const devCount = details?.dev?.items?.length ?? 0;

  const inventoryRows = Array.from({ length: Math.max(prodCount, devCount) }, (_, index) => {
    const prodItem = details?.prod?.items?.[index];
    const devItem = details?.dev?.items?.[index];
    const prodSrc = prodItem?.src || "—";
    const devSrc = devItem?.src || "—";
    return `<tr>
      <td>${index + 1}</td>
      <td>${escapeReportHtml(prodItem?.kind || devItem?.kind || "—")}</td>
      <td>${escapeReportHtml(prodItem?.label || "—")}</td>
      <td>${escapeReportHtml(prodSrc)}</td>
      <td>${escapeReportHtml(devItem?.label || "—")}</td>
      <td>${escapeReportHtml(devSrc)}</td>
    </tr>`;
  }).join("");

  const checkRows = (details?.checkItems ?? [])
    .map(
      (item) => `<tr>
        <td>${escapeReportHtml(item.field)}</td>
        <td><span class="pill ${statusClass(item.status)}">${escapeReportHtml(item.status)}</span></td>
        <td>${escapeReportHtml(item.value || "—")}</td>
        <td>${escapeReportHtml(item.message)}</td>
      </tr>`
    )
    .join("");

  const comparisonRows = (details?.comparisonRows ?? [])
    .filter((row) => row.status !== "BOTH_EMPTY")
    .map(
      (row) => `<tr>
        <td>${escapeReportHtml(row.embedLabel)}</td>
        <td>${escapeReportHtml(row.field)}</td>
        <td>${escapeReportHtml(row.liveValue || "—")}</td>
        <td>${escapeReportHtml(row.migrationValue || "—")}</td>
        <td><span class="pill ${embedCompareStatusClass(row.status)}">${escapeReportHtml(row.status)}</span></td>
      </tr>`
    )
    .join("");

  return `${renderCategoryIntro(result, "Compares iframes, embed tags, media embeds, and embedded widget markup between live and migration pages.")}
    <table>
      <thead><tr><th>Metric</th><th>Live</th><th>Migration</th></tr></thead>
      <tbody>
        <tr><td>Embedded items</td><td>${prodCount}</td><td>${devCount}</td></tr>
      </tbody>
    </table>
    ${
      inventoryRows
        ? `<h3 class="panel-section-title">Embed inventory</h3>
    <div class="issues-table-wrap">
      <table class="issues-table">
        <thead><tr><th>#</th><th>Type</th><th>Live label</th><th>Live src</th><th>Migration label</th><th>Migration src</th></tr></thead>
        <tbody>${inventoryRows}</tbody>
      </table>
    </div>`
        : `<p class="panel-subtitle">No embedded content found on either site.</p>`
    }
    ${
      checkRows
        ? `<h3 class="panel-section-title">Migration checks</h3>
    <div class="issues-table-wrap">
      <table class="issues-table is-compact">
        <thead><tr><th>Check</th><th>Status</th><th>Value</th><th>Notes</th></tr></thead>
        <tbody>${checkRows}</tbody>
      </table>
    </div>`
        : ""
    }
    ${
      comparisonRows
        ? `<h3 class="panel-section-title">Live vs migration fields</h3>
    <div class="issues-table-wrap">
      <table class="issues-table">
        <thead><tr><th>Embed</th><th>Field</th><th>Live</th><th>Migration</th><th>Status</th></tr></thead>
        <tbody>${comparisonRows}</tbody>
      </table>
    </div>`
        : ""
    }
    ${renderIssuesTable(result?.issues ?? [], issueContext(report), "No embed issues recorded.")}`;
}

function stackCompareStatusClass(status: string): string {
  if (status === "MATCH") return "pass";
  if (status === "DIFFER") return "warning";
  if (status === "MISSING_MIGRATION") return "fail";
  if (status === "MISSING_LIVE") return "warning";
  return "";
}

export function renderTechStackModuleBody(
  report: PageReport,
  moduleId: "devTechnologies" | "serverComparison",
  intro: string
): string {
  const result = report.categories[moduleId];
  const details = result?.details as
    | {
        signals?: { prod?: Array<{ name: string; evidence: string }>; dev?: Array<{ name: string; evidence: string }> };
        comparisonRows?: Array<{
          name: string;
          liveValue: string;
          migrationValue: string;
          status: string;
        }>;
        prod?: { serverHeader?: string; poweredBy?: string; platform?: string; via?: string; contentType?: string };
        dev?: { serverHeader?: string; poweredBy?: string; platform?: string; via?: string; contentType?: string };
      }
    | undefined;

  const prodCount = details?.signals?.prod?.length ?? 0;
  const devCount = details?.signals?.dev?.length ?? 0;

  const comparisonRows = (details?.comparisonRows ?? [])
    .filter((row) => row.status !== "BOTH_EMPTY")
    .map(
      (row) => `<tr>
        <td>${escapeReportHtml(row.name)}</td>
        <td>${escapeReportHtml(row.liveValue || "—")}</td>
        <td>${escapeReportHtml(row.migrationValue || "—")}</td>
        <td><span class="pill ${stackCompareStatusClass(row.status)}">${escapeReportHtml(row.status)}</span></td>
      </tr>`
    )
    .join("");

  const headerRows =
    moduleId === "serverComparison"
      ? [
          ["Server", details?.prod?.serverHeader, details?.dev?.serverHeader],
          ["X-Powered-By", details?.prod?.poweredBy, details?.dev?.poweredBy],
          ["Platform", details?.prod?.platform, details?.dev?.platform],
          ["Via", details?.prod?.via, details?.dev?.via],
          ["Content-Type", details?.prod?.contentType, details?.dev?.contentType]
        ]
          .filter((row) => row[1] || row[2])
          .map(
            (row) => `<tr>
              <td>${escapeReportHtml(String(row[0]))}</td>
              <td>${escapeReportHtml(String(row[1] || "—"))}</td>
              <td>${escapeReportHtml(String(row[2] || "—"))}</td>
            </tr>`
          )
          .join("")
      : "";

  return `${renderCategoryIntro(result, intro)}
    <table>
      <thead><tr><th>Metric</th><th>Live</th><th>Migration</th></tr></thead>
      <tbody>
        <tr><td>Signals detected</td><td>${prodCount}</td><td>${devCount}</td></tr>
      </tbody>
    </table>
    ${
      headerRows
        ? `<h3 class="panel-section-title">Response headers</h3>
    <div class="issues-table-wrap">
      <table class="issues-table is-compact">
        <thead><tr><th>Header</th><th>Live</th><th>Migration</th></tr></thead>
        <tbody>${headerRows}</tbody>
      </table>
    </div>`
        : ""
    }
    ${
      comparisonRows
        ? `<h3 class="panel-section-title">Detected signals</h3>
    <div class="issues-table-wrap">
      <table class="issues-table">
        <thead><tr><th>Signal</th><th>Live</th><th>Migration</th><th>Status</th></tr></thead>
        <tbody>${comparisonRows}</tbody>
      </table>
    </div>`
        : `<p class="panel-subtitle">No signals detected on either site.</p>`
    }
    ${renderIssuesTable(result?.issues ?? [], issueContext(report), "No issues recorded.")}`;
}

export function renderDevTechnologiesBody(report: PageReport): string {
  const result = report.categories.devTechnologies;
  const details = result?.details as
    | {
        groupedRows?: Array<{
          group: string;
          rows: Array<{
            name: string;
            liveValue: string;
            migrationValue: string;
            status: string;
          }>;
        }>;
        signals?: { prod?: Array<{ name: string; evidence: string }>; dev?: Array<{ name: string; evidence: string }> };
      }
    | undefined;

  const prodCount = details?.signals?.prod?.length ?? 0;
  const devCount = details?.signals?.dev?.length ?? 0;

  const groupedTables = (details?.groupedRows ?? [])
    .map((group) => {
      const rows = group.rows
        .map(
          (row) => `<tr>
            <td>${escapeReportHtml(row.name)}</td>
            <td>${escapeReportHtml(row.liveValue || "—")}</td>
            <td>${escapeReportHtml(row.migrationValue || "—")}</td>
            <td><span class="pill ${stackCompareStatusClass(row.status)}">${escapeReportHtml(row.status)}</span></td>
          </tr>`
        )
        .join("");

      if (!rows) {
        return `<h3 class="panel-section-title">${escapeReportHtml(group.group)}</h3>
        <p class="panel-subtitle">No signals detected in this group.</p>`;
      }

      return `<h3 class="panel-section-title">${escapeReportHtml(group.group)}</h3>
      <div class="issues-table-wrap">
        <table class="issues-table is-compact">
          <thead><tr><th>Signal</th><th>Live</th><th>Migration</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    })
    .join("");

  return `${renderCategoryIntro(
    result,
    "Detects front-end frameworks, programming languages, CMS platforms, and related stack signals from page assets, globals, and headers."
  )}
    <table>
      <thead><tr><th>Metric</th><th>Live</th><th>Migration</th></tr></thead>
      <tbody>
        <tr><td>Total signals detected</td><td>${prodCount}</td><td>${devCount}</td></tr>
      </tbody>
    </table>
    ${groupedTables || `<p class="panel-subtitle">No development technology signals detected on either site.</p>`}
    ${renderIssuesTable(result?.issues ?? [], issueContext(report), "No development technology issues recorded.")}`;
}

export function renderServerComparisonBody(report: PageReport): string {
  return renderTechStackModuleBody(
    report,
    "serverComparison",
    "Compares server, hosting, and response headers between live and migration pages."
  );
}

export function renderLanguageBody(report: PageReport): string {
  const result = report.categories.language;
  const details = result?.details as
    | {
        prod?: { htmlLang?: string; hreflang?: Array<{ lang: string; href: string }> };
        dev?: { htmlLang?: string; hreflang?: Array<{ lang: string; href: string }> };
      }
    | undefined;

  const prodLang = details?.prod?.htmlLang?.trim() || "";
  const devLang = details?.dev?.htmlLang?.trim() || "";
  const prodHreflang = details?.prod?.hreflang ?? [];
  const devHreflang = details?.dev?.hreflang ?? [];

  const renderLangTag = (code: string, emptyLabel = "(none)"): string => {
    if (!code) {
      return `<span class="language-tag is-empty">${escapeReportHtml(emptyLabel)}</span>`;
    }
    return `<span class="language-tag">${escapeReportHtml(code)}</span>`;
  };

  const htmlLangBlock = `<div class="language-tags-panel">
    <h3 class="panel-section-title">Document language</h3>
    <div class="language-tags-grid">
      <div class="language-tags-col">
        <span class="language-tags-label">Live</span>
        ${renderLangTag(prodLang)}
      </div>
      <div class="language-tags-col">
        <span class="language-tags-label">Migration</span>
        ${renderLangTag(devLang)}
      </div>
    </div>
  </div>`;

  const prodHreflangTags = prodHreflang.length
    ? prodHreflang.map((item) => renderLangTag(item.lang)).join("")
    : renderLangTag("", "No hreflang tags");
  const devHreflangTags = devHreflang.length
    ? devHreflang.map((item) => renderLangTag(item.lang)).join("")
    : renderLangTag("", "No hreflang tags");

  const hreflangTagsBlock = `<div class="language-tags-panel">
    <h3 class="panel-section-title">hreflang tags</h3>
    <div class="language-tags-grid">
      <div class="language-tags-col">
        <span class="language-tags-label">Live (${prodHreflang.length})</span>
        <div class="language-tag-list">${prodHreflangTags}</div>
      </div>
      <div class="language-tags-col">
        <span class="language-tags-label">Migration (${devHreflang.length})</span>
        <div class="language-tag-list">${devHreflangTags}</div>
      </div>
    </div>
  </div>`;

  const prodHrefMap = new Map(prodHreflang.map((item) => [item.lang.toLowerCase(), item]));
  const devHrefMap = new Map(devHreflang.map((item) => [item.lang.toLowerCase(), item]));
  const allLangs = [...new Set([...prodHrefMap.keys(), ...devHrefMap.keys()])].sort();

  const hreflangRows = allLangs
    .map((langKey) => {
      const prodItem = prodHrefMap.get(langKey);
      const devItem = devHrefMap.get(langKey);
      const label = prodItem?.lang || devItem?.lang || langKey;
      const liveHref = prodItem?.href || "";
      const migrationHref = devItem?.href || "";
      let status = "MATCH";
      if (!liveHref) status = "MISSING_LIVE";
      else if (!migrationHref) status = "MISSING_MIGRATION";
      else if (liveHref !== migrationHref) status = "DIFFER";

      const statusClass =
        status === "MATCH" ? "pass" : status === "MISSING_MIGRATION" ? "fail" : "warning";

      return `<tr>
        <td>${renderLangTag(label)}</td>
        <td>${liveHref ? `<a href="${escapeReportHtml(liveHref)}" target="_blank" rel="noopener">${escapeReportHtml(liveHref)}</a>` : "—"}</td>
        <td>${migrationHref ? `<a href="${escapeReportHtml(migrationHref)}" target="_blank" rel="noopener">${escapeReportHtml(migrationHref)}</a>` : "—"}</td>
        <td><span class="pill ${statusClass}">${escapeReportHtml(status)}</span></td>
      </tr>`;
    })
    .join("");

  const hreflangTable = hreflangRows
    ? `<h3 class="panel-section-title">hreflang comparison</h3>
    <div class="issues-table-wrap">
      <table class="issues-table is-compact">
        <thead><tr><th>Language tag</th><th>Live href</th><th>Migration href</th><th>Status</th></tr></thead>
        <tbody>${hreflangRows}</tbody>
      </table>
    </div>`
    : `<p class="panel-subtitle">No hreflang tags found on either site.</p>`;

  return `${renderCategoryIntro(result, "Checks html lang, hreflang tags, and placeholder text on the migration page.")}
    ${htmlLangBlock}
    ${hreflangTagsBlock}
    ${hreflangTable}
    ${renderIssuesTable(result?.issues ?? [], issueContext(report), "No language issues recorded.")}`;
}

export function renderBrokenLinksBody(report: PageReport): string {
  const result = report.categories.brokenLinks;
  return `${renderCategoryIntro(result, "HTTP status checks on internal links found on live and migration pages.")}
    ${renderIssuesTable(result?.issues ?? [], issueContext(report), "No broken links detected.")}`;
}

export function renderContentBody(report: PageReport): string {
  const result = report.categories.content;
  const details = result?.details as
    | { similarity?: number; lengthDifference?: number; missingSnippets?: string[]; extraSnippets?: string[] }
    | undefined;

  const similarity =
    typeof details?.similarity === "number" ? `${Math.round(details.similarity * 100)}%` : "—";
  const lengthDelta =
    typeof details?.lengthDifference === "number" ? `${Math.round(details.lengthDifference * 100)}%` : "—";

  const missing = (details?.missingSnippets ?? [])
    .map((snippet) => `<li>${escapeReportHtml(snippet)}</li>`)
    .join("");
  const extra = (details?.extraSnippets ?? [])
    .map((snippet) => `<li>${escapeReportHtml(snippet)}</li>`)
    .join("");

  return `${renderCategoryIntro(result, "Compares main body text similarity and length between live and migration pages.")}
    <table>
      <thead><tr><th>Metric</th><th>Value</th></tr></thead>
      <tbody>
        <tr><td>Text similarity</td><td>${escapeReportHtml(similarity)}</td></tr>
        <tr><td>Length difference</td><td>${escapeReportHtml(lengthDelta)}</td></tr>
      </tbody>
    </table>
    ${missing ? `<p><strong>Missing on migration:</strong></p><ul>${missing}</ul>` : ""}
    ${extra ? `<p><strong>Extra on migration:</strong></p><ul>${extra}</ul>` : ""}
    ${renderIssuesTable(result?.issues ?? [], issueContext(report), "No content issues recorded.")}`;
}

export function renderImagesBody(report: PageReport): string {
  const result = report.categories.images;
  const details = result?.details as { prodCount?: number; devCount?: number } | undefined;

  return `${renderCategoryIntro(result, "Compares visible image counts, sources, and alt text.")}
    <table>
      <thead><tr><th>Site</th><th>Visible images</th></tr></thead>
      <tbody>
        <tr><td>Live</td><td>${details?.prodCount ?? "—"}</td></tr>
        <tr><td>Migration</td><td>${details?.devCount ?? "—"}</td></tr>
      </tbody>
    </table>
    ${renderIssuesTable(result?.issues ?? [], issueContext(report), "No image issues recorded.")}`;
}

function renderSpacingColorMark(row: {
  scope: string;
  color: string;
  colorName: string;
  gapLabel: string;
  liveGapPx: string;
  migrationGapPx: string;
  deltaPx: string;
  status: string;
}): string {
  const scopeLabel = row.scope === "inside-section" ? "Inside section" : "Between sections";
  const insideClass = row.scope === "inside-section" ? "spacing-legend-swatch--inside" : "";

  return `<span class="spacing-legend-tooltip-wrap">
    <span
      class="spacing-legend-swatch ${insideClass}"
      style="border-color:${escapeReportHtml(row.color)};background:${escapeReportHtml(row.color)}22"
      tabindex="0"
      aria-label="${escapeReportHtml(`${row.colorName}: ${row.gapLabel}`)}"
    ></span>
    <span class="spacing-legend-tooltip">
      <strong>${escapeReportHtml(row.colorName)}</strong>
      <span>${escapeReportHtml(scopeLabel)}</span>
      <span>${escapeReportHtml(row.gapLabel)}</span>
      <span>Live ${escapeReportHtml(row.liveGapPx)} · Migration ${escapeReportHtml(row.migrationGapPx)}</span>
      <span>Delta ${escapeReportHtml(row.deltaPx)} · ${escapeReportHtml(row.status)}</span>
    </span>
  </span>`;
}

export function renderModuleSpacingBody(report: PageReport): string {
  const result = report.categories.moduleSpacing;
  const details = result?.details as
    | {
        prod?: {
          overviewProdScreenshot?: string;
          overviewDevScreenshot?: string;
          wrapperLabel?: string;
        };
        comparisonRows?: Array<{
          gapLabel: string;
          scope: string;
          liveGapPx: string;
          migrationGapPx: string;
          deltaPx: string;
          color: string;
          colorName: string;
          status: string;
        }>;
        sectionHeightRows?: Array<{
          sectionLabel: string;
          liveHeightPx: string;
          migrationHeightPx: string;
          deltaPx: string;
          status: string;
        }>;
      }
    | undefined;

  const prodShot = details?.prod?.overviewProdScreenshot;
  const devShot = details?.prod?.overviewDevScreenshot;

  if (!prodShot || !devShot) {
    return `<p class="panel-subtitle">Module spacing screenshots were not captured for this run.</p>`;
  }

  const wrapperNote = details?.prod?.wrapperLabel
    ? `<p class="panel-subtitle">Main wrapper: <strong>${escapeReportHtml(details.prod.wrapperLabel)}</strong> · Hover a color mark for gap path and details. Solid = between sections, dashed = inside section.</p>`
    : `<p class="panel-subtitle">Hover a color mark for gap path and details. Solid = between sections, dashed = inside section.</p>`;

  const gapTableRows = (details?.comparisonRows ?? [])
    .map(
      (row) => `<tr>
        <td class="spacing-gap-mark-cell">${renderSpacingColorMark(row)}</td>
        <td>${escapeReportHtml(row.gapLabel)}</td>
        <td>${escapeReportHtml(row.liveGapPx)}</td>
        <td>${escapeReportHtml(row.migrationGapPx)}</td>
      </tr>`
    )
    .join("");

  const gapTable = gapTableRows
    ? `<div class="issues-table-wrap spacing-gap-table-wrap">
      <table class="issues-table is-compact spacing-gap-table">
        <thead><tr><th>Mark</th><th>Gap path</th><th>Live</th><th>Migration</th></tr></thead>
        <tbody>${gapTableRows}</tbody>
      </table>
    </div>`
    : "";

  const heightRows = (details?.sectionHeightRows ?? [])
    .map(
      (row) => `<tr>
        <td>${escapeReportHtml(row.sectionLabel)}</td>
        <td>${escapeReportHtml(row.liveHeightPx)}</td>
        <td>${escapeReportHtml(row.migrationHeightPx)}</td>
        <td>${escapeReportHtml(row.deltaPx)}</td>
        <td><span class="pill ${spacingRowStatusClass(row.status)}">${escapeReportHtml(row.status)}</span></td>
      </tr>`
    )
    .join("");

  const heightTable = heightRows
    ? `<div class="issues-table-wrap">
      <table class="issues-table is-compact">
        <thead><tr><th>Section</th><th>Live height</th><th>Migration height</th><th>Delta</th><th>Status</th></tr></thead>
        <tbody>${heightRows}</tbody>
      </table>
    </div>`
    : "";

  const issues = result?.issues ?? [];
  const issuesBlock = issues.length
    ? renderIssuesTable(issues, issueContext(report), "No module spacing issues recorded.")
    : "";

  return `${wrapperNote}
  ${gapTable}
  <div class="screens-compare">
    <div class="screens-compare-scroll spacing-fullpage-scroll" tabindex="0" aria-label="Module spacing comparison (live and migration scroll together)">
      <div class="screens-compare-grid screens-compare-grid--two">
        <div class="screens-col">
          <h3 class="screens-col-title">Live</h3>
          <img src="${escapeReportHtml(prodShot)}" alt="Live full page with colored spacing gap marks">
        </div>
        <div class="screens-col">
          <h3 class="screens-col-title">Migration</h3>
          <img src="${escapeReportHtml(devShot)}" alt="Migration full page with colored spacing gap marks">
        </div>
      </div>
    </div>
  </div>
  ${heightTable}
  ${issuesBlock}`;
}

function spacingRowStatusClass(status: string): string {
  if (status === "MATCH") return "pass";
  if (status === "DIFFER") return "warning";
  if (status === "MISSING_MIGRATION") return "fail";
  if (status === "MISSING_LIVE") return "warning";
  return "";
}
