import {
  getStackSignals,
  StackSignal,
  TechStackData,
  TechStackModuleId
} from "../extractors/techStackExtractor";
import { normalizeText } from "../utils/normalize";
import { CategoryResult, Issue, statusFromIssues } from "../utils/status";

export interface StackComparisonRow {
  name: string;
  liveValue: string;
  migrationValue: string;
  status: "MATCH" | "DIFFER" | "MISSING_LIVE" | "MISSING_MIGRATION" | "BOTH_EMPTY";
}

const MODULE_LABELS: Record<TechStackModuleId, string> = {
  devTechnologies: "Development technologies",
  programmingLanguages: "Programming languages",
  cms: "CMS",
  serverComparison: "Server comparison"
};

function signalMap(signals: StackSignal[]): Map<string, StackSignal> {
  return new Map(signals.map((signal) => [normalizeText(signal.name), signal]));
}

function buildComparisonRows(prod: StackSignal[], dev: StackSignal[]): StackComparisonRow[] {
  const prodMap = signalMap(prod);
  const devMap = signalMap(dev);
  const names = [...new Set([...prodMap.keys(), ...devMap.keys()])].sort();

  return names.map((name) => {
    const prodSignal = prodMap.get(name);
    const devSignal = devMap.get(name);
    const liveValue = prodSignal?.evidence || "";
    const migrationValue = devSignal?.evidence || "";

    if (!liveValue && !migrationValue) {
      return { name: prodSignal?.name || devSignal?.name || name, liveValue: "", migrationValue: "", status: "BOTH_EMPTY" };
    }
    if (!liveValue) {
      return {
        name: devSignal?.name || name,
        liveValue: "(empty)",
        migrationValue,
        status: "MISSING_LIVE"
      };
    }
    if (!migrationValue) {
      return {
        name: prodSignal?.name || name,
        liveValue,
        migrationValue: "(empty)",
        status: "MISSING_MIGRATION"
      };
    }
    if (normalizeText(liveValue) === normalizeText(migrationValue)) {
      return { name: prodSignal?.name || name, liveValue, migrationValue, status: "MATCH" };
    }
    return { name: prodSignal?.name || name, liveValue, migrationValue, status: "DIFFER" };
  });
}

export function compareTechStackModule(
  moduleId: TechStackModuleId,
  prod: TechStackData,
  dev: TechStackData
): CategoryResult {
  const category = MODULE_LABELS[moduleId];
  const issues: Issue[] = [];
  const prodSignals = getStackSignals(prod, moduleId);
  const devSignals = getStackSignals(dev, moduleId);
  const comparisonRows = buildComparisonRows(prodSignals, devSignals);
  const prodMap = signalMap(prodSignals);
  const devMap = signalMap(devSignals);

  if (prodSignals.length && !devSignals.length) {
    issues.push({
      severity: "FAIL",
      category,
      source: "dev",
      message: `${category} signals missing on migration site`,
      prodValue: `${prodSignals.length} detected`,
      devValue: "0 detected"
    });
  }

  if (!prodSignals.length && devSignals.length) {
    issues.push({
      severity: "WARNING",
      category,
      source: "comparison",
      message: `${category} detected on migration site but not on live site`,
      prodValue: "0 detected",
      devValue: `${devSignals.length} detected`
    });
  }

  for (const [name, prodSignal] of prodMap) {
    const devSignal = devMap.get(name);
    if (!devSignal) {
      issues.push({
        severity: "FAIL",
        category,
        source: "dev",
        message: `Missing ${category.toLowerCase()} signal on migration site: ${prodSignal.name}`,
        prodValue: prodSignal.evidence,
        devValue: "(missing)"
      });
      continue;
    }

    if (normalizeText(prodSignal.evidence) !== normalizeText(devSignal.evidence)) {
      issues.push({
        severity: "WARNING",
        category,
        source: "comparison",
        message: `${prodSignal.name} evidence differs between live and migration`,
        prodValue: prodSignal.evidence,
        devValue: devSignal.evidence
      });
    }
  }

  for (const [name, devSignal] of devMap) {
    if (prodMap.has(name)) continue;
    issues.push({
      severity: "WARNING",
      category,
      source: "dev",
      message: `Extra ${category.toLowerCase()} signal on migration site: ${devSignal.name}`,
      devValue: devSignal.evidence
    });
  }

  if (moduleId === "serverComparison") {
    const headerFields: Array<[string, string, string]> = [
      ["Server", prod.serverHeader, dev.serverHeader],
      ["X-Powered-By", prod.poweredBy, dev.poweredBy],
      ["Platform", prod.platform, dev.platform],
      ["Via", prod.via, dev.via],
      ["Content-Type", prod.contentType, dev.contentType]
    ];

    for (const [label, liveValue, migrationValue] of headerFields) {
      if (!liveValue && !migrationValue) continue;
      if (liveValue && !migrationValue) {
        issues.push({
          severity: "WARNING",
          category,
          source: "dev",
          message: `${label} header missing on migration site`,
          prodValue: liveValue,
          devValue: "(missing)"
        });
      } else if (liveValue && migrationValue && normalizeText(liveValue) !== normalizeText(migrationValue)) {
        issues.push({
          severity: "WARNING",
          category,
          source: "comparison",
          message: `${label} header differs between live and migration`,
          prodValue: liveValue,
          devValue: migrationValue
        });
      }
    }
  }

  const result = statusFromIssues(issues, `${category} checks pass`, `${category} warnings`);
  return {
    ...result,
    details: {
      prod,
      dev,
      comparisonRows,
      signals: { prod: prodSignals, dev: devSignals }
    }
  };
}

export function compareDevTechnologies(prod: TechStackData, dev: TechStackData): CategoryResult {
  return compareTechStackModule("devTechnologies", prod, dev);
}

export function compareProgrammingLanguages(prod: TechStackData, dev: TechStackData): CategoryResult {
  return compareTechStackModule("programmingLanguages", prod, dev);
}

export function compareCms(prod: TechStackData, dev: TechStackData): CategoryResult {
  return compareTechStackModule("cms", prod, dev);
}

export function compareServerStack(prod: TechStackData, dev: TechStackData): CategoryResult {
  return compareTechStackModule("serverComparison", prod, dev);
}

export function getStackCheckItems(result: CategoryResult): Array<{ field: string; status: string; value?: string }> {
  const rows = (result.details as { comparisonRows?: StackComparisonRow[] } | undefined)?.comparisonRows ?? [];
  return rows
    .filter((row) => row.status !== "BOTH_EMPTY")
    .map((row) => ({
      field: row.name,
      status: row.status === "MATCH" ? "PASS" : row.status === "MISSING_MIGRATION" ? "FAIL" : "WARNING",
      value: row.migrationValue || row.liveValue
    }));
}
