import fs from "fs-extra";
import path from "path";
import { config } from "./config";
import { clearDevAuthStorage } from "./auth";
import { DEFAULT_ENABLED_MODULE_IDS, normalizeEnabledModuleIds } from "./comparisonModules";
import { JiraSettings, normalizeAtlassianDomain, normalizeJiraIssueTypeId, normalizeJiraProjectId } from "./jira";

const settingsPath = path.join(process.cwd(), ".runs", "settings.json");

export interface AppSettings {
  liveBaseUrl: string;
  migrationBaseUrl: string;
  migrationPassword: string;
  jiraAtlassianDomain: string;
  jiraProjectId: string;
  jiraIssueTypeId: string;
  enabledModules: string[];
}

export const defaultAppSettings: AppSettings = {
  liveBaseUrl: "https://www.netapp.com",
  migrationBaseUrl: "https://netapp-e25migration.vercel.app",
  migrationPassword: "T2'U,0_(pl69",
  jiraAtlassianDomain: "",
  jiraProjectId: "",
  jiraIssueTypeId: "",
  enabledModules: [...DEFAULT_ENABLED_MODULE_IDS]
};

let savedEnabledModules = [...DEFAULT_ENABLED_MODULE_IDS];

export function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) throw new Error("URL is required");

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withProtocol);
  const pathname = parsed.pathname.replace(/\/+$/, "");
  return pathname ? `${parsed.origin}${pathname}` : parsed.origin;
}

export function getAppSettings(): AppSettings {
  return {
    liveBaseUrl: config.prodBaseUrl,
    migrationBaseUrl: config.devBaseUrl,
    migrationPassword: config.devPassword,
    jiraAtlassianDomain: config.jiraAtlassianDomain,
    jiraProjectId: config.jiraProjectId,
    jiraIssueTypeId: config.jiraIssueTypeId,
    enabledModules: [...savedEnabledModules]
  };
}

export function applyEnabledModules(ids: string[] | undefined): string[] {
  savedEnabledModules = normalizeEnabledModuleIds(ids);
  return [...savedEnabledModules];
}

export function getJiraSettings(): JiraSettings {
  return {
    atlassianDomain: config.jiraAtlassianDomain,
    projectId: config.jiraProjectId,
    issueTypeId: config.jiraIssueTypeId
  };
}

export function applyJiraSettings(settings: Partial<JiraSettings>): JiraSettings {
  const normalized = {
    atlassianDomain: normalizeAtlassianDomain(settings.atlassianDomain || ""),
    projectId: normalizeJiraProjectId(settings.projectId || ""),
    issueTypeId: normalizeJiraIssueTypeId(settings.issueTypeId || "")
  };
  config.jiraAtlassianDomain = normalized.atlassianDomain;
  config.jiraProjectId = normalized.projectId;
  config.jiraIssueTypeId = normalized.issueTypeId;
  return normalized;
}

export function applyMigrationPassword(password: string): void {
  const trimmed = password.trim();
  if (!trimmed || trimmed === config.devPassword) return;
  config.devPassword = trimmed;
  void clearDevAuthStorage();
}

export function applyBaseUrlSettings(settings: Pick<AppSettings, "liveBaseUrl" | "migrationBaseUrl">): AppSettings {
  const normalized = {
    liveBaseUrl: normalizeBaseUrl(settings.liveBaseUrl),
    migrationBaseUrl: normalizeBaseUrl(settings.migrationBaseUrl)
  };
  config.prodBaseUrl = normalized.liveBaseUrl;
  config.devBaseUrl = normalized.migrationBaseUrl;
  return getAppSettings();
}

export async function loadPersistedSettings(): Promise<void> {
  if (!(await fs.pathExists(settingsPath))) return;

  try {
    const saved = await fs.readJson(settingsPath);
    if (saved?.liveBaseUrl && saved?.migrationBaseUrl) {
      applyBaseUrlSettings({
        liveBaseUrl: String(saved.liveBaseUrl),
        migrationBaseUrl: String(saved.migrationBaseUrl)
      });
    }
    if (typeof saved?.migrationPassword === "string" && saved.migrationPassword.trim()) {
      applyMigrationPassword(String(saved.migrationPassword));
    }
    if (
      saved?.jiraAtlassianDomain !== undefined ||
      saved?.jiraProjectId !== undefined ||
      saved?.jiraIssueTypeId !== undefined
    ) {
      applyJiraSettings({
        atlassianDomain: String(saved.jiraAtlassianDomain || ""),
        projectId: String(saved.jiraProjectId || ""),
        issueTypeId: String(saved.jiraIssueTypeId || "")
      });
    }
    if (Array.isArray(saved?.enabledModules)) {
      applyEnabledModules(saved.enabledModules.map(String));
    }
  } catch {
    // Ignore invalid persisted settings.
  }
}

export async function saveAppSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  const current = getAppSettings();

  if (settings.liveBaseUrl !== undefined || settings.migrationBaseUrl !== undefined) {
    applyBaseUrlSettings({
      liveBaseUrl: settings.liveBaseUrl ?? current.liveBaseUrl,
      migrationBaseUrl: settings.migrationBaseUrl ?? current.migrationBaseUrl
    });
  }

  if (settings.migrationPassword !== undefined) {
    applyMigrationPassword(settings.migrationPassword);
    config.devPassword = settings.migrationPassword.trim();
  }

  if (
    settings.jiraAtlassianDomain !== undefined ||
    settings.jiraProjectId !== undefined ||
    settings.jiraIssueTypeId !== undefined
  ) {
    applyJiraSettings({
      atlassianDomain: settings.jiraAtlassianDomain ?? current.jiraAtlassianDomain,
      projectId: settings.jiraProjectId ?? current.jiraProjectId,
      issueTypeId: settings.jiraIssueTypeId ?? current.jiraIssueTypeId
    });
  }

  if (settings.enabledModules !== undefined) {
    applyEnabledModules(settings.enabledModules);
  }

  const normalized = getAppSettings();
  await fs.ensureDir(path.dirname(settingsPath));
  await fs.writeJson(settingsPath, normalized, { spaces: 2 });
  return normalized;
}

export function applyBaseUrlsFromInput(
  liveBaseUrl?: string,
  migrationBaseUrl?: string
): void {
  const live = liveBaseUrl?.trim();
  const migration = migrationBaseUrl?.trim();
  if (!live && !migration) return;

  applyBaseUrlSettings({
    liveBaseUrl: live || config.prodBaseUrl,
    migrationBaseUrl: migration || config.devBaseUrl
  });
}

export function applyRequestSettings(fields: {
  liveBaseUrl?: string;
  migrationBaseUrl?: string;
  migrationPassword?: string;
}): void {
  applyBaseUrlsFromInput(fields.liveBaseUrl, fields.migrationBaseUrl);
  if (fields.migrationPassword?.trim()) {
    applyMigrationPassword(fields.migrationPassword);
    config.devPassword = fields.migrationPassword.trim();
  }
}
