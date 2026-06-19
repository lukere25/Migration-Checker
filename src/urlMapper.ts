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

/** Resolve a path or full URL to the complete page URL used for comparison. */
export function resolveCompletePageUrl(baseUrl: string, input: string | undefined): string {
  const trimmed = input?.trim();
  if (!trimmed) return "";
  return resolveSiteUrl(baseUrl, trimmed, normalizePath(trimmed) || "/");
}

function reportPathForDifferentUrls(prodUrl: string, devUrl: string): string {
  const prodSlug = slugify(normalizePath(prodUrl).replace(/^\/+|\/+$/g, "") || "home");
  const devSlug = slugify(normalizePath(devUrl).replace(/^\/+|\/+$/g, "") || "home");
  return `/url-pair/${prodSlug}__vs__${devSlug}/`;
}

export function createPageMapping(row: RawPageRow): PageMapping | null {
  const liveInput = row.prodUrl?.trim();
  const migrationInput = row.devUrl?.trim();
  const hasExplicitPair = Boolean(liveInput && migrationInput);

  let prodUrl: string;
  let devUrl: string;
  let path: string;

  if (hasExplicitPair) {
    prodUrl = resolveCompletePageUrl(config.prodBaseUrl, liveInput);
    devUrl = resolveCompletePageUrl(config.devBaseUrl, migrationInput);
    if (!prodUrl || !devUrl) return null;

    const prodPath = normalizePath(prodUrl);
    const devPath = normalizePath(devUrl);
    path = prodPath === devPath ? prodPath : reportPathForDifferentUrls(prodUrl, devUrl);
  } else {
    path = resolvePathAlias(row);
    if (!path) return null;

    prodUrl = resolveSiteUrl(config.prodBaseUrl, row.prodUrl, path);
    devUrl = resolveSiteUrl(config.devBaseUrl, row.devUrl, path);
  }

  const pageNameCandidate = row.pageName?.trim();
  const defaultName = path.replace(/^\/|\/$/g, "") || "Home";
  const pageName =
    pageNameCandidate && !looksLikePathOrUrl(pageNameCandidate)
      ? pageNameCandidate
      : hasExplicitPair && normalizePath(prodUrl) !== normalizePath(devUrl)
        ? `${normalizePath(prodUrl).replace(/^\/+|\/+$/g, "") || "home"} ↔ ${normalizePath(devUrl).replace(/^\/+|\/+$/g, "") || "home"}`
        : defaultName;

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

export function pathLabelForMapping(mapping: Pick<PageMapping, "path" | "prodUrl" | "devUrl">): string {
  const prodPath = normalizePath(mapping.prodUrl);
  const devPath = normalizePath(mapping.devUrl);
  if (prodPath === devPath) return mapping.path;
  return `${prodPath} ↔ ${devPath}`;
}

export function liveUrlFromAlias(alias: string): string {
  return buildUrl(config.prodBaseUrl, alias);
}

export function migrationUrlFromAlias(alias: string): string {
  return buildUrl(config.devBaseUrl, alias);
}
