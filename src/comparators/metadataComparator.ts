import { compareAllMetaTags } from "./allMetaComparator";
import { Metadata } from "../extractors/metadataExtractor";
import { normalizeText, normalizeWhitespace } from "../utils/normalize";
import { CategoryResult, Issue, statusFromIssues } from "../utils/status";

const SKIPPED_OG_KEYS = new Set(["locale"]);

export type MetadataCheckStatus = "PASS" | "FAIL" | "WARNING";

export interface MetadataCheckItem {
  field: string;
  status: MetadataCheckStatus;
  value?: string;
  message: string;
}

export type MetadataCompareStatus = "MATCH" | "DIFFER" | "MISSING_LIVE" | "MISSING_MIGRATION" | "BOTH_EMPTY";

export interface MetadataComparisonRow {
  field: string;
  liveValue: string;
  migrationValue: string;
  status: MetadataCompareStatus;
}

export const REQUIRED_OG_FIELDS: Array<{ label: string; key: string }> = [
  { label: "OG title", key: "title" },
  { label: "OG description", key: "description" },
  { label: "OG image", key: "image" },
  { label: "OG type", key: "type" },
  { label: "OG url", key: "url" },
  { label: "OG site_name", key: "site_name" }
];

export interface MetadataSnapshot {
  title: string;
  description: string;
  openGraph: Record<string, string>;
  taxonomy: Record<string, string>;
}

function pickOpenGraph(meta: Metadata): Record<string, string> {
  return Object.fromEntries(
    Object.entries(meta.openGraph).filter(([key]) => !SKIPPED_OG_KEYS.has(key.toLowerCase()))
  );
}

function pickTaxonomy(meta: Metadata): Record<string, string> {
  const taxonomy: Record<string, string> = {};
  const articleTags: string[] = [];

  for (const item of meta.allMeta) {
    const key = item.key.toLowerCase();
    if (!item.content) continue;

    if (key.includes("taxonomy")) {
      taxonomy[item.key] = item.content;
      continue;
    }
    if (key === "article:tag") {
      articleTags.push(item.content);
      continue;
    }
    if (key === "article:section") {
      taxonomy["article:section"] = taxonomy["article:section"]
        ? `${taxonomy["article:section"]}; ${item.content}`
        : item.content;
    }
  }

  if (articleTags.length) {
    taxonomy["article:tag"] = [...articleTags].sort().join("; ");
  }

  return taxonomy;
}

export function buildMetadataSnapshot(meta: Metadata): MetadataSnapshot {
  return {
    title: meta.title,
    description: meta.description,
    openGraph: pickOpenGraph(meta),
    taxonomy: pickTaxonomy(meta)
  };
}

function formatTaxonomy(taxonomy: Record<string, string>): string {
  if (!Object.keys(taxonomy).length) return "";
  return Object.entries(taxonomy)
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ");
}

function valuesMatch(live: string, migration: string, exact: boolean): boolean {
  const a = exact ? normalizeWhitespace(live) : normalizeText(live);
  const b = exact ? normalizeWhitespace(migration) : normalizeText(migration);
  if (a === b) return true;
  if (!exact && live && migration && normalizeText(live) === normalizeText(migration)) return true;
  return false;
}

function compareRow(field: string, liveRaw: string, migrationRaw: string, exact = false): MetadataComparisonRow {
  const live = normalizeWhitespace(liveRaw);
  const migration = normalizeWhitespace(migrationRaw);

  if (!live && !migration) {
    return { field, liveValue: "", migrationValue: "", status: "BOTH_EMPTY" };
  }
  if (!live) {
    return { field, liveValue: "(empty)", migrationValue: migrationRaw || migration, status: "MISSING_LIVE" };
  }
  if (!migration) {
    return { field, liveValue: liveRaw || live, migrationValue: "(empty)", status: "MISSING_MIGRATION" };
  }
  if (valuesMatch(liveRaw, migrationRaw, exact)) {
    return { field, liveValue: liveRaw, migrationValue: migrationRaw, status: "MATCH" };
  }
  return { field, liveValue: liveRaw, migrationValue: migrationRaw, status: "DIFFER" };
}

export function buildMetadataComparisonRows(prod: MetadataSnapshot, dev: MetadataSnapshot): MetadataComparisonRow[] {
  const rows: MetadataComparisonRow[] = [
    compareRow("Meta title", prod.title, dev.title, true),
    compareRow("Meta description", prod.description, dev.description, false),
    ...REQUIRED_OG_FIELDS.map(({ label, key }) =>
      compareRow(label, prod.openGraph[key] || "", dev.openGraph[key] || "", false)
    ),
    compareRow("Taxonomy metadata", formatTaxonomy(prod.taxonomy), formatTaxonomy(dev.taxonomy), false)
  ];
  return rows;
}

function checkRequiredMigration(
  items: MetadataCheckItem[],
  issues: Issue[],
  label: string,
  value: string
): void {
  const trimmed = normalizeWhitespace(value);
  if (!trimmed) {
    items.push({ field: label, status: "FAIL", message: "Missing or empty on migration site" });
    issues.push({
      severity: "FAIL",
      category: "Metadata",
      source: "dev",
      message: `${label} is missing or empty`,
      devValue: "(empty)"
    });
    return;
  }
  items.push({ field: label, status: "PASS", value: trimmed, message: "Present on migration site" });
}

/** Dev-site validation + live vs migration comparison for reports. */
export function compareMetadata(prod: Metadata, dev: Metadata): CategoryResult {
  const issues: Issue[] = [];
  const items: MetadataCheckItem[] = [];
  const prodSnapshot = buildMetadataSnapshot(prod);
  const devSnapshot = buildMetadataSnapshot(dev);
  const comparisonRows = buildMetadataComparisonRows(prodSnapshot, devSnapshot);
  const allMetaTagRows = compareAllMetaTags(prod, dev);

  checkRequiredMigration(items, issues, "Meta title", dev.title);
  checkRequiredMigration(items, issues, "Meta description", dev.description);

  for (const { label, key } of REQUIRED_OG_FIELDS) {
    checkRequiredMigration(items, issues, label, devSnapshot.openGraph[key] || "");
  }

  if (!Object.keys(devSnapshot.taxonomy).length) {
    items.push({
      field: "Taxonomy metadata",
      status: "WARNING",
      message: "No taxonomy tags on migration site"
    });
    issues.push({
      severity: "WARNING",
      category: "Metadata",
      source: "dev",
      message: "Taxonomy metadata is missing"
    });
  } else {
    items.push({
      field: "Taxonomy metadata",
      status: "PASS",
      value: formatTaxonomy(devSnapshot.taxonomy),
      message: "Present on migration site"
    });
  }

  for (const row of comparisonRows) {
    if (row.status !== "DIFFER") continue;
    issues.push({
      severity: "WARNING",
      category: "Metadata",
      source: "comparison",
      message: `${row.field} differs between live and migration`,
      prodValue: row.liveValue,
      devValue: row.migrationValue
    });
  }

  const result = statusFromIssues(issues, "Metadata checks pass");
  return {
    ...result,
    details: {
      scope: "Live vs migration metadata comparison",
      items,
      comparisonRows,
      allMetaTagRows,
      prod: prodSnapshot,
      dev: devSnapshot,
      checkedFields: [
        "Meta title",
        "Meta description",
        ...REQUIRED_OG_FIELDS.map((field) => field.label),
        "Taxonomy metadata"
      ],
      excludedFields: ["Twitter tags", "og:locale", "robots", "keywords", "canonical", "hreflang"]
    }
  };
}

export function getMetadataCheckItems(category?: CategoryResult): MetadataCheckItem[] {
  const details = category?.details as { items?: MetadataCheckItem[] } | undefined;
  return details?.items ?? [];
}

export function getMetadataComparisonRows(category?: CategoryResult): MetadataComparisonRow[] {
  const details = category?.details as { comparisonRows?: MetadataComparisonRow[] } | undefined;
  return details?.comparisonRows ?? [];
}

/** @deprecated Use compareMetadata */
export function validateDevMetadata(dev: Metadata): CategoryResult {
  const emptyProd: Metadata = {
    title: "",
    description: "",
    canonical: "",
    robots: "",
    keywords: "",
    openGraph: {},
    twitter: {},
    hreflang: [],
    allMeta: []
  };
  return compareMetadata(emptyProd, dev);
}
