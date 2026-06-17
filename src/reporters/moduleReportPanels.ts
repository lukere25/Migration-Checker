import { Heading } from "../extractors/headingExtractor";
import { CategoryResult, Issue } from "../utils/status";
import { PageReport } from "./reportTypes";
import { headingTreeCss, renderHeadingTree } from "./headingTreeView";
import { escapeReportHtml, statusClass } from "./pageReportLayout";

export { headingTreeCss };

function renderIssuesTable(issues: Issue[], emptyMessage = "No issues found."): string {
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
      </tr>`
    )
    .join("");

  return `<table>
    <thead><tr><th>Severity</th><th>Message</th><th>Live value</th><th>Migration value</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
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
    ${renderIssuesTable(result?.issues ?? [], "No heading issues recorded.")}`;
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
    ${renderIssuesTable(result?.issues ?? [], "No language issues recorded.")}`;
}

export function renderBrokenLinksBody(report: PageReport): string {
  const result = report.categories.brokenLinks;
  return `${renderCategoryIntro(result, "HTTP status checks on internal links found on live and migration pages.")}
    ${renderIssuesTable(result?.issues ?? [], "No broken links detected.")}`;
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
    ${renderIssuesTable(result?.issues ?? [], "No content issues recorded.")}`;
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
    ${renderIssuesTable(result?.issues ?? [], "No image issues recorded.")}`;
}
