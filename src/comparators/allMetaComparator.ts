import { Metadata } from "../extractors/metadataExtractor";
import { normalizeText, normalizeWhitespace } from "../utils/normalize";
import { MetadataCompareStatus } from "./metadataComparator";

export interface AllMetaTagRow {
  tag: string;
  liveValue: string;
  migrationValue: string;
  status: MetadataCompareStatus;
}

function metaTagKey(item: { key: string; value: string }): string {
  const label = (item.key || item.value || "").trim();
  return label.toLowerCase();
}

function groupMetaContents(allMeta: Metadata["allMeta"]): Map<string, { display: string; contents: string[] }> {
  const grouped = new Map<string, { display: string; contents: string[] }>();

  for (const item of allMeta) {
    const key = metaTagKey(item);
    if (!key) continue;

    const display = item.key || item.value || key;
    const content = item.content?.trim() || "";
    const entry = grouped.get(key) ?? { display, contents: [] };
    entry.display = display;
    if (content) entry.contents.push(content);
    grouped.set(key, entry);
  }

  return grouped;
}

function joinContents(contents: string[]): string {
  const unique = [...new Set(contents.map((value) => normalizeWhitespace(value)).filter(Boolean))];
  return unique.join(" | ");
}

function compareTagValues(liveRaw: string, migrationRaw: string): AllMetaTagRow["status"] {
  const live = normalizeWhitespace(liveRaw);
  const migration = normalizeWhitespace(migrationRaw);

  if (!live && !migration) return "BOTH_EMPTY";
  if (!live) return "MISSING_LIVE";
  if (!migration) return "MISSING_MIGRATION";
  if (live === migration || normalizeText(liveRaw) === normalizeText(migrationRaw)) return "MATCH";
  return "DIFFER";
}

function compareTagRow(tag: string, liveRaw: string, migrationRaw: string): AllMetaTagRow {
  const status = compareTagValues(liveRaw, migrationRaw);
  return {
    tag,
    liveValue: liveRaw || (status === "MISSING_LIVE" ? "" : "(empty)"),
    migrationValue: migrationRaw || (status === "MISSING_MIGRATION" ? "" : "(empty)"),
    status
  };
}

/** Compare every meta tag on live vs migration pages. */
export function compareAllMetaTags(prod: Metadata, dev: Metadata): AllMetaTagRow[] {
  const liveGrouped = groupMetaContents(prod.allMeta);
  const migrationGrouped = groupMetaContents(dev.allMeta);
  const allKeys = new Set([...liveGrouped.keys(), ...migrationGrouped.keys()]);

  const rows: AllMetaTagRow[] = [
    compareTagRow("document.title", prod.title, dev.title)
  ];

  for (const key of [...allKeys].sort((a, b) => a.localeCompare(b))) {
    const live = liveGrouped.get(key);
    const migration = migrationGrouped.get(key);
    const display = live?.display || migration?.display || key;
    rows.push(
      compareTagRow(display, joinContents(live?.contents ?? []), joinContents(migration?.contents ?? []))
    );
  }

  if (prod.canonical || dev.canonical) {
    rows.push(compareTagRow("link[rel=canonical]", prod.canonical, dev.canonical));
  }

  for (const lang of [
    ...new Set([...prod.hreflang.map((item) => item.lang), ...dev.hreflang.map((item) => item.lang)])
  ].sort()) {
    const tag = `link[hreflang=${lang}]`;
    const liveHref = prod.hreflang.find((item) => item.lang === lang)?.href || "";
    const migrationHref = dev.hreflang.find((item) => item.lang === lang)?.href || "";
    rows.push(compareTagRow(tag, liveHref, migrationHref));
  }

  return rows.sort((a, b) => a.tag.localeCompare(b.tag));
}

export function getAllMetaTagRows(details?: unknown): AllMetaTagRow[] {
  const data = details as { allMetaTagRows?: AllMetaTagRow[] } | undefined;
  return data?.allMetaTagRows ?? [];
}
