import path from "path";
import { COMPARISON_MODULES } from "../comparisonModules";
import { config } from "../config";
import { writeText } from "../utils/fileUtils";
import { PageReport, SummaryReport } from "./reportTypes";
import { buildBrokenLinksSummary, buildMetadataSummary } from "./reportSummaries";
import { allMetaComparisonComponentCss, renderAllMetaTagsComparisonBody } from "./allMetaComparisonComponent";
import {
  headingTreeCss,
  renderBrokenLinksBody,
  renderContentBody,
  renderCmsBody,
  renderDevTechnologiesBody,
  renderEmbedsBody,
  renderHeadingsBody,
  renderHTagHierarchyBody,
  renderImagesBody,
  renderLanguageBody,
  renderPageSpeedBody,
  renderProgrammingLanguagesBody,
  renderSchemaBody,
  renderServerComparisonBody,
  renderTextStyleBody
} from "./moduleReportPanels";
import { moduleScoreCardsCss, renderModuleScoreCards, renderSummaryModuleScoreCards, getReportEnabledModuleIds, getSummaryEnabledModuleIds, getModulePageAnchor } from "./moduleScoreCards";
import {
  escapeReportHtml,
  pageReportDashboardCss,
  pageReportDashboardScript,
  renderAccordion,
  statusClass
} from "./pageReportLayout";
import { issueTableCss, IssueTableContext, renderIssueJiraLink, renderIssueTableRows, renderJiraLinkForSummaryRow } from "./issueTable";

function issueTableContext(report: PageReport): IssueTableContext {
  const relative = path.relative(config.reportsDir, report.reportPaths.html).replace(/\\/g, "/");
  const reportUrl =
    relative && !relative.startsWith("..") ? `/reports/${relative}` : undefined;

  return {
    pageName: report.pageName,
    prodUrl: report.prodUrl,
    devUrl: report.devUrl,
    reportUrl
  };
}

function renderIssuesBody(report: PageReport): string {
  return `<div class="issues-table-wrap">
    <table class="issues-table">
      <thead><tr><th>Severity</th><th>Category</th><th>Message</th><th>Live</th><th>Migration</th><th>Jira</th></tr></thead>
      <tbody>${renderIssueTableRows(report.issues, issueTableContext(report))}</tbody>
    </table>
  </div>`;
}

function renderIssuesPanel(report: PageReport): string {
  if (!report.issues.length) {
    return "";
  }

  return `<section class="report-issues-panel" id="issues-panel">
    <h2>Issues</h2>
    <p class="panel-subtitle">Each row has a <strong>Create Jira issue</strong> link with summary and description prefilled. Configure Jira under <a href="/settings.html">Settings</a> if links say Configure Jira.</p>
    ${renderIssuesBody(report)}
  </section>`;
}

const summaryReportCss = `
  ${pageReportDashboardCss}
  ${moduleScoreCardsCss}
  ${issueTableCss}
  .stat-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 14px;
    margin-bottom: 28px;
  }
  .stat-card {
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px 18px;
    background: var(--panel);
    box-shadow: var(--shadow);
  }
  .stat-card strong {
    display: block;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
    margin-bottom: 8px;
  }
  .stat-card .stat-value {
    font-size: 1.75rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: var(--text);
    line-height: 1.1;
  }
  .stat-card.pass .stat-value { color: #22c55e; }
  .stat-card.fail .stat-value { color: #ef4444; }
  .stat-card.warning .stat-value { color: #f59e0b; }
  .summary-section {
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--panel);
    padding: 20px 22px 22px;
    margin-bottom: 20px;
    box-shadow: var(--shadow);
  }
  .summary-section h2 {
    margin: 0 0 8px;
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--text);
  }
  .summary-section .scope {
    color: var(--muted);
    font-size: 14px;
    margin: 0 0 12px;
  }
  .summary-section ul {
    margin: 8px 0 12px 18px;
    color: var(--muted);
    font-size: 14px;
  }
  .summary-section a { color: var(--accent); word-break: break-all; }
  .summary-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 14px;
  }
  .summary-stats span {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 6px 12px;
    font-size: 13px;
    color: var(--text);
  }
  .summary-results-panel {
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--panel);
    padding: 20px 22px 22px;
    box-shadow: var(--shadow);
  }
  .summary-results-panel h2 {
    margin: 0 0 14px;
    font-size: 1.05rem;
    font-weight: 700;
  }
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  }
  .filters button {
    border: 1px solid var(--border);
    background: var(--bg-elevated);
    color: var(--text);
    border-radius: 999px;
    padding: 8px 14px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
  }
  .filters button:hover,
  .filters button.is-active {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent);
  }
  .summary-table-wrap {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg-elevated);
  }
  .summary-table-wrap table {
    margin-top: 0;
    min-width: 960px;
  }
  .summary-table-wrap a {
    color: var(--accent);
    font-weight: 600;
    text-decoration: none;
  }
  .summary-table-wrap a:hover { text-decoration: underline; }
`;

const pageReportCss = `
  ${pageReportDashboardCss}
  ${moduleScoreCardsCss}
  ${headingTreeCss}
  ${allMetaComparisonComponentCss}
  ${issueTableCss}
  .screens-compare {
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    background: var(--bg-elevated);
  }
  .screens-compare-scroll {
    max-height: 85vh;
    overflow: auto;
    -webkit-overflow-scrolling: touch;
  }
  .screens-compare-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0;
    align-items: start;
  }
  .screens-col {
    border-right: 1px solid var(--border);
    min-width: 0;
  }
  .screens-col:last-child { border-right: none; }
  .screens-col-title {
    position: sticky;
    top: 0;
    z-index: 2;
    margin: 0;
    padding: 10px 12px;
    font-size: 14px;
    background: var(--table-head);
    border-bottom: 1px solid var(--border);
    color: var(--text);
  }
  .screens-col img {
    display: block;
    width: 100%;
    height: auto;
    vertical-align: top;
  }
  @media (max-width: 900px) {
    .screens-compare-grid { grid-template-columns: 1fr; }
    .screens-col { border-right: none; border-bottom: 1px solid var(--border); }
    .screens-col:last-child { border-bottom: none; }
  }
  @media print {
    .screens-compare-grid { grid-template-columns: 1fr; }
    .screens-col {
      border-right: none;
      border-bottom: 1px solid var(--border);
      page-break-inside: avoid;
    }
    .screens-col:last-child { border-bottom: none; }
  }
`;

function summaryTableRows(rows: ReturnType<typeof buildMetadataSummary>["rows"], emptyMessage: string): string {
  if (!rows.length) return `<tr><td colspan="7">${escapeReportHtml(emptyMessage)}</td></tr>`;
  return rows
    .map(
      (row) => `<tr>
        <td>${escapeReportHtml(row.pageName)}</td>
        <td>${escapeReportHtml(row.browserName)}</td>
        <td><span class="pill ${row.severity.toLowerCase()}">${row.severity}</span></td>
        <td>${escapeReportHtml(row.field || "")}</td>
        <td>${escapeReportHtml(row.message)}${row.url ? `<br><small>${escapeReportHtml(row.url)}</small>` : ""}</td>
        <td>${escapeReportHtml(row.devValue || row.prodValue || "")}</td>
        <td class="jira-action-cell">${renderJiraLinkForSummaryRow(row)}</td>
      </tr>`
    )
    .join("");
}

function renderAllIssuesSummarySection(results: PageReport[]): string {
  const rows = results.flatMap((report) =>
    report.issues.map((issue) => ({
      pageName: report.pageName,
      path: report.path,
      browserName: report.browserName,
      severity: issue.severity,
      message: issue.message,
      url: issue.url,
      prodValue: issue.prodValue,
      devValue: issue.devValue,
      category: issue.category,
      prodUrl: report.prodUrl,
      devUrl: report.devUrl
    }))
  );

  if (!rows.length) {
    return "";
  }

  const body = rows
    .map(
      (row) => `<tr>
        <td>${escapeReportHtml(row.pageName)}</td>
        <td>${escapeReportHtml(row.browserName)}</td>
        <td><span class="pill ${row.severity.toLowerCase()}">${row.severity}</span></td>
        <td>${escapeReportHtml(row.category || "")}</td>
        <td>${escapeReportHtml(row.message)}${row.url ? `<br><small>${escapeReportHtml(row.url)}</small>` : ""}</td>
        <td class="jira-action-cell">${renderJiraLinkForSummaryRow(row)}</td>
      </tr>`
    )
    .join("");

  return `<section class="report-issues-panel summary-issues-panel" id="all-issues-summary">
    <h2>All issues</h2>
    <p class="panel-subtitle">Every issue across all compared pages. Use <strong>Create Jira issue</strong> to file a ticket with prefilled details.</p>
    <div class="issues-table-wrap">
      <table class="issues-table">
        <thead><tr><th>Page</th><th>Browser</th><th>Severity</th><th>Category</th><th>Message</th><th>Jira issue</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  </section>`;
}

function renderMetadataSummaryBox(results: PageReport[]): string {
  const summary = buildMetadataSummary(results);
  return `<section class="summary-section" id="metadata-summary">
    <h2>Metadata validation summary</h2>
    <p class="scope">${escapeReportHtml(summary.scope)}</p>
    <p class="scope"><strong>Checked:</strong></p>
    <ul>${summary.checkedFields.map((field) => `<li>${escapeReportHtml(field)}</li>`).join("")}</ul>
    <p class="scope"><strong>Not checked:</strong> ${escapeReportHtml(summary.excludedFields.join(", "))}</p>
    <div class="summary-stats">
      <span><strong>Pages passed:</strong> ${summary.totals.pass}</span>
      <span><strong>Warnings:</strong> ${summary.totals.warning}</span>
      <span><strong>Failed:</strong> ${summary.totals.fail}</span>
      <span><strong>Field issues:</strong> ${summary.issueCount}</span>
    </div>
    <table>
      <thead><tr><th>Page</th><th>Browser</th><th>Severity</th><th>Field</th><th>Message</th><th>Migration value</th><th>Jira issue</th></tr></thead>
      <tbody>${summaryTableRows(summary.rows, "All metadata checks passed on migration pages.")}</tbody>
    </table>
  </section>`;
}

function renderBrokenLinksSummaryBox(results: PageReport[]): string {
  const summary = buildBrokenLinksSummary(results);
  return `<section class="summary-section" id="broken-links-summary">
    <h2>Broken links summary</h2>
    <p class="scope">HTTP status checks on internal links found on each page (live and migration sites).</p>
    <div class="summary-stats">
      <span><strong>Broken (4xx/5xx):</strong> ${summary.totals.broken}</span>
      <span><strong>Redirects:</strong> ${summary.totals.redirect}</span>
      <span><strong>Other:</strong> ${summary.totals.other}</span>
      <span><strong>Total issues:</strong> ${summary.issueCount}</span>
    </div>
    <table>
      <thead><tr><th>Page</th><th>Browser</th><th>Severity</th><th>Type</th><th>Message</th><th>URL</th><th>Jira issue</th></tr></thead>
      <tbody>${summary.rows.length ? summary.rows.map((row) => `<tr>
        <td>${escapeReportHtml(row.pageName)}</td>
        <td>${escapeReportHtml(row.browserName)}</td>
        <td><span class="pill ${row.severity.toLowerCase()}">${row.severity}</span></td>
        <td>${escapeReportHtml(row.field || "")}</td>
        <td>${escapeReportHtml(row.message)}</td>
        <td>${row.url ? `<a href="${escapeReportHtml(row.url)}">${escapeReportHtml(row.url)}</a>` : ""}</td>
        <td class="jira-action-cell">${renderJiraLinkForSummaryRow(row)}</td>
      </tr>`).join("") : `<tr><td colspan="7">No broken links detected.</td></tr>`}</tbody>
    </table>
  </section>`;
}

function renderVisualComparisonBody(report: PageReport): string {
  if (!report.screenshots.prod || !report.screenshots.dev) {
    return `<p class="panel-subtitle">Visual comparison was not included in this run.</p>`;
  }

  const prod = escapeReportHtml(path.basename(report.screenshots.prod));
  const dev = escapeReportHtml(path.basename(report.screenshots.dev));
  const diff = escapeReportHtml(path.basename(report.screenshots.diff));
  const visualStatus = report.categories.visual?.status || "PASS";
  const visualSummary = report.categories.visual?.summary || "No visual comparison data";
  const pdfName = report.reportPaths.pdf ? path.basename(report.reportPaths.pdf) : "index.pdf";

  return `<p class="panel-subtitle">
      Side by side — <strong>Live</strong>
      <a href="${escapeReportHtml(report.prodUrl)}" target="_blank" rel="noopener">open</a>
      vs <strong>Migration</strong>
      <a href="${escapeReportHtml(report.devUrl)}" target="_blank" rel="noopener">open</a>
      · ${escapeReportHtml(visualSummary)}
      · <span class="no-print"><a href="${escapeReportHtml(pdfName)}" download="${escapeReportHtml(pdfName)}">PDF report</a></span>
    </p>
    <div class="screens-compare">
      <div class="screens-compare-scroll" id="screens-compare-scroll" tabindex="0" aria-label="Screenshot comparison (production, development, diff scroll together)">
        <div class="screens-compare-grid">
          <div class="screens-col">
            <h3 class="screens-col-title">Production</h3>
            <img src="${prod}" alt="Production full-page screenshot">
          </div>
          <div class="screens-col">
            <h3 class="screens-col-title">Development</h3>
            <img src="${dev}" alt="Development full-page screenshot">
          </div>
          <div class="screens-col">
            <h3 class="screens-col-title">Diff</h3>
            <img src="${diff}" alt="Visual diff">
          </div>
        </div>
      </div>
    </div>`;
}

function isReportModuleEnabled(report: PageReport, moduleId: string): boolean {
  return getReportEnabledModuleIds(report).includes(moduleId);
}

function renderReportDownloadBar(report: PageReport): string {
  const pdfName = report.reportPaths.pdf ? path.basename(report.reportPaths.pdf) : "index.pdf";
  const pdfHref = escapeReportHtml(pdfName);
  return `<div class="report-actions no-print">
    <a href="${pdfHref}" download="${pdfHref}">Download PDF report</a>
    <a class="secondary" href="#" onclick="window.print(); return false;">Print this page</a>
  </div>`;
}

function renderPageAccordions(report: PageReport): string {
  const parts: string[] = [];

  for (const module of COMPARISON_MODULES) {
    if (!isReportModuleEnabled(report, module.id) || !report.categories[module.id]) {
      continue;
    }

    const status = report.categories[module.id]?.status || "PASS";
    const anchor = getModulePageAnchor(module.id);

    switch (module.id) {
      case "metadata":
        parts.push(
          renderAccordion({
            id: anchor,
            title: "Metadata",
            subtitle: "Live vs migration meta tags",
            status,
            open: true,
            body: renderAllMetaTagsComparisonBody(report)
          })
        );
        break;
      case "schema":
        parts.push(
          renderAccordion({
            id: anchor,
            title: "Schema",
            subtitle: "JSON-LD structured data comparison",
            status,
            open: false,
            body: renderSchemaBody(report)
          })
        );
        break;
      case "embeds":
        parts.push(
          renderAccordion({
            id: anchor,
            title: "Iframe & embeds",
            subtitle: "Iframe, embed, and embedded widget comparison",
            status,
            open: false,
            body: renderEmbedsBody(report)
          })
        );
        break;
      case "devTechnologies":
        parts.push(
          renderAccordion({
            id: anchor,
            title: "Development technologies",
            subtitle: "Frameworks, libraries, and front-end stack signals",
            status,
            open: false,
            body: renderDevTechnologiesBody(report)
          })
        );
        break;
      case "programmingLanguages":
        parts.push(
          renderAccordion({
            id: anchor,
            title: "Programming languages",
            subtitle: "Backend language markers and runtime hints",
            status,
            open: false,
            body: renderProgrammingLanguagesBody(report)
          })
        );
        break;
      case "cms":
        parts.push(
          renderAccordion({
            id: anchor,
            title: "CMS",
            subtitle: "CMS platform and generator detection",
            status,
            open: false,
            body: renderCmsBody(report)
          })
        );
        break;
      case "serverComparison":
        parts.push(
          renderAccordion({
            id: anchor,
            title: "Server comparison",
            subtitle: "Server, hosting, and response header comparison",
            status,
            open: false,
            body: renderServerComparisonBody(report)
          })
        );
        break;
      case "language":
        parts.push(
          renderAccordion({
            id: anchor,
            title: "Language",
            subtitle: "html lang, hreflang, and placeholders",
            status,
            open: false,
            body: renderLanguageBody(report)
          })
        );
        break;
      case "brokenLinks":
        parts.push(
          renderAccordion({
            id: anchor,
            title: "Broken links",
            subtitle: "HTTP status on internal links",
            status,
            open: false,
            body: renderBrokenLinksBody(report)
          })
        );
        break;
      case "headings":
        parts.push(
          renderAccordion({
            id: anchor,
            title: "Headings",
            subtitle: "Heading text and level comparison",
            status,
            open: false,
            body: renderHeadingsBody(report)
          })
        );
        break;
      case "hTagHierarchy":
        parts.push(
          renderAccordion({
            id: anchor,
            title: "H tag hierarchy",
            subtitle: "Heading order and skipped levels",
            status,
            open: false,
            body: renderHTagHierarchyBody(report)
          })
        );
        break;
      case "textStyle":
        parts.push(
          renderAccordion({
            id: anchor,
            title: "Text style match",
            subtitle: "Computed typography comparison",
            status,
            open: false,
            body: renderTextStyleBody(report)
          })
        );
        break;
      case "pageSpeed":
        parts.push(
          renderAccordion({
            id: anchor,
            title: "Page speed match",
            subtitle: "Load timing comparison",
            status,
            open: false,
            body: renderPageSpeedBody(report)
          })
        );
        break;
      case "content":
        parts.push(
          renderAccordion({
            id: anchor,
            title: "Content",
            subtitle: "Body text similarity and length",
            status,
            open: false,
            body: renderContentBody(report)
          })
        );
        break;
      case "images":
        parts.push(
          renderAccordion({
            id: anchor,
            title: "Images",
            subtitle: "Image sources and alt text",
            status,
            open: false,
            body: renderImagesBody(report)
          })
        );
        break;
      case "visual":
        parts.push(
          renderAccordion({
            id: anchor,
            title: "Visual comparison",
            subtitle: "Production, migration, and pixel diff",
            status,
            open: true,
            body: renderVisualComparisonBody(report)
          })
        );
        break;
      default:
        break;
    }
  }

  return `<div class="report-accordions">${parts.join("")}</div>`;
}

export async function writePageHtml(report: PageReport): Promise<void> {
  const html = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="/sync-scope-logo.png" type="image/png">
  <title>${escapeReportHtml(report.pageName)} - ${escapeReportHtml(report.browserName)}</title>
  <style>${pageReportCss}</style>
</head>
<body>
  <div class="report-shell">
    <div class="report-topbar no-print">
      <div class="report-brand">
        <img src="/sync-scope-logo.png" alt="Sync Scope" class="report-brand-logo">
        <span class="accordion-subtitle">Sync Scope report</span>
      </div>
      <div class="report-topbar-actions">
        <a class="settings-link" href="/settings.html" aria-label="Settings" title="Settings">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7m7.43-2.75c.04-.32.07-.64.07-.97 0-.33-.03-.66-.07-1l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.6-.22l-2.49 1a7.2 7.2 0 0 0-1.73-1l-.38-2.65A.5.5 0 0 0 13 2h-4a.5.5 0 0 0-.49.42l-.38 2.65c-.62.25-1.2.58-1.73 1l-2.49-1a.5.5 0 0 0-.6.22l-2 3.46a.5.5 0 0 0 .12.64L3.57 11c-.04.34-.07.67-.07 1 0 .33.03.65.07.97l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46c.13.22.39.3.6.22l2.49-1c.53.42 1.11.75 1.73 1l.38 2.65c.05.24.26.41.49.41h4c.23 0 .44-.17.49-.41l.38-2.65c.62-.25 1.2-.58 1.73-1l2.49 1c.22.09.47 0 .6-.22l2-3.46a.5.5 0 0 0-.12-.64z"/></svg>
        </a>
        <button type="button" class="theme-toggle" id="theme-toggle" aria-label="Toggle color theme">Dark mode</button>
      </div>
    </div>
    ${renderReportDownloadBar(report)}
    <header class="report-header">
      <h1>${escapeReportHtml(report.pageName)}</h1>
      <p><strong>Overall:</strong> <span class="pill ${statusClass(report.overallStatus)}">${report.overallStatus}</span></p>
      <div class="meta-grid">
        <div><strong>Live:</strong> <a href="${escapeReportHtml(report.prodUrl)}">${escapeReportHtml(report.prodUrl)}</a></div>
        <div><strong>Migration:</strong> <a href="${escapeReportHtml(report.devUrl)}">${escapeReportHtml(report.devUrl)}</a></div>
        <div><strong>Browser:</strong> ${escapeReportHtml(report.browserName)}</div>
        <div><strong>Tested:</strong> ${escapeReportHtml(report.testedAt)}</div>
      </div>
    </header>
    ${renderModuleScoreCards(report)}
    ${renderPageAccordions(report)}
    ${renderIssuesPanel(report)}
  </div>
  <script>${pageReportDashboardScript}</script>
</body>
</html>`;

  await writeText(report.reportPaths.html, html);
}

function categoryStatusPill(status?: string): string {
  if (!status) return "—";
  return `<span class="pill ${statusClass(status)}">${escapeReportHtml(status)}</span>`;
}

function renderSummaryStatCards(summary: SummaryReport): string {
  return `<div class="stat-cards">
    <div class="stat-card"><strong>Total pages</strong><div class="stat-value">${summary.totals.totalPages}</div></div>
    <div class="stat-card"><strong>Browser runs</strong><div class="stat-value">${summary.totals.totalBrowserRuns}</div></div>
    <div class="stat-card pass"><strong>Passed</strong><div class="stat-value">${summary.totals.passed}</div></div>
    <div class="stat-card fail"><strong>Failed</strong><div class="stat-value">${summary.totals.failed}</div></div>
    <div class="stat-card warning"><strong>Warning</strong><div class="stat-value">${summary.totals.warning}</div></div>
    <div class="stat-card"><strong>Skipped</strong><div class="stat-value">${summary.totals.skipped}</div></div>
  </div>`;
}

export async function writeSummaryHtml(summary: SummaryReport): Promise<void> {
  const enabledModuleIds = getSummaryEnabledModuleIds(summary.results);
  const enabledModules = COMPARISON_MODULES.filter((module) => enabledModuleIds.includes(module.id));
  const moduleHeaders = enabledModules
    .map((module) => `<th id="summary-module-${escapeReportHtml(module.id)}">${escapeReportHtml(module.label)}</th>`)
    .join("");

  const rows = summary.results
    .map((report) => {
      const reportLink = path.relative(config.reportsDir, report.reportPaths.html).replace(/\\/g, "/");
      const pdfLink = report.reportPaths.pdf
        ? path.relative(config.reportsDir, report.reportPaths.pdf).replace(/\\/g, "/")
        : reportLink.replace(/index\.html$/, "index.pdf");
      const moduleCells = enabledModules
        .map((module) => {
          const status = report.categories[module.id]?.status;
          return `<td>${status ? categoryStatusPill(status) : "—"}</td>`;
        })
        .join("");

      return `<tr data-status="${report.overallStatus}">
        <td>${escapeReportHtml(report.pageName)}</td>
        <td>${escapeReportHtml(report.path)}</td>
        <td>${escapeReportHtml(report.browserName)}</td>
        <td>${categoryStatusPill(report.overallStatus)}</td>
        ${moduleCells}
        <td>${report.blockingIssues.length}</td>
        <td>${report.warnings.length}</td>
        <td><a href="${escapeReportHtml(reportLink)}">Report</a> · <a href="${escapeReportHtml(pdfLink)}" download>PDF</a></td>
      </tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="/sync-scope-logo.png" type="image/png">
  <title>Sync Scope Summary</title>
  <style>${summaryReportCss}</style>
</head>
<body>
  <div class="report-shell">
    <div class="report-topbar no-print">
      <div class="report-brand">
        <img src="/sync-scope-logo.png" alt="Sync Scope" class="report-brand-logo">
        <span class="accordion-subtitle">Sync Scope summary</span>
      </div>
      <div class="report-topbar-actions">
        <a class="settings-link" href="/settings.html" aria-label="Settings" title="Settings">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7m7.43-2.75c.04-.32.07-.64.07-.97 0-.33-.03-.66-.07-1l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.6-.22l-2.49 1a7.2 7.2 0 0 0-1.73-1l-.38-2.65A.5.5 0 0 0 13 2h-4a.5.5 0 0 0-.49.42l-.38 2.65c-.62.25-1.2.58-1.73 1l-2.49-1a.5.5 0 0 0-.6.22l-2 3.46a.5.5 0 0 0 .12.64L3.57 11c-.04.34-.07.67-.07 1 0 .33.03.65.07.97l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46c.13.22.39.3.6.22l2.49-1c.53.42 1.11.75 1.73 1l.38 2.65c.05.24.26.41.49.41h4c.23 0 .44-.17.49-.41l.38-2.65c.62-.25 1.2-.58 1.73-1l2.49 1c.22.09.47 0 .6-.22l2-3.46a.5.5 0 0 0-.12-.64z"/></svg>
        </a>
        <button type="button" class="theme-toggle" id="theme-toggle" aria-label="Toggle color theme">Dark mode</button>
      </div>
    </div>

    <header class="report-header">
      <h1>Sync Scope Summary</h1>
      <p class="panel-subtitle">Generated ${escapeReportHtml(summary.generatedAt)}</p>
      <div class="meta-grid">
        <div><strong>Pages compared:</strong> ${summary.totals.totalPages}</div>
        <div><strong>Browser runs:</strong> ${summary.totals.totalBrowserRuns}</div>
        <div><strong>Passed:</strong> ${summary.totals.passed}</div>
        <div><strong>Failed:</strong> ${summary.totals.failed}</div>
      </div>
    </header>

    ${renderSummaryStatCards(summary)}
    ${renderAllIssuesSummarySection(summary.results)}
    ${renderSummaryModuleScoreCards(summary.results)}
    ${renderMetadataSummaryBox(summary.results)}
    ${renderBrokenLinksSummaryBox(summary.results)}

    <section class="summary-results-panel" id="results-table">
      <h2>All page results</h2>
      <div class="filters no-print">
        <button type="button" class="is-active" data-filter="ALL" onclick="filterRows('ALL', this)">All</button>
        <button type="button" data-filter="PASS" onclick="filterRows('PASS', this)">Pass</button>
        <button type="button" data-filter="FAIL" onclick="filterRows('FAIL', this)">Fail</button>
        <button type="button" data-filter="WARNING" onclick="filterRows('WARNING', this)">Warning</button>
        <button type="button" data-filter="SKIPPED" onclick="filterRows('SKIPPED', this)">Skipped</button>
      </div>
      <div class="summary-table-wrap">
        <table>
          <thead><tr>
            <th>Page name</th>
            <th>Path</th>
            <th>Browser</th>
            <th>Overall</th>
            ${moduleHeaders}
            <th>Fails</th>
            <th>Warnings</th>
            <th>Report</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  </div>
  <script>
    ${pageReportDashboardScript}
    function filterRows(status, button) {
      document.querySelectorAll('tbody tr').forEach((row) => {
        row.style.display = status === 'ALL' || row.dataset.status === status ? '' : 'none';
      });
      document.querySelectorAll('.filters button').forEach((btn) => {
        btn.classList.toggle('is-active', btn === button);
      });
    }
  </script>
</body>
</html>`;

  await writeText(path.join(config.reportsDir, "summary.html"), html);
}
