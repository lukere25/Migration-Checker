import { COMPARISON_MODULES } from "../comparisonModules";
import { getMetadataCheckItems } from "../comparators/metadataComparator";
import { CategoryResult, Status } from "../utils/status";
import { PageReport } from "./reportTypes";
import { escapeReportHtml, statusClass } from "./pageReportLayout";

const MODULE_ANCHORS: Record<string, string> = {
  metadata: "all-meta-tags-comparison",
  visual: "visual-comparison",
  hTagHierarchy: "h-tag-hierarchy",
  textStyle: "text-style-match",
  pageSpeed: "page-speed-match",
  brokenLinks: "all-issues",
  headings: "all-issues",
  content: "all-issues",
  images: "all-issues",
  language: "all-issues"
};

export function computeModulePassPercent(moduleId: string, result: CategoryResult): number | null {
  if (result.status === "SKIPPED") return null;

  switch (moduleId) {
    case "metadata": {
      const items = getMetadataCheckItems(result);
      if (items.length) {
        const passed = items.filter((item) => item.status === "PASS").length;
        return Math.round((passed / items.length) * 100);
      }
      break;
    }
    case "visual": {
      const mismatch = (result.details as { mismatchPercent?: number } | undefined)?.mismatchPercent;
      if (typeof mismatch === "number") {
        return Math.round(Math.max(0, Math.min(100, 100 - mismatch)));
      }
      break;
    }
    case "content": {
      const similarity = (result.details as { similarity?: number } | undefined)?.similarity;
      if (typeof similarity === "number") {
        return Math.round(Math.max(0, Math.min(100, similarity * 100)));
      }
      break;
    }
    case "pageSpeed": {
      const details = result.details as
        | { prod?: { loadMs?: number }; dev?: { loadMs?: number } }
        | undefined;
      if (details?.prod?.loadMs != null && details?.dev?.loadMs != null) {
        const delta = Math.abs(details.prod.loadMs - details.dev.loadMs);
        const max = Math.max(details.prod.loadMs, details.dev.loadMs, 1);
        return Math.round(Math.max(0, Math.min(100, 100 - (delta / max) * 100)));
      }
      break;
    }
    default:
      break;
  }

  const failCount = result.issues.filter((issue) => issue.severity === "FAIL").length;
  const warnCount = result.issues.filter((issue) => issue.severity === "WARNING").length;

  if (result.status === "PASS") return 100;
  if (result.status === "FAIL") {
    if (failCount + warnCount > 0) {
      return Math.max(0, 100 - failCount * 20 - warnCount * 8);
    }
    return 0;
  }
  if (result.status === "WARNING") {
    if (failCount + warnCount > 0) {
      return Math.max(35, 100 - failCount * 20 - warnCount * 10);
    }
    return 75;
  }

  return null;
}

function ringColor(percent: number | null): string {
  if (percent == null) return "var(--muted)";
  if (percent >= 90) return "#22c55e";
  if (percent >= 70) return "#f59e0b";
  return "#ef4444";
}

function renderScoreRing(percent: number | null, label: string): string {
  if (percent == null) {
    return `<div class="module-score-ring is-skipped" aria-label="${escapeReportHtml(label)} skipped">
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <circle class="module-score-ring-bg" cx="22" cy="22" r="18"></circle>
      </svg>
      <span class="module-score-value">—</span>
    </div>`;
  }

  const dash = Math.max(0, Math.min(100, percent));
  const color = ringColor(percent);

  return `<div class="module-score-ring" aria-label="${escapeReportHtml(label)} ${dash}% pass">
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <circle class="module-score-ring-bg" cx="22" cy="22" r="18"></circle>
        <circle
          class="module-score-ring-fill"
          cx="22"
          cy="22"
          r="18"
          pathLength="100"
          stroke-dasharray="${dash} 100"
          style="stroke: ${color}"
        ></circle>
      </svg>
      <span class="module-score-value">${dash}%</span>
    </div>`;
}

function isReportModuleEnabled(report: PageReport, moduleId: string): boolean {
  if (!report.enabledModules?.length) return true;
  return report.enabledModules.includes(moduleId);
}

export const moduleScoreCardsCss = `
  .module-score-cards {
    margin: 0 0 28px;
  }

  .module-score-scroll {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 4px;
  }

  .module-score-cards-title {
    margin: 0 0 14px;
    font-size: 1rem;
    font-weight: 700;
    color: var(--text);
  }

  .module-score-grid {
    display: flex;
    flex-wrap: nowrap;
    gap: 10px;
    min-width: 100%;
  }

  .module-score-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    flex: 1 1 0;
    min-width: 96px;
    padding: 12px 8px 10px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--panel);
    text-decoration: none;
    color: inherit;
    transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s;
  }

  a.module-score-card:hover {
    border-color: var(--accent);
    box-shadow: var(--shadow);
    transform: translateY(-1px);
  }

  .module-score-ring {
    position: relative;
    width: 60px;
    height: 60px;
  }

  .module-score-ring svg {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }

  .module-score-ring-bg {
    fill: none;
    stroke: var(--border);
    stroke-width: 4;
  }

  .module-score-ring-fill {
    fill: none;
    stroke-width: 4;
    stroke-linecap: round;
    transition: stroke-dasharray 0.35s ease;
  }

  .module-score-ring.is-skipped .module-score-ring-bg {
    stroke-dasharray: 4 6;
  }

  .module-score-value {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: var(--text);
  }

  .module-score-ring.is-skipped .module-score-value {
    color: var(--muted);
    font-size: 18px;
  }

  .module-score-label {
    font-size: 10px;
    font-weight: 700;
    text-align: center;
    line-height: 1.2;
    color: var(--text);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    word-break: break-word;
  }

  .module-score-card .pill {
    font-size: 10px;
    padding: 2px 8px;
  }

  .module-score-meta {
    font-size: 10px;
    color: var(--muted);
    text-align: center;
  }

  @media (max-width: 1200px) {
    .module-score-grid {
      min-width: 960px;
    }
  }
`;

export function renderModuleScoreCards(report: PageReport): string {
  const cards = COMPARISON_MODULES.filter((module) => {
    if (!isReportModuleEnabled(report, module.id)) return false;
    return Boolean(report.categories[module.id]);
  }).map((module) => {
    const result = report.categories[module.id]!;
    const percent = computeModulePassPercent(module.id, result);
    const anchor = MODULE_ANCHORS[module.id];
    const tag = anchor ? "a" : "div";
    const href = anchor ? ` href="#${escapeReportHtml(anchor)}"` : "";

    return `<${tag} class="module-score-card"${href}>
      ${renderScoreRing(percent, module.label)}
      <span class="module-score-label">${escapeReportHtml(module.label)}</span>
      <span class="pill ${statusClass(result.status)}">${escapeReportHtml(result.status)}</span>
    </${tag}>`;
  });

  if (!cards.length) {
    return "";
  }

  return `<section class="module-score-cards" aria-label="Module pass scores">
    <h2 class="module-score-cards-title">Module results</h2>
    <div class="module-score-scroll">
      <div class="module-score-grid">${cards.join("")}</div>
    </div>
  </section>`;
}

function aggregateModuleStatus(statuses: Status[]): Status {
  if (!statuses.length) return "SKIPPED";
  if (statuses.includes("FAIL")) return "FAIL";
  if (statuses.includes("WARNING")) return "WARNING";
  if (statuses.every((status) => status === "SKIPPED")) return "SKIPPED";
  return "PASS";
}

export function renderSummaryModuleScoreCards(results: PageReport[]): string {
  const cards = COMPARISON_MODULES.map((module) => {
    const samples = results
      .filter((report) => report.categories[module.id] && isReportModuleEnabled(report, module.id))
      .map((report) => ({
        result: report.categories[module.id]!,
        percent: computeModulePassPercent(module.id, report.categories[module.id]!)
      }));

    if (!samples.length) return "";

    const percents = samples.map((sample) => sample.percent).filter((value): value is number => value != null);
    const avgPercent = percents.length
      ? Math.round(percents.reduce((sum, value) => sum + value, 0) / percents.length)
      : null;
    const status = aggregateModuleStatus(samples.map((sample) => sample.result.status));
    const anchor = module.id === "metadata" ? "metadata-summary" : module.id === "brokenLinks" ? "broken-links-summary" : "results-table";
    const pageLabel = `${samples.length} page${samples.length === 1 ? "" : "s"}`;

    return `<a class="module-score-card" href="#${escapeReportHtml(anchor)}">
      ${renderScoreRing(avgPercent, module.label)}
      <span class="module-score-label">${escapeReportHtml(module.label)}</span>
      <span class="module-score-meta">${escapeReportHtml(pageLabel)}</span>
      <span class="pill ${statusClass(status)}">${escapeReportHtml(status)}</span>
    </a>`;
  }).filter(Boolean);

  if (!cards.length) return "";

  return `<section class="module-score-cards" aria-label="Module pass scores across all pages">
    <h2 class="module-score-cards-title">Module results</h2>
    <div class="module-score-scroll">
      <div class="module-score-grid">${cards.join("")}</div>
    </div>
  </section>`;
}
