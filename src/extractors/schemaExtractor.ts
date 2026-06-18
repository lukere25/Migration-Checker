import { Page } from "@playwright/test";

export interface SchemaBlock {
  index: number;
  rawPreview: string;
  parseError?: string;
  itemCount: number;
}

export interface SchemaItem {
  blockIndex: number;
  itemIndex: number;
  types: string[];
  fields: Record<string, string>;
}

export interface SchemaData {
  blocks: SchemaBlock[];
  items: SchemaItem[];
}

const FIELD_KEYS = [
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeTypes(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) return [value.trim()];
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()))
      .map((entry) => entry.trim());
  }
  return [];
}

function readUrl(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (isRecord(value) && typeof value.url === "string") return value.url.trim();
  if (isRecord(value) && typeof value["@id"] === "string") return value["@id"].trim();
  return "";
}

function readImage(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    for (const entry of value) {
      const url = readUrl(entry);
      if (url) return url;
    }
    return "";
  }
  return readUrl(value);
}

function readAuthor(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((entry) => readAuthor(entry))
      .filter(Boolean)
      .join("; ");
  }
  if (isRecord(value) && typeof value.name === "string") return value.name.trim();
  return "";
}

function extractFields(node: Record<string, unknown>): Record<string, string> {
  const fields: Record<string, string> = {};
  const types = normalizeTypes(node["@type"]);
  if (types.length) fields["@type"] = types.join(", ");

  const scalarFields: Array<[string, unknown]> = [
    ["name", node.name],
    ["headline", node.headline],
    ["description", node.description],
    ["url", node.url],
    ["@id", node["@id"]],
    ["datePublished", node.datePublished],
    ["dateModified", node.dateModified]
  ];

  for (const [key, value] of scalarFields) {
    if (typeof value === "string" && value.trim()) {
      fields[key] = value.trim();
    }
  }

  const image = readImage(node.image);
  if (image) fields.image = image;

  const author = readAuthor(node.author);
  if (author) fields.author = author;

  const mainEntity = readUrl(node.mainEntityOfPage);
  if (mainEntity) fields.mainEntityOfPage = mainEntity;

  return fields;
}

function flattenJsonLd(value: unknown, output: Record<string, unknown>[]): void {
  if (Array.isArray(value)) {
    for (const entry of value) flattenJsonLd(entry, output);
    return;
  }

  if (!isRecord(value)) return;

  if (Array.isArray(value["@graph"])) {
    flattenJsonLd(value["@graph"], output);
    return;
  }

  if (normalizeTypes(value["@type"]).length || FIELD_KEYS.some((key) => key in value)) {
    output.push(value);
  }
}

export function parseSchemaBlocks(rawBlocks: Array<{ index: number; raw: string }>): SchemaData {
  const blocks: SchemaBlock[] = [];
  const items: SchemaItem[] = [];

  for (const block of rawBlocks) {
    const raw = block.raw.trim();
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as unknown;
      const nodes: Record<string, unknown>[] = [];
      flattenJsonLd(parsed, nodes);

      blocks.push({
        index: block.index,
        rawPreview: raw.length > 240 ? `${raw.slice(0, 237)}...` : raw,
        itemCount: nodes.length
      });

      nodes.forEach((node, itemIndex) => {
        items.push({
          blockIndex: block.index,
          itemIndex,
          types: normalizeTypes(node["@type"]),
          fields: extractFields(node)
        });
      });
    } catch (error) {
      blocks.push({
        index: block.index,
        rawPreview: raw.length > 240 ? `${raw.slice(0, 237)}...` : raw,
        parseError: error instanceof Error ? error.message : String(error),
        itemCount: 0
      });
    }
  }

  return { blocks, items };
}

export async function extractSchema(page: Page): Promise<SchemaData> {
  const rawBlocks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((script, index) => ({
      index,
      raw: script.textContent?.trim() || ""
    }));
  });

  return parseSchemaBlocks(rawBlocks.filter((block) => block.raw));
}

export function emptySchemaData(): SchemaData {
  return { blocks: [], items: [] };
}
