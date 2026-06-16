import { Page } from "@playwright/test";
import fs from "fs-extra";
import path from "path";
import { config } from "./config";
import { launchLiveSiteBrowser } from "./browserContext";
import { logger } from "./utils/logger";

const passwordSelectors = [
  'input[type="password"]',
  'input[name="password"]',
  'input[placeholder*="password" i]'
];

const submitSelectors = [
  'button[type="submit"]',
  'input[type="submit"]',
  'button:has-text("Submit")',
  'button:has-text("Enter")',
  'button:has-text("Visit")',
  'button:has-text("Log in")',
  'button:has-text("Login")',
  'button:has-text("Unlock")'
];

export async function authenticateDev(page: Page): Promise<boolean> {
  await page.goto(config.devBaseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });

  let passwordInput = null;
  for (const selector of passwordSelectors) {
    const input = page.locator(selector).first();
    if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
      passwordInput = input;
      break;
    }
  }

  if (!passwordInput) return false;

  logger.info("Migration site password gate detected; submitting credentials...");
  await passwordInput.fill(config.devPassword);

  for (const buttonSelector of submitSelectors) {
    const button = page.locator(buttonSelector).first();
    if (await button.isVisible().catch(() => false)) {
      await Promise.all([
        page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => undefined),
        button.click()
      ]);
      await page.waitForTimeout(1000);
      return true;
    }
  }

  await passwordInput.press("Enter");
  await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(1000);
  return true;
}

function authPasswordMetaPath(): string {
  return path.join(path.dirname(config.authStoragePath), "password.meta");
}

export async function clearDevAuthStorage(): Promise<void> {
  await fs.remove(config.authStoragePath).catch(() => undefined);
  await fs.remove(authPasswordMetaPath()).catch(() => undefined);
}

async function shouldRefreshAuth(): Promise<boolean> {
  if (!(await fs.pathExists(config.authStoragePath))) return true;
  if (!(await fs.pathExists(authPasswordMetaPath()))) return true;
  const saved = (await fs.readFile(authPasswordMetaPath(), "utf8")).trim();
  return saved !== config.devPassword;
}

export async function ensureDevStorageState(): Promise<string> {
  const storagePath = config.authStoragePath;
  if (!(await shouldRefreshAuth())) return storagePath;

  await clearDevAuthStorage();
  await fs.ensureDir(path.dirname(storagePath));
  const browser = await launchLiveSiteBrowser();
  const page = await browser.newPage();
  const authenticated = await authenticateDev(page);
  await page.context().storageState({ path: storagePath });
  await fs.writeFile(authPasswordMetaPath(), config.devPassword, "utf8");
  await browser.close();

  logger.info(authenticated ? `Saved dev auth storage to ${storagePath}` : "No dev password form detected; saved current storage state");
  return storagePath;
}

if (require.main === module) {
  ensureDevStorageState().catch((error) => {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
