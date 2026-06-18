import { EmbedData, EmbeddedItem } from "../extractors/embedExtractor";
import { normalizeInternalHref, normalizeText, normalizeWhitespace } from "../utils/normalize";
import { CategoryResult, Issue, statusFromIssues } from "../utils/status";

export type EmbedCheckStatus = "PASS" | "FAIL" | "WARNING";

export interface EmbedCheckItem {
  field: string;
  status: EmbedCheckStatus;
  value?: string;
  message: string;
}

export type EmbedCompareStatus = "MATCH" | "DIFFER" | "MISSING_LIVE" | "MISSING_MIGRATION" | "BOTH_EMPTY";

export interface EmbedComparisonRow {
  embedLabel: string;
  field: string;
  liveValue: string;
  migrationValue: string;
  status: EmbedCompareStatus;
}

const COMPARISON_FIELDS = ["src", "dataSrc", "title", "width", "height", "sandbox", "allow", "type", "srcdocPreview"] as const;

function isEmptySrc(src: string): boolean {
  const trimmed = src.trim().toLowerCase();
  return !trimmed || trimmed === "about:blank" || trimmed.startsWith("javascript:");
}

function normalizeEmbedKey(item: EmbeddedItem): string {
  const src = item.src || item.dataSrc;
  if (isEmptySrc(src)) {
    if (item.srcdocPreview.trim()) return `${item.kind}:srcdoc:${normalizeText(item.srcdocPreview).slice(0, 80)}`;
    return `${item.kind}:${item.index}`;
  }

  const youtube = src.match(/(?:youtube\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]+)/i);
  if (youtube) return `youtube:${youtube[1].toLowerCase()}`;

  const vimeo = src.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeo) return `vimeo:${vimeo[1]}`;

  const normalized = normalizeInternalHref(src);
  if (normalized) return `${item.kind}:${normalized}`;

  try {
    const url = new URL(src);
    return `${item.kind}:${url.origin}${url.pathname}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return `${item.kind}:${normalizeWhitespace(src).toLowerCase()}`;
  }
}

function embedLabel(item: EmbeddedItem | undefined, index: number): string {
  if (!item) return `Embed ${index + 1}`;
  return `${item.kind} ${index + 1}${item.label ? ` (${item.label})` : ""}`;
}

function effectiveSrc(item: EmbeddedItem): string {
  return item.src || item.dataSrc || item.srcdocPreview;
}

function valuesMatch(live: string, migration: string): boolean {
  if (normalizeText(live) === normalizeText(migration)) return true;
  return normalizeWhitespace(live) === normalizeWhitespace(migration);
}

function compareRow(
  embedLabelValue: string,
  field: string,
  liveRaw: string,
  migrationRaw: string
): EmbedComparisonRow {
  const live = normalizeWhitespace(liveRaw);
  const migration = normalizeWhitespace(migrationRaw);

  if (!live && !migration) {
    return { embedLabel: embedLabelValue, field, liveValue: "", migrationValue: "", status: "BOTH_EMPTY" };
  }
  if (!live) {
    return {
      embedLabel: embedLabelValue,
      field,
      liveValue: "(empty)",
      migrationValue: migrationRaw || migration,
      status: "MISSING_LIVE"
    };
  }
  if (!migration) {
    return {
      embedLabel: embedLabelValue,
      field,
      liveValue: liveRaw || live,
      migrationValue: "(empty)",
      status: "MISSING_MIGRATION"
    };
  }
  if (valuesMatch(liveRaw, migrationRaw)) {
    return { embedLabel: embedLabelValue, field, liveValue: liveRaw, migrationValue: migrationRaw, status: "MATCH" };
  }
  return { embedLabel: embedLabelValue, field, liveValue: liveRaw, migrationValue: migrationRaw, status: "DIFFER" };
}

export function buildEmbedComparisonRows(prod: EmbedData, dev: EmbedData): EmbedComparisonRow[] {
  const rows: EmbedComparisonRow[] = [];
  const pairCount = Math.max(prod.items.length, dev.items.length);

  for (let index = 0; index < pairCount; index += 1) {
    const label = embedLabel(prod.items[index] || dev.items[index], index);
    const prodItem = prod.items[index];
    const devItem = dev.items[index];

    for (const field of COMPARISON_FIELDS) {
      rows.push(compareRow(label, field, prodItem?.[field] || "", devItem?.[field] || ""));
    }
  }

  return rows;
}

function addCheck(
  items: EmbedCheckItem[],
  issues: Issue[],
  field: string,
  status: EmbedCheckStatus,
  message: string,
  value?: string,
  issue?: Issue
): void {
  items.push({ field, status, message, value });
  if (issue) issues.push(issue);
}

export function getEmbedCheckItems(result: CategoryResult): EmbedCheckItem[] {
  return (result.details as { checkItems?: EmbedCheckItem[] } | undefined)?.checkItems ?? [];
}

export function compareEmbeds(prod: EmbedData, dev: EmbedData): CategoryResult {
  const issues: Issue[] = [];
  const checkItems: EmbedCheckItem[] = [];
  const comparisonRows = buildEmbedComparisonRows(prod, dev);

  const prodByKey = new Map(prod.items.map((item) => [normalizeEmbedKey(item), item]));
  const devByKey = new Map(dev.items.map((item) => [normalizeEmbedKey(item), item]));

  if (prod.items.length && !dev.items.length) {
    addCheck(
      checkItems,
      issues,
      "Embeds",
      "FAIL",
      "Migration site is missing embedded content",
      undefined,
      {
        severity: "FAIL",
        category: "Embeds",
        source: "dev",
        message: "Embedded content is missing on migration site",
        prodValue: `${prod.items.length} embed(s)`,
        devValue: "0 embeds"
      }
    );
  } else if (!prod.items.length && dev.items.length) {
    addCheck(
      checkItems,
      issues,
      "Embeds",
      "WARNING",
      "Migration site has embedded content but live site does not",
      `${dev.items.length} embed(s)`
    );
    issues.push({
      severity: "WARNING",
      category: "Embeds",
      source: "comparison",
      message: "Migration site has embedded content but live site does not",
      prodValue: "0 embeds",
      devValue: `${dev.items.length} embed(s)`
    });
  } else if (!prod.items.length && !dev.items.length) {
    addCheck(checkItems, issues, "Embeds", "PASS", "No embedded content on either site");
  } else {
    addCheck(
      checkItems,
      issues,
      "Embeds",
      "PASS",
      "Embedded content present on migration site",
      `${dev.items.length} embed(s)`
    );
  }

  if (prod.items.length && dev.items.length && prod.items.length !== dev.items.length) {
    issues.push({
      severity: "WARNING",
      category: "Embeds",
      source: "comparison",
      message: "Embed count differs between live and migration",
      prodValue: `${prod.items.length}`,
      devValue: `${dev.items.length}`
    });
  }

  for (const [key, prodItem] of prodByKey) {
    const devItem = devByKey.get(key);
    if (!devItem) {
      issues.push({
        severity: "FAIL",
        category: "Embeds",
        source: "dev",
        message: `Missing embed on migration site: ${prodItem.label || prodItem.kind}`,
        prodValue: effectiveSrc(prodItem),
        devValue: "(missing)"
      });
      continue;
    }

    if (prodItem.title && devItem.title && !valuesMatch(prodItem.title, devItem.title)) {
      issues.push({
        severity: "WARNING",
        category: "Embeds",
        source: "comparison",
        message: `Embed title differs: ${prodItem.label || prodItem.kind}`,
        prodValue: prodItem.title,
        devValue: devItem.title
      });
    }
  }

  for (const [key, devItem] of devByKey) {
    if (prodByKey.has(key)) continue;
    issues.push({
      severity: "WARNING",
      category: "Embeds",
      source: "dev",
      message: `Extra embed on migration site: ${devItem.label || devItem.kind}`,
      devValue: effectiveSrc(devItem)
    });
  }

  dev.items.forEach((item, index) => {
    const label = embedLabel(item, index);
    const src = item.src || item.dataSrc;

    if (isEmptySrc(src) && !item.srcdocPreview.trim()) {
      addCheck(
        checkItems,
        issues,
        `${label} src`,
        "FAIL",
        "Missing src on migration site",
        undefined,
        {
          severity: "FAIL",
          category: "Embeds",
          source: "dev",
          message: `${label} has no src or embedded code`,
          devValue: "(empty)"
        }
      );
    } else {
      addCheck(checkItems, issues, `${label} src`, "PASS", "Source or embedded code present", effectiveSrc(item));
    }
  });

  for (const row of comparisonRows) {
    if (row.status !== "DIFFER") continue;
    if (row.field === "srcdocPreview" && row.liveValue && row.migrationValue) {
      issues.push({
        severity: "WARNING",
        category: "Embeds",
        source: "comparison",
        message: `${row.embedLabel}: embedded code differs between live and migration`,
        prodValue: row.liveValue,
        devValue: row.migrationValue
      });
      continue;
    }
    if (row.field === "src" || row.field === "dataSrc") {
      issues.push({
        severity: "WARNING",
        category: "Embeds",
        source: "comparison",
        message: `${row.embedLabel}: ${row.field} differs between live and migration`,
        prodValue: row.liveValue,
        devValue: row.migrationValue
      });
    }
  }

  const result = statusFromIssues(issues, "Embed and iframe checks pass", "Embed and iframe warnings");
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
