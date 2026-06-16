import { config } from "../config";

export function normalizeWhitespace(value = ""): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeText(value = ""): string {
  return normalizeWhitespace(value).toLowerCase();
}

export function ensureLeadingSlash(pathname: string): string {
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

export function normalizePath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  try {
    return ensureLeadingSlash(new URL(trimmed).pathname).replace(/\/{2,}/g, "/");
  } catch {
    return ensureLeadingSlash(trimmed).replace(/^https?:\/\/[^/]+/i, "").replace(/\/{2,}/g, "/");
  }
}

export function buildUrl(baseUrl: string, pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl.trim();
  return new URL(normalizePath(pathOrUrl), `${baseUrl}/`).toString();
}

export function normalizeInternalHref(href: string): string {
  if (!href) return "";

  try {
    const url = new URL(href);
    const prodHost = new URL(config.prodBaseUrl).host;
    const devHost = new URL(config.devBaseUrl).host;
    if (url.host === prodHost || url.host === devHost) {
      return `${url.pathname.replace(/\/$/, "") || "/"}${url.search}`.toLowerCase();
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return href.replace(/\/$/, "").toLowerCase();
  }
}

export function normalizeImageKey(src: string): string {
  if (!src) return "";
  try {
    const url = new URL(src);
    return decodeURIComponent(url.pathname.split("/").filter(Boolean).slice(-2).join("/")).toLowerCase();
  } catch {
    return src.split("?")[0].split("/").filter(Boolean).slice(-2).join("/").toLowerCase();
  }
}

export function slugify(value: string): string {
  const slug = normalizeText(value)
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "page";
}

export function percentDifference(a: number, b: number): number {
  if (a === 0 && b === 0) return 0;
  return Math.abs(a - b) / Math.max(a, b);
}
