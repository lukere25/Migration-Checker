import { SchemaData, SchemaItem } from "../extractors/schemaExtractor";
import { normalizeText, normalizeWhitespace } from "../utils/normalize";
import { CategoryResult, Issue, statusFromIssues } from "../utils/status";

export type SchemaCheckStatus = "PASS" | "FAIL" | "WARNING";

export interface SchemaCheckItem {
  field: string;
  status: SchemaCheckStatus;
  value?: string;
  message: string;
}

export type SchemaCompareStatus = "MATCH" | "DIFFER" | "MISSING_LIVE" | "MISSING_MIGRATION" | "BOTH_EMPTY";

export interface SchemaComparisonRow {
  schemaLabel: string;
  field: string;
  liveValue: string;
  migrationValue: string;
  status: SchemaCompareStatus;
}

const COMPARISON_FIELDS = [
  "@type",
  "name",
  "headline",
  "description",
  "url",
  "image",
  "@id",
  "datePublished",
  "dateModified",
  "author",
  "mainEntityOfPage"
] as const;

function schemaLabel(item: SchemaItem | undefined, index: number): string {
  const type = item?.types[0] || item?.fields["@type"] || "Schema";
  return `Schema ${index + 1} (${type})`;
}

function valuesMatch(live: string, migration: string): boolean {
  const a = normalizeText(live);
  const b = normalizeText(migration);
  if (a === b) return true;
  return normalizeWhitespace(live) === normalizeWhitespace(migration);
}

function compareRow(
  schemaLabelValue: string,
  field: string,
  liveRaw: string,
  migrationRaw: string
): SchemaComparisonRow {
  const live = normalizeWhitespace(liveRaw);
  const migration = normalizeWhitespace(migrationRaw);

  if (!live && !migration) {
    return { schemaLabel: schemaLabelValue, field, liveValue: "", migrationValue: "", status: "BOTH_EMPTY" };
  }
  if (!live) {
    return {
      schemaLabel: schemaLabelValue,
      field,
      liveValue: "(empty)",
      migrationValue: migrationRaw || migration,
      status: "MISSING_LIVE"
    };
  }
  if (!migration) {
    return {
      schemaLabel: schemaLabelValue,
      field,
      liveValue: liveRaw || live,
      migrationValue: "(empty)",
      status: "MISSING_MIGRATION"
    };
  }
  if (valuesMatch(liveRaw, migrationRaw)) {
    return { schemaLabel: schemaLabelValue, field, liveValue: liveRaw, migrationValue: migrationRaw, status: "MATCH" };
  }
  return { schemaLabel: schemaLabelValue, field, liveValue: liveRaw, migrationValue: migrationRaw, status: "DIFFER" };
}

export function buildSchemaComparisonRows(prod: SchemaData, dev: SchemaData): SchemaComparisonRow[] {
  const rows: SchemaComparisonRow[] = [];
  const pairCount = Math.max(prod.items.length, dev.items.length);

  for (let index = 0; index < pairCount; index += 1) {
    const label = schemaLabel(prod.items[index] || dev.items[index], index);

    for (const field of COMPARISON_FIELDS) {
      rows.push(
        compareRow(
          label,
          field,
          prod.items[index]?.fields[field] || "",
          dev.items[index]?.fields[field] || ""
        )
      );
    }
  }

  return rows;
}

function addCheck(
  items: SchemaCheckItem[],
  issues: Issue[],
  field: string,
  status: SchemaCheckStatus,
  message: string,
  value?: string,
  issue?: Issue
): void {
  items.push({ field, status, message, value });
  if (issue) issues.push(issue);
}

export function getSchemaCheckItems(result: CategoryResult): SchemaCheckItem[] {
  return (result.details as { checkItems?: SchemaCheckItem[] } | undefined)?.checkItems ?? [];
}

export function compareSchema(prod: SchemaData, dev: SchemaData): CategoryResult {
  const issues: Issue[] = [];
  const checkItems: SchemaCheckItem[] = [];
  const comparisonRows = buildSchemaComparisonRows(prod, dev);

  for (const block of dev.blocks) {
    if (!block.parseError) continue;
    addCheck(
      checkItems,
      issues,
      `JSON-LD block ${block.index + 1}`,
      "FAIL",
      "Invalid JSON-LD on migration site",
      block.parseError,
      {
        severity: "FAIL",
        category: "Schema",
        source: "dev",
        message: `Invalid JSON-LD in block ${block.index + 1}`,
        devValue: block.parseError
      }
    );
  }

  if (prod.items.length && !dev.items.length) {
    addCheck(
      checkItems,
      issues,
      "Structured data",
      "FAIL",
      "Migration site is missing JSON-LD structured data",
      undefined,
      {
        severity: "FAIL",
        category: "Schema",
        source: "dev",
        message: "JSON-LD structured data is missing on migration site",
        prodValue: `${prod.items.length} schema item(s)`,
        devValue: "0 schema items"
      }
    );
  } else if (!prod.items.length && dev.items.length) {
    addCheck(
      checkItems,
      issues,
      "Structured data",
      "WARNING",
      "Migration site has JSON-LD but live site does not",
      `${dev.items.length} schema item(s)`
    );
    issues.push({
      severity: "WARNING",
      category: "Schema",
      source: "comparison",
      message: "Migration site has JSON-LD structured data but live site does not",
      prodValue: "0 schema items",
      devValue: `${dev.items.length} schema item(s)`
    });
  } else if (!prod.items.length && !dev.items.length) {
    addCheck(checkItems, issues, "Structured data", "PASS", "No JSON-LD structured data on either site");
  } else {
    addCheck(
      checkItems,
      issues,
      "Structured data",
      "PASS",
      "JSON-LD present on migration site",
      `${dev.items.length} schema item(s)`
    );
  }

  if (prod.items.length && dev.items.length && prod.items.length !== dev.items.length) {
    issues.push({
      severity: "WARNING",
      category: "Schema",
      source: "comparison",
      message: "JSON-LD schema item count differs between live and migration",
      prodValue: `${prod.items.length}`,
      devValue: `${dev.items.length}`
    });
  }

  dev.items.forEach((item, index) => {
    const label = schemaLabel(item, index);
    if (!item.types.length) {
      addCheck(
        checkItems,
        issues,
        `${label} @type`,
        "FAIL",
        "Missing @type on migration site",
        undefined,
        {
          severity: "FAIL",
          category: "Schema",
          source: "dev",
          message: `${label} is missing @type`,
          devValue: "(empty)"
        }
      );
    } else {
      addCheck(checkItems, issues, `${label} @type`, "PASS", "Present on migration site", item.types.join(", "));
    }

    if (!item.fields.name && !item.fields.headline) {
      addCheck(
        checkItems,
        issues,
        `${label} name/headline`,
        "WARNING",
        "Missing name or headline on migration site"
      );
      issues.push({
        severity: "WARNING",
        category: "Schema",
        source: "dev",
        message: `${label} is missing name and headline`,
        devValue: "(empty)"
      });
    } else {
      addCheck(
        checkItems,
        issues,
        `${label} name/headline`,
        "PASS",
        "Present on migration site",
        item.fields.name || item.fields.headline
      );
    }
  });

  for (const row of comparisonRows) {
    if (row.status !== "DIFFER") continue;
    issues.push({
      severity: "WARNING",
      category: "Schema",
      source: "comparison",
      message: `${row.schemaLabel}: ${row.field} differs between live and migration`,
      prodValue: row.liveValue,
      devValue: row.migrationValue
    });
  }

  for (let index = 0; index < Math.min(prod.items.length, dev.items.length); index += 1) {
    const prodType = prod.items[index]?.types.join(", ") || "";
    const devType = dev.items[index]?.types.join(", ") || "";
    if (prodType && devType && normalizeText(prodType) !== normalizeText(devType)) {
      issues.push({
        severity: "FAIL",
        category: "Schema",
        source: "comparison",
        message: `${schemaLabel(prod.items[index], index)} @type mismatch between live and migration`,
        prodValue: prodType,
        devValue: devType
      });
    }
  }

  const result = statusFromIssues(issues, "Schema structured data checks pass", "Schema structured data warnings");
  return {
    ...result,
    details: {
      prod,
      dev,
      comparisonRows,
      checkItems
    }
  };
}
