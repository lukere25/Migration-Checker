import { PageReport } from "./reportTypes";
import { escapeReportHtml } from "./pageReportLayout";

function metricRow(label: string, prodValue: string, devValue: string): string {
  return `<tr><td>${escapeReportHtml(label)}</td><td>${escapeReportHtml(prodValue)}</td><td>${escapeReportHtml(devValue)}</td></tr>`;
}

export function renderHTagHierarchyBody(report: PageReport): string {
  const details = report.categories.hTagHierarchy?.details as
    | { prodSequence?: string[]; devSequence?: string[] }
    | undefined;
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
