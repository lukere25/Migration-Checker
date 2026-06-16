import path from "path";
import { config } from "./config";
import { buildUrl, normalizePath, slugify } from "./utils/normalize";

export interface PageMapping {
  pageName: string;
  prodUrl: string;
  devUrl: string;
  path: string;
  slug: string;
}

interface RawPageRow {
  pageName?: string;
  prodUrl?: string;
  devUrl?: string;
  path?: string;
}

function isFullUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function looksLikePathOrUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (trimmed.startsWith("/")) return true;
  if (/^[a-z0-9][a-z0-9\-_/]*$/i.test(trimmed)) return true;
  return false;
}

function resolvePathAlias(row: RawPageRow): string {
  const pathCandidate = row.path?.trim();
  if (pathCandidate) {
    const normalized = normalizePath(pathCandidate);
    if (normalized) return normalized;
  }

  for (const value of [row.prodUrl, row.devUrl, row.pageName]) {
    if (!value?.trim()) continue;
    if (!looksLikePathOrUrl(value)) continue;
    const normalized = normalizePath(value);
    if (normalized) return normalized;
  }

  return "";
}

function resolveSiteUrl(baseUrl: string, override: string | undefined, path: string): string {
  const trimmed = override?.trim();
  if (!trimmed) return buildUrl(baseUrl, path);
  if (isFullUrl(trimmed)) return trimmed;
  if (looksLikePathOrUrl(trimmed)) return buildUrl(baseUrl, trimmed);
  return buildUrl(baseUrl, path);
}

export function createPageMapping(row: RawPageRow): PageMapping | null {
  const path = resolvePathAlias(row);
  if (!path) return null;

  const prodUrl = resolveSiteUrl(config.prodBaseUrl, row.prodUrl, path);
  const devUrl = resolveSiteUrl(config.devBaseUrl, row.devUrl, path);

  const pageNameCandidate = row.pageName?.trim();
  const pageName =
    pageNameCandidate && !looksLikePathOrUrl(pageNameCandidate)
      ? pageNameCandidate
      : path.replace(/^\/|\/$/g, "") || "Home";

  return {
    pageName,
    prodUrl,
    devUrl,
    path,
    slug: slugify(path || pageName)
  };
}

export function dedupeMappings(mappings: PageMapping[]): PageMapping[] {
  const seen = new Set<string>();
  return mappings.filter((mapping) => {
    const key = `${mapping.prodUrl}|${mapping.devUrl}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sanitizeReportPathSegment(segment: string): string {
  const cleaned = segment.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "page";
}

/** URL alias path segments for report folders, e.g. `/nl/foo/` → `["nl", "foo"]`. */
export function aliasPathToReportSegments(aliasPath: string): string[] {
  const normalized = normalizePath(aliasPath).replace(/^\/+|\/+$/g, "");
  if (!normalized) return [];

  return normalized.split("/").filter(Boolean).map(sanitizeReportPathSegment);
}

/** Report directory for a page alias, e.g. `reports/.../pages/nl/foo`. */
export function resolveReportPageDir(reportsDir: string, aliasPath: string): string {
  return path.join(reportsDir, "pages", ...aliasPathToReportSegments(aliasPath));
}

export function liveUrlFromAlias(alias: string): string {
  return buildUrl(config.prodBaseUrl, alias);
}

export function migrationUrlFromAlias(alias: string): string {
  return buildUrl(config.devBaseUrl, alias);
}
