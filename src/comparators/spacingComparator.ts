import path from "path";
import { gapColorAt, ModuleGap, ModuleSection, ModuleSpacingData } from "../extractors/spacingExtractor";
import { CategoryResult, Issue, statusFromIssues } from "../utils/status";

export interface SpacingComparisonRow {
  gapLabel: string;
  scope: "between-sections" | "inside-section";
  liveGapPx: string;
  migrationGapPx: string;
  deltaPx: string;
  color: string;
  colorName: string;
  status: "MATCH" | "DIFFER" | "MISSING_LIVE" | "MISSING_MIGRATION";
}

export interface SectionHeightComparisonRow {
  sectionLabel: string;
  liveHeightPx: string;
  migrationHeightPx: string;
  deltaPx: string;
  status: "MATCH" | "DIFFER" | "MISSING_LIVE" | "MISSING_MIGRATION";
}

const WARNING_DELTA_PX = 8;
const FAIL_DELTA_PX = 20;

function sectionLabelAt(section: ModuleSection | undefined, index: number): string {
  if (!section) return `Section ${index + 1}`;
  return section.label || `Section ${index + 1}`;
}

function heightDeltaSeverity(delta: number): "INFO" | "WARNING" | "FAIL" | null {
  if (delta === 0) return null;
  if (delta >= FAIL_DELTA_PX) return "FAIL";
  if (delta >= WARNING_DELTA_PX) return "WARNING";
  return "INFO";
}

function buildSectionHeightRows(prod: ModuleSpacingData, dev: ModuleSpacingData): SectionHeightComparisonRow[] {
  const count = Math.max(prod.sections.length, dev.sections.length);
  const rows: SectionHeightComparisonRow[] = [];

  for (let index = 0; index < count; index += 1) {
    const prodSection = prod.sections[index];
    const devSection = dev.sections[index];
    const label = sectionLabelAt(prodSection || devSection, index);

    if (!prodSection && devSection) {
      rows.push({
        sectionLabel: label,
        liveHeightPx: "(none)",
        migrationHeightPx: `${devSection.height}px`,
        deltaPx: "—",
        status: "MISSING_LIVE"
      });
      continue;
    }

    if (prodSection && !devSection) {
      rows.push({
        sectionLabel: label,
        liveHeightPx: `${prodSection.height}px`,
        migrationHeightPx: "(none)",
        deltaPx: "—",
        status: "MISSING_MIGRATION"
      });
      continue;
    }

    if (!prodSection || !devSection) continue;

    const delta = Math.abs(prodSection.height - devSection.height);
    rows.push({
      sectionLabel: label,
      liveHeightPx: `${prodSection.height}px`,
      migrationHeightPx: `${devSection.height}px`,
      deltaPx: `${delta}px`,
      status: delta === 0 ? "MATCH" : "DIFFER"
    });
  }

  return rows;
}

function gapLabel(gap: ModuleGap | undefined, index: number): string {
  if (!gap) return `Gap ${index + 1}`;
  const path =
    gap.scope === "inside-section" && gap.parentSectionLabel
      ? `${gap.parentSectionLabel}: ${gap.fromLabel} → ${gap.toLabel}`
      : `${gap.fromLabel} → ${gap.toLabel}`;
  return path;
}

function buildRows(prod: ModuleSpacingData, dev: ModuleSpacingData): SpacingComparisonRow[] {
  const count = Math.max(prod.gaps.length, dev.gaps.length);
  const rows: SpacingComparisonRow[] = [];

  for (let index = 0; index < count; index += 1) {
    const prodGap = prod.gaps[index];
    const devGap = dev.gaps[index];
    const label = gapLabel(prodGap || devGap, index);
    const scope = prodGap?.scope || devGap?.scope || "between-sections";

    if (!prodGap && devGap) {
      const color = gapColorAt(index);
      rows.push({
        gapLabel: label,
        scope,
        liveGapPx: "(none)",
        migrationGapPx: `${devGap.gapPx}px`,
        deltaPx: "—",
        color: color.border,
        colorName: color.name,
        status: "MISSING_LIVE"
      });
      continue;
    }
    if (prodGap && !devGap) {
      const color = gapColorAt(index);
      rows.push({
        gapLabel: label,
        scope,
        liveGapPx: `${prodGap.gapPx}px`,
        migrationGapPx: "(none)",
        deltaPx: "—",
        color: color.border,
        colorName: color.name,
        status: "MISSING_MIGRATION"
      });
      continue;
    }
    if (!prodGap || !devGap) continue;

    const delta = Math.abs(prodGap.gapPx - devGap.gapPx);
    const color = gapColorAt(index);
    rows.push({
      gapLabel: label,
      scope,
      liveGapPx: `${prodGap.gapPx}px`,
      migrationGapPx: `${devGap.gapPx}px`,
      deltaPx: `${delta}px`,
      color: color.border,
      colorName: color.name,
      status: delta === 0 ? "MATCH" : "DIFFER"
    });
  }

  return rows;
}

function sectionSummary(sections: ModuleSection[]): string {
  if (!sections.length) return "0 sections";
  return `${sections.length} sections`;
}

export function compareModuleSpacing(prod: ModuleSpacingData, dev: ModuleSpacingData): CategoryResult {
  const issues: Issue[] = [];
  const comparisonRows = buildRows(prod, dev);
  const sectionHeightRows = buildSectionHeightRows(prod, dev);
  const pairCount = Math.max(prod.gaps.length, dev.gaps.length);
  const sectionCount = Math.max(prod.sections.length, dev.sections.length);

  if (prod.sections.length && !dev.sections.length) {
    issues.push({
      severity: "FAIL",
      category: "Module spacing",
      source: "dev",
      message: "Migration page has no detectable content modules/sections",
      prodValue: sectionSummary(prod.sections),
      devValue: "0 sections"
    });
  }

  if (prod.gaps.length && !dev.gaps.length) {
    issues.push({
      severity: "FAIL",
      category: "Module spacing",
      source: "dev",
      message: "Migration page has no measurable gaps between modules",
      prodValue: `${prod.gaps.length} gaps`,
      devValue: "0 gaps"
    });
  }

  if (prod.sections.length !== dev.sections.length) {
    issues.push({
      severity: "WARNING",
      category: "Module spacing",
      source: "comparison",
      message: "Module/section count differs between live and migration",
      prodValue: sectionSummary(prod.sections),
      devValue: sectionSummary(dev.sections)
    });
  }

  for (let index = 0; index < pairCount; index += 1) {
    const prodGap = prod.gaps[index];
    const devGap = dev.gaps[index];
    const label = gapLabel(prodGap || devGap, index);

    if (prodGap && !devGap) {
      issues.push({
        severity: "FAIL",
        category: "Module spacing",
        source: "dev",
        message: `Missing spacing gap on migration: ${label}`,
        prodValue: `${prodGap.gapPx}px`,
        devValue: "(missing)"
      });
      continue;
    }

    if (!prodGap || !devGap) continue;

    const delta = Math.abs(prodGap.gapPx - devGap.gapPx);
    if (delta === 0) continue;

    const severity = delta >= FAIL_DELTA_PX ? "FAIL" : delta >= WARNING_DELTA_PX ? "WARNING" : "INFO";
    if (severity === "INFO") continue;

    issues.push({
      severity,
      category: "Module spacing",
      source: "comparison",
      message: `Spacing between modules differs: ${label}`,
      prodValue: `${prodGap.gapPx}px`,
      devValue: `${devGap.gapPx}px`
    });
  }

  for (let index = 0; index < sectionCount; index += 1) {
    const prodSection = prod.sections[index];
    const devSection = dev.sections[index];
    const label = sectionLabelAt(prodSection || devSection, index);

    if (prodSection && !devSection) {
      issues.push({
        severity: "FAIL",
        category: "Module spacing",
        source: "dev",
        message: `Missing section on migration: ${label}`,
        prodValue: `${prodSection.height}px`,
        devValue: "(missing)"
      });
      continue;
    }

    if (!prodSection && devSection) {
      issues.push({
        severity: "WARNING",
        category: "Module spacing",
        source: "dev",
        message: `Extra section on migration: ${label}`,
        prodValue: "(none)",
        devValue: `${devSection.height}px`
      });
      continue;
    }

    if (!prodSection || !devSection) continue;

    const delta = Math.abs(prodSection.height - devSection.height);
    const severity = heightDeltaSeverity(delta);
    if (!severity || severity === "INFO") continue;

    issues.push({
      severity,
      category: "Module spacing",
      source: "comparison",
      message: `Section height differs: ${label}`,
      prodValue: `${prodSection.height}px`,
      devValue: `${devSection.height}px`
    });
  }

  const result = statusFromIssues(issues, "Module spacing matches", "Module spacing warnings");
  return {
    ...result,
    details: {
      prod,
      dev,
      comparisonRows,
      sectionHeightRows,
      screenshotDir: prod.gaps.find((gap) => gap.prodScreenshot)?.prodScreenshot
        ? path.dirname(prod.gaps[0].prodScreenshot!)
        : ""
    }
  };
}

export function getSpacingCheckItems(result: CategoryResult): Array<{ field: string; status: string; value?: string }> {
  const details = result.details as
    | { comparisonRows?: SpacingComparisonRow[]; sectionHeightRows?: SectionHeightComparisonRow[] }
    | undefined;

  const gapItems = (details?.comparisonRows ?? []).map((row) => ({
    field: `Gap: ${row.gapLabel}`,
    status: row.status === "MATCH" ? "PASS" : row.status === "MISSING_MIGRATION" ? "FAIL" : "WARNING",
    value: row.migrationGapPx
  }));

  const heightItems = (details?.sectionHeightRows ?? []).map((row) => ({
    field: `Height: ${row.sectionLabel}`,
    status: row.status === "MATCH" ? "PASS" : row.status === "MISSING_MIGRATION" ? "FAIL" : "WARNING",
    value: row.migrationHeightPx
  }));

  return [...heightItems, ...gapItems];
}
