import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";

delete process.env.SHEET_NAME;
delete process.env.START_INDEX;

const headless = process.env.PLAYWRIGHT_HEADLESS !== "false";
const runAllBrowsers = process.env.PLAYWRIGHT_ALL_BROWSERS === "true";
const defaultProject = process.env.PLAYWRIGHT_PROJECT || "chromium-desktop";

const chromeLaunchOptions = {
  channel: "chrome" as const,
  headless,
  ignoreDefaultArgs: ["--enable-automation"],
  args: ["--disable-blink-features=AutomationControlled"]
};

const allProjects: PlaywrightTestConfig["projects"] = [
  {
    name: "chromium-desktop",
    use: {
      ...devices["Desktop Chrome"],
      browserName: "chromium",
      viewport: { width: 1440, height: 1200 },
      launchOptions: chromeLaunchOptions
    }
  },
  {
    name: "webkit-desktop",
    use: {
      ...devices["Desktop Safari"],
      browserName: "webkit",
      viewport: { width: 1440, height: 1200 },
      launchOptions: { headless }
    }
  },
  {
    name: "ipad-13",
    use: {
      ...devices["iPad Pro 11"],
      launchOptions: { headless }
    }
  }
];

const projects = runAllBrowsers
  ? allProjects
  : allProjects.filter((project) => project?.name === defaultProject);

export default defineConfig({
  testDir: "./tests",
  timeout: 600000,
  expect: { timeout: 10000 },
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    ignoreHTTPSErrors: true,
    trace: "off",
    screenshot: "off"
  },
  projects: projects.length ? projects : [allProjects[0]!]
});
