import {
  getStackSignals,
  StackSignal,
  TechStackData,
  TechStackModuleId
} from "../extractors/techStackExtractor";
import { normalizeText } from "../utils/normalize";
import { CategoryResult, Issue, statusFromIssues } from "../utils/status";

export interface StackComparisonRow {
  group?: string;
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

const DEV_TECH_GROUPS: Array<{ key: keyof Pick<TechStackData, "technologies" | "programmingLanguages" | "cmsPlatforms">; label: string }> =
  [
    { key: "technologies", label: "Frameworks & libraries" },
    { key: "programmingLanguages", label: "Programming languages" },
    { key: "cmsPlatforms", label: "CMS" }
  ];

function signalMap(signals: StackSignal[]): Map<string, StackSignal> {
  return new Map(signals.map((signal) => [normalizeText(signal.name), signal]));
}

function buildComparisonRows(
  prod: StackSignal[],
  dev: StackSignal[],
  group?: string
): StackComparisonRow[] {
  const prodMap = signalMap(prod);
  const devMap = signalMap(dev);
  const names = [...new Set([...prodMap.keys(), ...devMap.keys()])].sort();

  return names.map((name) => {
    const prodSignal = prodMap.get(name);
    const devSignal = devMap.get(name);
    const liveValue = prodSignal?.evidence || "";
    const migrationValue = devSignal?.evidence || "";

    if (!liveValue && !migrationValue) {
      return {
        group,
        name: prodSignal?.name || devSignal?.name || name,
        liveValue: "",
        migrationValue: "",
        status: "BOTH_EMPTY"
      };
    }
    if (!liveValue) {
      return {
        group,
        name: devSignal?.name || name,
        liveValue: "(empty)",
        migrationValue,
        status: "MISSING_LIVE"
      };
    }
    if (!migrationValue) {
      return {
        group,
        name: prodSignal?.name || name,
        liveValue,
        migrationValue: "(empty)",
        status: "MISSING_MIGRATION"
      };
    }
    if (normalizeText(liveValue) === normalizeText(migrationValue)) {
      return { group, name: prodSignal?.name || name, liveValue, migrationValue, status: "MATCH" };
    }
    return { group, name: prodSignal?.name || name, liveValue, migrationValue, status: "DIFFER" };
  });
}

function buildSignalIssues(
  category: string,
  prodSignals: StackSignal[],
  devSignals: StackSignal[],
  groupLabel: string
): Issue[] {
  const issues: Issue[] = [];
  const prodMap = signalMap(prodSignals);
  const devMap = signalMap(devSignals);
  const scopedCategory = `${category} (${groupLabel})`;

  if (prodSignals.length && !devSignals.length) {
    issues.push({
      severity: "FAIL",
      category: scopedCategory,
      source: "dev",
      message: `${groupLabel} signals missing on migration site`,
      prodValue: `${prodSignals.length} detected`,
      devValue: "0 detected"
    });
  }

  if (!prodSignals.length && devSignals.length) {
    issues.push({
      severity: "WARNING",
      category: scopedCategory,
      source: "comparison",
      message: `${groupLabel} detected on migration site but not on live site`,
      prodValue: "0 detected",
      devValue: `${devSignals.length} detected`
    });
  }

  for (const [key, prodSignal] of prodMap) {
    const devSignal = devMap.get(key);
    if (!devSignal) {
      issues.push({
        severity: "FAIL",
        category: scopedCategory,
        source: "dev",
        message: `Missing ${groupLabel.toLowerCase()} signal on migration site: ${prodSignal.name}`,
        prodValue: prodSignal.evidence,
        devValue: "(missing)"
      });
      continue;
    }

    if (normalizeText(prodSignal.evidence) !== normalizeText(devSignal.evidence)) {
      issues.push({
        severity: "WARNING",
        category: scopedCategory,
        source: "comparison",
        message: `${prodSignal.name} evidence differs between live and migration`,
        prodValue: prodSignal.evidence,
        devValue: devSignal.evidence
      });
    }
  }

  for (const [, devSignal] of devMap) {
    if (prodMap.has(normalizeText(devSignal.name))) continue;
    issues.push({
      severity: "WARNING",
      category: scopedCategory,
      source: "dev",
      message: `Extra ${groupLabel.toLowerCase()} signal on migration site: ${devSignal.name}`,
      devValue: devSignal.evidence
    });
  }

  return issues;
}

export function compareTechStackModule(
  moduleId: TechStackModuleId,
  prod: TechStackData,
  dev: TechStackData
): CategoryResult {
  const category = MODULE_LABELS[moduleId];
  const prodSignals = getStackSignals(prod, moduleId);
  const devSignals = getStackSignals(dev, moduleId);
  const comparisonRows = buildComparisonRows(prodSignals, devSignals);
  const issues = buildSignalIssues(category, prodSignals, devSignals, category);

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
  const category = MODULE_LABELS.devTechnologies;
  const issues: Issue[] = [];
  const groupedRows: Array<{ group: string; rows: StackComparisonRow[] }> = [];
  const comparisonRows: StackComparisonRow[] = [];
  const signals = {
    prod: [] as StackSignal[],
    dev: [] as StackSignal[]
  };

  for (const group of DEV_TECH_GROUPS) {
    const prodSignals = prod[group.key];
    const devSignals = dev[group.key];
    const rows = buildComparisonRows(prodSignals, devSignals, group.label).filter(
      (row) => row.status !== "BOTH_EMPTY"
    );

    groupedRows.push({ group: group.label, rows });
    comparisonRows.push(...rows);
    signals.prod.push(...prodSignals);
    signals.dev.push(...devSignals);
    issues.push(...buildSignalIssues(category, prodSignals, devSignals, group.label));
  }

  const result = statusFromIssues(issues, `${category} checks pass`, `${category} warnings`);
  return {
    ...result,
    details: {
      prod,
      dev,
      groupedRows,
      comparisonRows,
      signals
    }
  };
}

export function compareServerStack(prod: TechStackData, dev: TechStackData): CategoryResult {
  return compareTechStackModule("serverComparison", prod, dev);
}

export function getStackCheckItems(result: CategoryResult): Array<{ field: string; status: string; value?: string }> {
  const rows = (result.details as { comparisonRows?: StackComparisonRow[] } | undefined)?.comparisonRows ?? [];
  return rows
    .filter((row) => row.status !== "BOTH_EMPTY")
    .map((row) => ({
      field: row.group ? `${row.group}: ${row.name}` : row.name,
      status: row.status === "MATCH" ? "PASS" : row.status === "MISSING_MIGRATION" ? "FAIL" : "WARNING",
      value: row.migrationValue || row.liveValue
    }));
}
