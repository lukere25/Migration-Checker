import fs from "fs-extra";
import path from "path";
import { config } from "./config";
import { clearDevAuthStorage } from "./auth";

const settingsPath = path.join(process.cwd(), ".runs", "settings.json");

export interface AppSettings {
  liveBaseUrl: string;
  migrationBaseUrl: string;
  migrationPassword: string;
}

export const defaultAppSettings: AppSettings = {
  liveBaseUrl: "https://www.netapp.com",
  migrationBaseUrl: "https://netapp-e25migration.vercel.app",
  migrationPassword: "T2'U,0_(pl69"
};

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
    migrationPassword: config.devPassword
  };
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
  } catch {
    // Ignore invalid persisted settings.
  }
}

export async function saveAppSettings(settings: AppSettings): Promise<AppSettings> {
  applyBaseUrlSettings(settings);
  applyMigrationPassword(settings.migrationPassword);
  config.devPassword = settings.migrationPassword.trim();

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
