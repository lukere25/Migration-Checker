import path from "path";
import { config } from "../config";
import { writeText } from "../utils/fileUtils";
import { Issue } from "../utils/status";
import { PageReport, SummaryReport } from "./reportTypes";
import { buildBrokenLinksSummary, buildMetadataSummary } from "./reportSummaries";
import { allMetaComparisonComponentCss, renderAllMetaTagsComparisonBody } from "./allMetaComparisonComponent";
import {
  renderHTagHierarchyBody,
  renderPageSpeedBody,
  renderTextStyleBody
} from "./moduleReportPanels";
import {
  escapeReportHtml,
  pageReportDashboardCss,
  pageReportDashboardScript,
  renderAccordion,
  statusClass
} from "./pageReportLayout";

function issueRows(issues: Issue[]): string {
  if (!issues.length) return '<tr><td colspan="5">No issues found.</td></tr>';
  return issues
    .map(
      (issue) => `<tr>
        <td><span class="pill ${issue.severity.toLowerCase()}">${issue.severity}</span></td>
        <td>${escapeReportHtml(issue.category)}</td>
        <td>${escapeReportHtml(issue.message)}${issue.url ? `<br><small>${escapeReportHtml(issue.url)}</small>` : ""}</td>
        <td>${escapeReportHtml(issue.prodValue || "")}</td>
        <td>${escapeReportHtml(issue.devValue || "")}</td>
      </tr>`
    )
    .join("");
}

const summaryCss = `
  body { font-family: Arial, sans-serif; margin: 24px; color: #1f2933; }
  a { color: #0067c5; }
  .pill { border-radius: 999px; padding: 3px 9px; color: #fff; font-size: 12px; font-weight: 700; }
  .pass { background: #18794e; } .fail { background: #c92a2a; } .warning { background: #b7791f; } .skipped, .info { background: #62748e; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 20px 0; }
  .card { border: 1px solid #d9e2ec; border-radius: 8px; padding: 12px; background: #f8fafc; }
  table { border-collapse: collapse; width: 100%; margin-top: 16px; }
  th, td { border: 1px solid #d9e2ec; padding: 8px; vertical-align: top; text-align: left; }
  th { background: #eef2f7; }
  .filters button { margin-right: 8px; padding: 6px 10px; }
  .summary-box { border: 1px solid #d9e2ec; border-radius: 10px; padding: 16px 18px; margin: 24px 0; background: #f8fafc; }
  .summary-box h2 { margin: 0 0 8px; font-size: 1.15rem; }
  .summary-box .scope { color: #62748e; font-size: 14px; margin: 0 0 12px; }
  .summary-box ul { margin: 8px 0 12px 18px; color: #334e68; font-size: 14px; }
  .summary-stats { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
  .summary-stats span { background: #fff; border: 1px solid #d9e2ec; border-radius: 6px; padding: 6px 10px; font-size: 13px; }
`;

const pageReportCss = `
  ${pageReportDashboardCss}
  ${allMetaComparisonComponentCss}
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
  if (!rows.length) return `<tr><td colspan="6">${escapeReportHtml(emptyMessage)}</td></tr>`;
  return rows
    .map(
      (row) => `<tr>
        <td>${escapeReportHtml(row.pageName)}</td>
        <td>${escapeReportHtml(row.browserName)}</td>
        <td><span class="pill ${row.severity.toLowerCase()}">${row.severity}</span></td>
        <td>${escapeReportHtml(row.field || "")}</td>
        <td>${escapeReportHtml(row.message)}${row.url ? `<br><small>${escapeReportHtml(row.url)}</small>` : ""}</td>
        <td>${escapeReportHtml(row.devValue || row.prodValue || "")}</td>
      </tr>`
    )
    .join("");
}

function renderMetadataSummaryBox(results: PageReport[]): string {
  const summary = buildMetadataSummary(results);
  return `<section class="summary-box" id="metadata-summary">
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
      <thead><tr><th>Page</th><th>Browser</th><th>Severity</th><th>Field</th><th>Message</th><th>Migration value</th></tr></thead>
      <tbody>${summaryTableRows(summary.rows, "All metadata checks passed on migration pages.")}</tbody>
    </table>
  </section>`;
}

function renderBrokenLinksSummaryBox(results: PageReport[]): string {
  const summary = buildBrokenLinksSummary(results);
  return `<section class="summary-box" id="broken-links-summary">
    <h2>Broken links summary</h2>
    <p class="scope">HTTP status checks on internal links found on each page (live and migration sites).</p>
    <div class="summary-stats">
      <span><strong>Broken (4xx/5xx):</strong> ${summary.totals.broken}</span>
      <span><strong>Redirects:</strong> ${summary.totals.redirect}</span>
      <span><strong>Other:</strong> ${summary.totals.other}</span>
      <span><strong>Total issues:</strong> ${summary.issueCount}</span>
    </div>
    <table>
      <thead><tr><th>Page</th><th>Browser</th><th>Severity</th><th>Type</th><th>Message</th><th>URL</th></tr></thead>
      <tbody>${summary.rows.length ? summary.rows.map((row) => `<tr>
        <td>${escapeReportHtml(row.pageName)}</td>
        <td>${escapeReportHtml(row.browserName)}</td>
        <td><span class="pill ${row.severity.toLowerCase()}">${row.severity}</span></td>
        <td>${escapeReportHtml(row.field || "")}</td>
        <td>${escapeReportHtml(row.message)}</td>
        <td>${row.url ? `<a href="${escapeReportHtml(row.url)}">${escapeReportHtml(row.url)}</a>` : ""}</td>
      </tr>`).join("") : `<tr><td colspan="6">No broken links detected.</td></tr>`}</tbody>
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
  if (!report.enabledModules?.length) return true;
  return report.enabledModules.includes(moduleId);
}

function renderCategoryCardsBody(report: PageReport): string {
  const cards = Object.entries(report.categories)
    .filter(([moduleId]) => isReportModuleEnabled(report, moduleId))
    .map(
      ([name, result]) =>
        `<div class="card"><strong>${escapeReportHtml(name)}</strong><br><span class="pill ${statusClass(result.status)}">${result.status}</span><p>${escapeReportHtml(result.summary)}</p></div>`
    )
    .join("");

  if (!cards) {
    return `<p class="panel-subtitle">No module results were included in this run.</p>`;
  }

  return `<div class="cards">${cards}</div>`;
}

function renderIssuesBody(report: PageReport): string {
  return `<table>
    <thead><tr><th>Severity</th><th>Category</th><th>Message</th><th>Prod value</th><th>Dev value</th></tr></thead>
    <tbody>${issueRows(report.issues)}</tbody>
  </table>`;
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

  if (isReportModuleEnabled(report, "metadata")) {
    parts.push(
      renderAccordion({
        id: "all-meta-tags-comparison",
        title: "All meta tags comparison",
        subtitle: "Live vs migration meta tags",
        status: report.categories.metadata?.status || "PASS",
        open: true,
        body: renderAllMetaTagsComparisonBody(report)
      })
    );
  }

  if (isReportModuleEnabled(report, "visual")) {
    parts.push(
      renderAccordion({
        id: "visual-comparison",
        title: "Visual comparison",
        subtitle: "Production, migration, and pixel diff",
        status: report.categories.visual?.status || "PASS",
        open: true,
        body: renderVisualComparisonBody(report)
      })
    );
  }

  if (isReportModuleEnabled(report, "hTagHierarchy")) {
    parts.push(
      renderAccordion({
        id: "h-tag-hierarchy",
        title: "H tag hierarchy",
        subtitle: "Heading order and skipped levels",
        status: report.categories.hTagHierarchy?.status || "PASS",
        open: false,
        body: renderHTagHierarchyBody(report)
      })
    );
  }

  if (isReportModuleEnabled(report, "textStyle")) {
    parts.push(
      renderAccordion({
        id: "text-style-match",
        title: "Text style match",
        subtitle: "Computed typography comparison",
        status: report.categories.textStyle?.status || "PASS",
        open: false,
        body: renderTextStyleBody(report)
      })
    );
  }

  if (isReportModuleEnabled(report, "pageSpeed")) {
    parts.push(
      renderAccordion({
        id: "page-speed-match",
        title: "Page speed match",
        subtitle: "Load timing comparison",
        status: report.categories.pageSpeed?.status || "PASS",
        open: false,
        body: renderPageSpeedBody(report)
      })
    );
  }

  const enabledCategoryCount = Object.keys(report.categories).filter((moduleId) =>
    isReportModuleEnabled(report, moduleId)
  ).length;

  if (enabledCategoryCount) {
    parts.push(
      renderAccordion({
        id: "category-results",
        title: "Category results",
        subtitle: "Status by enabled comparison module",
        status: report.overallStatus,
        open: false,
        body: renderCategoryCardsBody(report)
      })
    );
  }

  if (report.issues.length) {
    parts.push(
      renderAccordion({
        id: "all-issues",
        title: "Issues",
        subtitle: `${report.issues.length} issue(s) recorded`,
        status: report.blockingIssues.length ? "FAIL" : report.warnings.length ? "WARNING" : "PASS",
        open: false,
        body: renderIssuesBody(report)
      })
    );
  }

  return `<div class="report-accordions">${parts.join("")}</div>`;
}

export async function writePageHtml(report: PageReport): Promise<void> {
  const html = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeReportHtml(report.pageName)} - ${escapeReportHtml(report.browserName)}</title>
  <style>${pageReportCss}</style>
</head>
<body>
  <div class="report-shell">
    <div class="report-topbar no-print">
      <span class="accordion-subtitle">Migration comparison report</span>
      <button type="button" class="theme-toggle" id="theme-toggle" aria-label="Toggle color theme">Dark mode</button>
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
    ${renderPageAccordions(report)}
  </div>
  <script>${pageReportDashboardScript}</script>
</body>
</html>`;

  await writeText(report.reportPaths.html, html);
}

export async function writeSummaryHtml(summary: SummaryReport): Promise<void> {
  const rows = summary.results
    .map((report) => {
      const reportLink = path.relative(config.reportsDir, report.reportPaths.html).replace(/\\/g, "/");
      const pdfLink = report.reportPaths.pdf
        ? path.relative(config.reportsDir, report.reportPaths.pdf).replace(/\\/g, "/")
        : reportLink.replace(/index\.html$/, "index.pdf");
      return `<tr data-status="${report.overallStatus}">
        <td>${escapeReportHtml(report.pageName)}</td>
        <td>${escapeReportHtml(report.browserName)}</td>
        <td><span class="pill ${statusClass(report.overallStatus)}">${report.overallStatus}</span></td>
        <td>${escapeReportHtml(report.categories.metadata?.status)}</td>
        <td>${escapeReportHtml(report.categories.brokenLinks?.status)}</td>
        <td>${escapeReportHtml(report.categories.headings?.status)}</td>
        <td>${escapeReportHtml(report.categories.content?.status)}</td>
        <td>${escapeReportHtml(report.categories.images?.status)}</td>
        <td>${escapeReportHtml(report.categories.links?.status)}</td>
        <td>${escapeReportHtml(report.categories.navigation?.status)}</td>
        <td>${escapeReportHtml(report.categories.footer?.status)}</td>
        <td>${escapeReportHtml(report.categories.language?.status)}</td>
        <td>${escapeReportHtml(report.categories.console?.status)}</td>
        <td>${escapeReportHtml(report.categories.network?.status)}</td>
        <td>${escapeReportHtml(report.categories.visual?.status)}</td>
        <td>${report.blockingIssues.length}</td>
        <td>${report.warnings.length}</td>
        <td><a href="${escapeReportHtml(reportLink)}#visual-comparison">HTML</a> · <a href="${escapeReportHtml(pdfLink)}" download>PDF</a></td>
      </tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>NetApp Migration Summary</title><style>${summaryCss}</style></head>
<body>
  <h1>NetApp Migration Summary</h1>
  <p>Generated ${escapeReportHtml(summary.generatedAt)}</p>
  <div class="cards">
    <div class="card"><strong>Total pages</strong><br>${summary.totals.totalPages}</div>
    <div class="card"><strong>Total browser runs</strong><br>${summary.totals.totalBrowserRuns}</div>
    <div class="card"><strong>Passed</strong><br>${summary.totals.passed}</div>
    <div class="card"><strong>Failed</strong><br>${summary.totals.failed}</div>
    <div class="card"><strong>Warning</strong><br>${summary.totals.warning}</div>
    <div class="card"><strong>Skipped</strong><br>${summary.totals.skipped}</div>
  </div>
  ${renderMetadataSummaryBox(summary.results)}
  ${renderBrokenLinksSummaryBox(summary.results)}
  <div class="filters">
    <button onclick="filterRows('ALL')">All</button>
    <button onclick="filterRows('PASS')">Pass</button>
    <button onclick="filterRows('FAIL')">Fail</button>
    <button onclick="filterRows('WARNING')">Warning</button>
    <button onclick="filterRows('SKIPPED')">Skipped</button>
  </div>
  <table><thead><tr>
    <th>Page name</th><th>Browser/device</th><th>Overall</th><th>Metadata</th><th>Broken links</th><th>Headings</th><th>Content</th><th>Images</th><th>Links</th><th>Navigation</th><th>Footer</th><th>Language</th><th>Console</th><th>Network</th><th>Visual</th><th>Fails</th><th>Warnings</th><th>Report / PDF</th>
  </tr></thead><tbody>${rows}</tbody></table>
  <script>
    function filterRows(status) {
      document.querySelectorAll('tbody tr').forEach((row) => {
        row.style.display = status === 'ALL' || row.dataset.status === status ? '' : 'none';
      });
    }
  </script>
</body>
</html>`;

  await writeText(path.join(config.reportsDir, "summary.html"), html);
}
