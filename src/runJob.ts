import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import fs from "fs-extra";
import path from "path";
import { downloadSpreadsheet } from "./spreadsheetUrl";
import { assertValidSpreadsheetFile } from "./spreadsheetFile";
import {
  describeSpreadsheetParse,
  readPageMappingsFromFile,
  readWorkbookSheetNames
} from "./readExcel";
import { ensureDevStorageState } from "./auth";
import { config } from "./config";
import { normalizeEnabledModuleIds, serializeEnabledModules } from "./comparisonModules";
import { createPageMapping } from "./urlMapper";
import { writeSinglePageSpreadsheet } from "./singlePage";
import { logger } from "./utils/logger";

delete process.env.SHEET_NAME;
delete process.env.START_INDEX;

export type RunStatus = "queued" | "downloading" | "authenticating" | "running" | "completed" | "failed";

export interface RunJob {
  id: string;
  spreadsheetSource: string;
  sheetName?: string;
  maxPages?: number;
  startIndex: number;
  headless: boolean;
  enabledModules: string[];
  status: RunStatus;
  logs: string[];
  pageCount?: number;
  pagesCompleted?: number;
  reportsDir: string;
  spreadsheetPath: string;
  uploadedFilePath?: string;
  startedAt: string;
  finishedAt?: string;
  exitCode?: number;
  error?: string;
}

const jobs = new Map<string, RunJob>();
let activeJobId: string | null = null;
let activePlaywrightProcess: ChildProcessWithoutNullStreams | null = null;

const inProgressStatuses: RunStatus[] = ["queued", "downloading", "authenticating", "running"];

function isPlaywrightProcessRunning(): boolean {
  return (
    activePlaywrightProcess !== null &&
    activePlaywrightProcess.exitCode === null &&
    activePlaywrightProcess.signalCode === null &&
    !activePlaywrightProcess.killed
  );
}

function recoverStaleActiveJob(): void {
  if (!activeJobId) return;

  const job = jobs.get(activeJobId);
  if (!job || job.status === "completed" || job.status === "failed") {
    activeJobId = null;
    activePlaywrightProcess = null;
    return;
  }

  if (job.status === "running" && !isPlaywrightProcessRunning()) {
    job.status = "failed";
    job.finishedAt = new Date().toISOString();
    job.error = "Run stopped unexpectedly. You can start a new comparison.";
    appendLog(job, job.error);
    activeJobId = null;
    activePlaywrightProcess = null;
  }
}

export function getActiveJob(): RunJob | undefined {
  recoverStaleActiveJob();
  return activeJobId ? jobs.get(activeJobId) : undefined;
}

export function isJobInProgress(job: RunJob): boolean {
  return inProgressStatuses.includes(job.status);
}

function appendLog(job: RunJob, line: string): void {
  job.logs.push(line);
  if (job.logs.length > 5000) job.logs.shift();
}

function trackRunProgressFromLog(job: RunJob, line: string): void {
  if (!/migration-comparison\.spec\.ts/.test(line)) return;
  if (!/^\s*[✓×]/.test(line)) return;

  const total = job.pageCount ?? 0;
  const next = (job.pagesCompleted ?? 0) + 1;
  job.pagesCompleted = total > 0 ? Math.min(next, total) : next;
}

function createRunId(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `run-${stamp}`;
}

export function getJob(runId: string): RunJob | undefined {
  return jobs.get(runId);
}

export function listJobs(): RunJob[] {
  return [...jobs.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function startRun(options: {
  spreadsheetUrl?: string;
  uploadedFilePath?: string;
  uploadedFileName?: string;
  pageAlias?: string;
  maxPages?: number;
  headless?: boolean;
  enabledModules?: string[];
}): Promise<RunJob> {
  recoverStaleActiveJob();

  if (activeJobId) {
    const activeJob = jobs.get(activeJobId);
    throw new Error(
      activeJob
        ? `A migration run is already in progress (${activeJob.id}, status: ${activeJob.status}). Scroll down to the run panel or wait for it to finish.`
        : "A migration run is already in progress. Wait for it to finish before starting another."
    );
  }

  const hasUrl = Boolean(options.spreadsheetUrl?.trim());
  const hasUpload = Boolean(options.uploadedFilePath);
  const hasSinglePage = Boolean(options.pageAlias?.trim());

  if (!hasUrl && !hasUpload && !hasSinglePage) {
    throw new Error("Upload a spreadsheet or enter a page path");
  }

  const id = createRunId();
  const runsRoot = path.join(process.cwd(), ".runs", id);
  const reportsDir = path.join(process.cwd(), "reports", id);
  const spreadsheetPath = path.join(runsRoot, "spreadsheet.xlsx");

  const job: RunJob = {
    id,
    spreadsheetSource: hasUpload
      ? options.uploadedFileName || path.basename(options.uploadedFilePath!)
      : hasSinglePage
        ? options.pageAlias!.trim()
        : options.spreadsheetUrl!.trim(),
    maxPages: hasSinglePage ? 1 : options.maxPages,
    startIndex: 1,
    headless: options.headless ?? true,
    enabledModules: normalizeEnabledModuleIds(options.enabledModules),
    status: "queued",
    logs: [],
    reportsDir,
    spreadsheetPath,
    uploadedFilePath: options.uploadedFilePath,
    startedAt: new Date().toISOString()
  };

  jobs.set(id, job);
  activeJobId = id;
  void executeJob(job, {
    spreadsheetUrl: hasUrl ? options.spreadsheetUrl!.trim() : undefined,
    pageAlias: hasSinglePage ? options.pageAlias!.trim() : undefined
  });
  return job;
}

async function prepareSpreadsheet(
  job: RunJob,
  sources: { spreadsheetUrl?: string; pageAlias?: string }
): Promise<void> {
  await fs.ensureDir(path.dirname(job.spreadsheetPath));

  if (job.uploadedFilePath) {
    job.status = "downloading";
    appendLog(job, "Saving uploaded spreadsheet...");
    await assertValidSpreadsheetFile(job.uploadedFilePath);
    await fs.move(job.uploadedFilePath, job.spreadsheetPath, { overwrite: true });
    appendLog(job, `Saved uploaded spreadsheet to ${job.spreadsheetPath}`);
    return;
  }

  if (sources.pageAlias) {
    job.status = "downloading";
    appendLog(job, `Single URL mode: preparing check for ${sources.pageAlias}`);
    await writeSinglePageSpreadsheet(job.spreadsheetPath, sources.pageAlias);
    appendLog(job, "Single page ready for comparison");
    return;
  }

  job.status = "downloading";
  appendLog(job, "Downloading spreadsheet...");
  await downloadSpreadsheet(sources.spreadsheetUrl!, job.spreadsheetPath);
  appendLog(job, `Saved spreadsheet to ${job.spreadsheetPath}`);
}

async function executeJob(
  job: RunJob,
  sources: { spreadsheetUrl?: string; pageAlias?: string }
): Promise<void> {
  try {
    await prepareSpreadsheet(job, sources);

    const resolvedSheet = readWorkbookSheetNames(job.spreadsheetPath);
    job.sheetName = resolvedSheet.sheetName;
    job.startIndex = 1;
    appendLog(job, `Using first sheet "${resolvedSheet.sheetName}" from row 1`);

    const mappings = readPageMappingsFromFile(job.spreadsheetPath, {
      startIndex: 1,
      maxPages: job.maxPages
    });
    job.pageCount = mappings.length;
    appendLog(job, `Found ${mappings.length} page(s) to compare`);

    if (!mappings.length) {
      throw new Error(
        `No valid page rows found on sheet "${job.sheetName}". ${describeSpreadsheetParse(job.spreadsheetPath)}`
      );
    }

    const firstMapping = mappings[0];
    appendLog(job, `Live URL: ${firstMapping.prodUrl}`);
    appendLog(job, `Migration URL: ${firstMapping.devUrl}`);
    appendLog(job, `Enabled modules: ${job.enabledModules.join(", ")}`);

    job.status = "authenticating";
    appendLog(job, "Ensuring migration site authentication...");
    process.env.PLAYWRIGHT_HEADLESS = job.headless ? "true" : "false";
    process.env.DEV_PASSWORD = config.devPassword;
    await ensureDevStorageState();
    appendLog(job, "Migration authentication ready");

    await fs.ensureDir(job.reportsDir);
    await ensurePlaywrightBrowsers(job);
    job.status = "running";
    job.pagesCompleted = 0;
    appendLog(job, "Launching browsers and comparing pages (this can take 30–90 seconds per page)...");

    const exitCode = await runPlaywright(job);
    job.exitCode = exitCode;
    job.finishedAt = new Date().toISOString();

    if (exitCode === 0) {
      job.status = "completed";
      if (job.pageCount) job.pagesCompleted = job.pageCount;
      appendLog(job, "Migration comparison completed successfully");
    } else if (await runHasSummaryResults(job.reportsDir)) {
      job.status = "completed";
      job.error =
        exitCode === 1 && job.logs.some((line) => /timeout/i.test(line))
          ? `Some pages timed out, but ${job.pagesCompleted ?? "partial"} report(s) were saved. Open the summary.`
          : `Playwright exited with code ${exitCode}, but page reports were saved. Open the summary.`;
      appendLog(job, job.error);
    } else {
      job.status = "failed";
      const tail = job.logs.slice(-12).join(" ");
      job.error = /timeout/i.test(tail)
        ? `Playwright timed out (exit ${exitCode}). Large pages with Visual + Broken links can take several minutes — try fewer pages or disable heavy modules.`
        : tail.includes("Executable doesn't exist")
          ? `Playwright browsers missing (exit ${exitCode}). Run: npm run install:browsers`
          : /failed|Error/i.test(tail)
            ? `Playwright run failed (exit ${exitCode}). See the log above for the failing step.`
            : `Playwright exited with code ${exitCode}. Check the log above for details.`;
      appendLog(job, job.error);
    }
  } catch (error) {
    job.status = "failed";
    job.finishedAt = new Date().toISOString();
    job.error = error instanceof Error ? error.message : String(error);
    appendLog(job, `Error: ${job.error}`);
    logger.error(job.error);
  } finally {
    if (activeJobId === job.id) {
      activeJobId = null;
    }
    activePlaywrightProcess = null;
  }
}

function runCommand(job: RunJob, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const env = buildRunEnv(job);
    const child = spawn("npx", args, {
      cwd: process.cwd(),
      env,
      shell: process.platform === "win32"
    });

    child.stdout.on("data", (chunk: Buffer) => {
      chunk
        .toString()
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((line) => appendLog(job, line));
    });

    child.stderr.on("data", (chunk: Buffer) => {
      chunk
        .toString()
        .split(/\r?\n/)
        .filter(Boolean)
        .filter((line) => !isIgnorableStderrLine(line))
        .forEach((line) => appendLog(job, `[stderr] ${line}`));
    });

    child.on("error", (error) => reject(error));
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function ensurePlaywrightBrowsers(job: RunJob): Promise<void> {
  const installArgs =
    process.env.PLAYWRIGHT_ALL_BROWSERS === "true"
      ? ["playwright", "install", "chromium", "webkit", "chrome"]
      : ["playwright", "install", "chromium", "chrome"];
  appendLog(job, `Checking Playwright browsers (${installArgs.slice(2).join(", ")})...`);
  const exitCode = await runCommand(job, installArgs);
  if (exitCode !== 0) {
    throw new Error(
      "Failed to install Playwright browsers. Run manually: npm run install:browsers"
    );
  }
  appendLog(job, "Playwright browsers ready");
}

function buildRunEnv(job: RunJob): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };

  delete env.SHEET_NAME;
  delete env.START_INDEX;
  delete env.FORCE_COLOR;
  env.NO_COLOR = "1";

  env.EXCEL_PATH = job.spreadsheetPath;
  env.REPORTS_DIR = job.reportsDir;
  env.PLAYWRIGHT_HEADLESS = job.headless ? "true" : "false";

  if (job.maxPages) {
    env.MAX_PAGES = String(job.maxPages);
  } else {
    delete env.MAX_PAGES;
  }

  env.PROD_BASE_URL = config.prodBaseUrl;
  env.DEV_BASE_URL = config.devBaseUrl;
  env.DEV_PASSWORD = config.devPassword;
  env.ENABLED_MODULES = serializeEnabledModules(job.enabledModules);

  return env;
}

function isIgnorableStderrLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  return /NO_COLOR|FORCE_COLOR|trace-warnings/i.test(trimmed);
}

async function runHasSummaryResults(reportsDir: string): Promise<boolean> {
  const summaryPath = path.join(reportsDir, "summary.json");
  if (!(await fs.pathExists(summaryPath))) return false;
  try {
    const summary = await fs.readJson(summaryPath);
    return Array.isArray(summary.results) && summary.results.length > 0;
  } catch {
    return false;
  }
}

function runPlaywright(job: RunJob): Promise<number> {
  return new Promise((resolve, reject) => {
    const env = buildRunEnv(job);
    appendLog(job, `Running Playwright comparison for ${job.pageCount ?? 1} page(s)...`);

    const playwrightArgs = [
      "playwright",
      "test",
      "tests/migration-comparison.spec.ts",
      `--project=${config.defaultPlaywrightProject}`
    ];
    if (process.env.PLAYWRIGHT_ALL_BROWSERS === "true") {
      playwrightArgs.pop();
    }

    const child = spawn("npx", playwrightArgs, {
      cwd: process.cwd(),
      env,
      shell: process.platform === "win32"
    });

    activePlaywrightProcess = child;

    child.on("close", () => {
      if (activePlaywrightProcess === child) {
        activePlaywrightProcess = null;
      }
    });

    child.stdout.on("data", (chunk: Buffer) => {
      chunk
        .toString()
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((line) => {
          trackRunProgressFromLog(job, line);
          appendLog(job, line);
        });
    });

    child.stderr.on("data", (chunk: Buffer) => {
      chunk
        .toString()
        .split(/\r?\n/)
        .filter(Boolean)
        .filter((line) => !isIgnorableStderrLine(line))
        .forEach((line) => appendLog(job, `[stderr] ${line}`));
    });

    child.on("error", (error) => reject(error));
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function previewFromPath(
  spreadsheetPath: string
): Promise<SpreadsheetPreview> {
  await assertValidSpreadsheetFile(spreadsheetPath);

  const { sheetNames, sheetName: resolvedSheetName } = readWorkbookSheetNames(spreadsheetPath);
  const mappings = readPageMappingsFromFile(spreadsheetPath, { startIndex: 1 });

  return {
    pageCount: mappings.length,
    sheetNames,
    sheetName: resolvedSheetName,
    liveBaseUrl: config.prodBaseUrl,
    migrationBaseUrl: config.devBaseUrl,
    samplePages: mappings.slice(0, 5).map((mapping) => ({
      pageName: mapping.pageName,
      path: mapping.path,
      liveUrl: mapping.prodUrl,
      migrationUrl: mapping.devUrl
    }))
  };
}

export interface SpreadsheetPreview {
  pageCount: number;
  sheetNames: string[];
  sheetName: string;
  liveBaseUrl: string;
  migrationBaseUrl: string;
  samplePages: Array<{
    pageName: string;
    path: string;
    liveUrl: string;
    migrationUrl: string;
  }>;
}

function previewSinglePage(pageAlias: string): SpreadsheetPreview {
  const mapping = createPageMapping({ path: pageAlias });
  if (!mapping) {
    throw new Error(`Invalid page path or URL: "${pageAlias}"`);
  }

  return {
    pageCount: 1,
    sheetNames: ["Pages"],
    sheetName: "Pages",
    liveBaseUrl: config.prodBaseUrl,
    migrationBaseUrl: config.devBaseUrl,
    samplePages: [
      {
        pageName: mapping.pageName,
        path: mapping.path,
        liveUrl: mapping.prodUrl,
        migrationUrl: mapping.devUrl
      }
    ]
  };
}

export async function previewSpreadsheet(options: {
  spreadsheetUrl?: string;
  spreadsheetPath?: string;
  pageAlias?: string;
}): Promise<SpreadsheetPreview> {
  if (options.pageAlias?.trim()) {
    return previewSinglePage(options.pageAlias.trim());
  }

  if (options.spreadsheetPath) {
    return previewFromPath(options.spreadsheetPath);
  }

  if (!options.spreadsheetUrl?.trim()) {
    throw new Error("Upload a spreadsheet or enter a page path");
  }

  const tempDir = path.join(process.cwd(), ".runs", "preview");
  const tempPath = path.join(tempDir, "preview.xlsx");
  await fs.ensureDir(tempDir);
  await downloadSpreadsheet(options.spreadsheetUrl, tempPath);

  return previewFromPath(tempPath);
}
