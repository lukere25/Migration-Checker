export interface JiraSettings {
  atlassianDomain: string;
  projectId?: string;
}

export interface JiraIssuePayload {
  severity: string;
  category: string;
  message: string;
  prodValue?: string;
  devValue?: string;
  url?: string;
  pageName?: string;
  prodUrl?: string;
  devUrl?: string;
  reportUrl?: string;
}

export function normalizeAtlassianDomain(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  let host = trimmed.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  if (!host.includes(".")) {
    host = `${host}.atlassian.net`;
  }

  return host.toLowerCase();
}

export function normalizeJiraProjectId(input: string): string {
  return input.trim().replace(/\D/g, "");
}

export function normalizeJiraProjectKey(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Extract site host and project key from common Jira Cloud URLs. */
export function parseJiraProjectUrl(input: string): { host: string; projectKey: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const url = /^https?:\/\//i.test(trimmed) ? new URL(trimmed) : null;
    const path = url ? url.pathname : trimmed;
    const host = url ? normalizeAtlassianDomain(url.host) : "";

    const projectMatch = path.match(/\/projects\/([A-Za-z][A-Za-z0-9]*)\b/i);
    if (!projectMatch) return null;

    return {
      host,
      projectKey: projectMatch[1].toUpperCase()
    };
  } catch {
    return null;
  }
}

export function buildJiraProjectLookupUrl(host: string, projectKey: string): string {
  const normalizedHost = normalizeAtlassianDomain(host);
  const key = normalizeJiraProjectKey(projectKey);
  if (!normalizedHost || !key) return "";
  return `https://${normalizedHost}/rest/api/3/project/${key}`;
}

export function isJiraConfigured(settings: Partial<JiraSettings>): boolean {
  return Boolean(normalizeAtlassianDomain(settings.atlassianDomain || ""));
}

export function buildJiraSummary(payload: JiraIssuePayload): string {
  const prefix = `[Sync Scope] ${payload.severity}`;
  const summary = `${prefix} · ${payload.category}: ${payload.message}`;
  return summary.length > 240 ? `${summary.slice(0, 237)}...` : summary;
}

export function buildJiraDescription(payload: JiraIssuePayload): string {
  const lines = [
    "h2. Sync Scope comparison issue",
    "",
    `*Severity:* ${payload.severity}`,
    `*Category:* ${payload.category}`,
    `*Message:* ${payload.message}`
  ];

  if (payload.pageName) lines.push(`*Page:* ${payload.pageName}`);
  if (payload.prodUrl) lines.push(`*Live URL:* ${payload.prodUrl}`);
  if (payload.devUrl) lines.push(`*Migration URL:* ${payload.devUrl}`);
  if (payload.url) lines.push(`*Related URL:* ${payload.url}`);
  if (payload.prodValue) lines.push(`*Live value:* ${payload.prodValue}`);
  if (payload.devValue) lines.push(`*Migration value:* ${payload.devValue}`);
  if (payload.reportUrl) lines.push(`*Report:* ${payload.reportUrl}`);

  lines.push("", "_Created from Sync Scope report_");
  return lines.join("\n");
}

/** Opens Jira create-issue with title and description prefilled. Project is optional. */
export function buildJiraCreateIssueUrl(settings: JiraSettings, payload: JiraIssuePayload): string {
  const host = normalizeAtlassianDomain(settings.atlassianDomain);
  if (!host) {
    throw new Error("Jira is not configured");
  }

  const params = new URLSearchParams({
    summary: buildJiraSummary(payload),
    description: buildJiraDescription(payload)
  });

  const projectId = normalizeJiraProjectId(settings.projectId || "");
  if (projectId) {
    params.set("pid", projectId);
  }

  return `https://${host}/secure/CreateIssueDetails!init.jspa?${params.toString()}`;
}
