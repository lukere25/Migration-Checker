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
  const details = report.categories.textStyle?.details as
    | {
        prod?: Array<{ key: string; tag: string; text: string; styles: Record<string, string> }>;
        dev?: Array<{ key: string; tag: string; text: string; styles: Record<string, string> }>;
      }
    | undefined;

  const prod = details?.prod || [];
  const dev = new Map((details?.dev || []).map((sample) => [sample.key, sample]));
  if (!prod.length) {
    return `<p class="panel-subtitle">No text style samples were captured for this page.</p>`;
  }

  const rows = prod
    .map((sample) => {
      const migration = dev.get(sample.key);
      const styleSummary = migration
        ? `font ${sample.styles.fontSize}/${sample.styles.fontWeight} vs ${migration.styles.fontSize}/${migration.styles.fontWeight}`
        : "missing on migration";
      return `<tr>
        <td>${escapeReportHtml(sample.key)}</td>
        <td>${escapeReportHtml(sample.text)}</td>
        <td>${escapeReportHtml(styleSummary)}</td>
      </tr>`;
    })
    .join("");

  return `<p class="panel-subtitle">Compares computed styles for visible headings and sample paragraphs.</p>
    <table>
      <thead><tr><th>Element</th><th>Live text</th><th>Style summary</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
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
  moduleId: "devTechnologies" | "programmingLanguages" | "cms" | "serverComparison",
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
  return renderTechStackModuleBody(
    report,
    "devTechnologies",
    "Detects front-end frameworks, libraries, analytics, and build tool signals from page assets and globals."
  );
}

export function renderProgrammingLanguagesBody(report: PageReport): string {
  return renderTechStackModuleBody(
    report,
    "programmingLanguages",
    "Detects backend language markers from response headers, URLs, and page hints."
  );
}

export function renderCmsBody(report: PageReport): string {
  return renderTechStackModuleBody(
    report,
    "cms",
    "Detects CMS platforms from generator tags, asset paths, and platform-specific markers."
  );
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
    | { prod?: { htmlLang?: string; hreflang?: Array<{ lang: string; href: string }> }; dev?: { htmlLang?: string; hreflang?: Array<{ lang: string; href: string }> } }
    | undefined;

  const prodLang = details?.prod?.htmlLang || "—";
  const devLang = details?.dev?.htmlLang || "—";

  return `${renderCategoryIntro(result, "Checks html lang, hreflang tags, and placeholder text on the migration page.")}
    <table>
      <thead><tr><th>Check</th><th>Live</th><th>Migration</th></tr></thead>
      <tbody>
        <tr><td>html lang</td><td>${escapeReportHtml(prodLang)}</td><td>${escapeReportHtml(devLang)}</td></tr>
        <tr><td>hreflang tags</td><td>${details?.prod?.hreflang?.length ?? 0}</td><td>${details?.dev?.hreflang?.length ?? 0}</td></tr>
      </tbody>
    </table>
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
