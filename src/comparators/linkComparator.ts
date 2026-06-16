import { APIRequestContext } from "@playwright/test";
import { config } from "../config";
import { LinkData } from "../extractors/linkExtractor";
import { normalizeInternalHref, normalizeText } from "../utils/normalize";
import { CategoryResult, Issue, IssueSource, statusFromIssues } from "../utils/status";

function linkKey(link: LinkData): string {
  return normalizeInternalHref(link.href);
}

function isCheckableHttpLink(href: string): boolean {
  if (!href || /^(mailto:|tel:|javascript:|#)/i.test(href)) return false;
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function hostMatchesBase(href: string, baseUrl: string): boolean {
  try {
    return new URL(href).host === new URL(baseUrl).host;
  } catch {
    return false;
  }
}

export function compareLinks(prod: LinkData[], dev: LinkData[], category = "Links"): CategoryResult {
  const issues: Issue[] = [];
  const prodByHref = new Map(prod.map((link) => [linkKey(link), link]));
  const devByHref = new Map(dev.map((link) => [linkKey(link), link]));

  for (const [href, prodLink] of prodByHref) {
    const devLink = devByHref.get(href);
    if (!devLink) {
      issues.push({ severity: "FAIL", category, source: "dev", message: "Missing link on dev", prodValue: prodLink.href });
      continue;
    }
    if (normalizeText(prodLink.text || prodLink.ariaLabel || "") !== normalizeText(devLink.text || devLink.ariaLabel || "")) {
      issues.push({
        severity: "WARNING",
        category,
        source: "comparison",
        message: "Link text differs",
        prodValue: prodLink.text || prodLink.ariaLabel || "",
        devValue: devLink.text || devLink.ariaLabel || "",
        url: devLink.href
      });
    }
  }

  for (const [href, devLink] of devByHref) {
    if (!prodByHref.has(href)) {
      issues.push({ severity: "WARNING", category, source: "dev", message: "Extra link on dev", devValue: devLink.href });
    }
  }

  const result = statusFromIssues(issues, `${category} match`);
  return { ...result, details: { prodCount: prod.length, devCount: dev.length } };
}

export async function checkBrokenLinks(
  links: LinkData[],
  request: APIRequestContext,
  source: IssueSource,
  baseUrl: string
): Promise<Issue[]> {
  const checked = new Set<string>();
  const checkTasks: Array<{ href: string }> = [];

  const candidates = links
    .filter((link) => isCheckableHttpLink(link.href) && hostMatchesBase(link.href, baseUrl))
    .slice(0, config.linkStatusCheckLimit);

  for (const link of candidates) {
    const href = link.href.split("#")[0];
    if (checked.has(href)) continue;
    checked.add(href);
    checkTasks.push({ href });
  }

  const issueGroups = await Promise.all(
    checkTasks.map(async ({ href }) => {
      const response = await request.get(href, { timeout: 5000, maxRedirects: 5 }).catch(() => null);
      if (!response) {
        return [
          {
            severity: "WARNING" as const,
            category: "Broken links",
            source,
            message: "Unable to verify link",
            url: href
          }
        ];
      }

      const status = response.status();
      const row: Issue[] = [];
      if (status >= 500 || status === 404) {
        row.push({
          severity: "FAIL",
          category: "Broken links",
          source,
          message: `Broken link (HTTP ${status})`,
          url: href
        });
      } else if (status >= 400) {
        row.push({
          severity: "FAIL",
          category: "Broken links",
          source,
          message: `Broken link (HTTP ${status})`,
          url: href
        });
      } else if (status >= 300 && status < 400) {
        row.push({
          severity: "WARNING",
          category: "Broken links",
          source,
          message: `Link redirects (HTTP ${status})`,
          url: href
        });
      }
      return row;
    })
  );

  return issueGroups.flat();
}

/** @deprecated Use checkBrokenLinks */
export async function checkInternalLinkStatuses(links: LinkData[], request: APIRequestContext): Promise<Issue[]> {
  return checkBrokenLinks(links, request, "dev", config.devBaseUrl);
}
