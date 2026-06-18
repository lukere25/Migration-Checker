import path from "path";
import fs from "fs-extra";
import { Browser, Page, test } from "@playwright/test";
import { ensureDevStorageState } from "../src/auth";
import {
  ensureHttps,
  isAccessDeniedPage,
  launchDevSiteBrowser,
  launchLiveSiteBrowser,
  newDevContext,
  newProdContext,
  waitForProdPageContent
} from "../src/browserContext";
import { config } from "../src/config";
import { loadPersistedSettings } from "../src/baseUrls";
import {
  isModuleEnabled,
  normalizeEnabledModuleIds,
  parseEnabledModulesInput
} from "../src/comparisonModules";
import { compareContent } from "../src/comparators/contentComparator";
import { compareHeadings } from "../src/comparators/headingComparator";
import { compareHTagHierarchy } from "../src/comparators/hTagHierarchyComparator";
import { compareImages } from "../src/comparators/imageComparator";
import { checkBrokenLinks } from "../src/comparators/linkComparator";
import { compareMetadata } from "../src/comparators/metadataComparator";
import { compareLanguage } from "../src/comparators/navigationComparator";
import { comparePageSpeed } from "../src/comparators/pageSpeedComparator";
import { compareEmbeds } from "../src/comparators/embedComparator";
import {
  compareDevTechnologies,
  compareServerStack
} from "../src/comparators/techStackComparator";
import { compareSchema } from "../src/comparators/schemaComparator";
import { compareModuleSpacing } from "../src/comparators/spacingComparator";
import { compareTextStyles } from "../src/comparators/textStyleComparator";
import { compareScreenshots } from "../src/comparators/visualComparator";
import { extractContent } from "../src/extractors/contentExtractor";
import { extractHeadings } from "../src/extractors/headingExtractor";
import { extractImages } from "../src/extractors/imageExtractor";
import { extractLanguage } from "../src/extractors/languageExtractor";
import { extractLinks } from "../src/extractors/linkExtractor";
import { extractMetadata, Metadata } from "../src/extractors/metadataExtractor";
import { extractPageSpeed } from "../src/extractors/pageSpeedExtractor";
import { extractEmbeds, emptyEmbedData } from "../src/extractors/embedExtractor";
import { extractTechStack, emptyTechStackData } from "../src/extractors/techStackExtractor";
import { extractSchema, emptySchemaData } from "../src/extractors/schemaExtractor";
import { ModuleSpacingData } from "../src/extractors/spacingExtractor";
import { extractTextStyles } from "../src/extractors/textStyleExtractor";
import { readPageMappingsFromFile, resolveSpreadsheetPath } from "../src/readExcel";
import { resolveReportPageDir } from "../src/urlMapper";
import { writeSummaryCsv } from "../src/reporters/csvReporter";
import { writePageHtml, writeSummaryHtml } from "../src/reporters/htmlReporter";
import { writePageJson, writeSummaryJson } from "../src/reporters/jsonReporter";
import { writePagePdf } from "../src/reporters/pdfReporter";
import { buildBrokenLinksSummary, buildMetadataSummary } from "../src/reporters/reportSummaries";
import { PageReport, SummaryReport } from "../src/reporters/reportTypes";
import { captureFullPageScreenshot } from "../src/screenshots";
import { captureModuleSpacingScreenshots } from "../src/spacingScreenshots";
import { ensureDir } from "../src/utils/fileUtils";
import { logger } from "../src/utils/logger";
import { combineOverall, CategoryResult, Issue, statusFromIssues } from "../src/utils/status";

type Source = "prod" | "dev";

interface CaptureState {
  networkIssues: Issue[];
  documentHeaders: Record<string, string>;
}

interface ExtractedPage {
  metadata: Awaited<ReturnType<typeof extractMetadata>>;
  headings: Awaited<ReturnType<typeof extractHeadings>>;
  textStyles: Awaited<ReturnType<typeof extractTextStyles>>;
  pageSpeed: Awaited<ReturnType<typeof extractPageSpeed>>;
  content: Awaited<ReturnType<typeof extractContent>>;
  images: Awaited<ReturnType<typeof extractImages>>;
  links: Awaited<ReturnType<typeof extractLinks>>;
  language: Awaited<ReturnType<typeof extractLanguage>>;
  schema: Awaited<ReturnType<typeof extractSchema>>;
  embeds: Awaited<ReturnType<typeof extractEmbeds>>;
  techStack: Awaited<ReturnType<typeof extractTechStack>>;
  capture: CaptureState;
}

const excelPath = resolveSpreadsheetPath(process.env.EXCEL_PATH);
const pageMappings = readPageMappingsFromFile(excelPath, { maxPages: config.maxPages });
const runResults: PageReport[] = [];
let sharedLiveBrowser: Browser | null = null;
let sharedDevBrowser: Browser | null = null;
let devStorageState = "";
const enabledModules = new Set(parseEnabledModulesInput(process.env.ENABLED_MODULES));
const enabledModuleList = normalizeEnabledModuleIds([...enabledModules]);

const emptyMetadata: Metadata = {
  title: "",
  description: "",
  canonical: "",
  robots: "",
  keywords: "",
  openGraph: {},
  twitter: {},
  hreflang: [],
  allMeta: []
};

function emitRunProgress(phase: "started" | "completed" | "finishing", pageNum: number, pageTotal: number): void {
  const line = `[migration-progress] ${phase} ${pageNum}/${pageTotal}`;
  process.stdout.write(`${line}\n`);

  const progressFile = process.env.RUN_PROGRESS_FILE;
  if (!progressFile) return;

  fs.writeJsonSync(
    progressFile,
    {
      phase,
      pageNum,
      pageTotal,
      updatedAt: new Date().toISOString()
    },
    { spaces: 0 }
  );
}

function moduleEnabled(moduleId: string): boolean {
  return isModuleEnabled(moduleId, enabledModules);
}

function toReportRelativePath(pageDir: string, filePath: string): string {
  return path.relative(pageDir, filePath).split(path.sep).join("/");
}

function normalizeSpacingPaths(data: ModuleSpacingData, pageDir: string): ModuleSpacingData {
  const rel = (filePath?: string) => (filePath ? toReportRelativePath(pageDir, filePath) : undefined);

  return {
    ...data,
    overviewProdScreenshot: rel(data.overviewProdScreenshot),
    overviewDevScreenshot: rel(data.overviewDevScreenshot),
    gaps: data.gaps.map((gap) => ({
      ...gap,
      prodScreenshot: rel(gap.prodScreenshot),
      devScreenshot: rel(gap.devScreenshot)
    }))
  };
}

function categoryFromIssues(category: string, issues: Issue[]): CategoryResult {
  return statusFromIssues(issues, `${category} checks pass`);
}

function attachIssueCapture(page: Page, source: Source, pageUrl: string): CaptureState {
  const capture: CaptureState = { networkIssues: [], documentHeaders: {} };
  const targetUrl = pageUrl.split("#")[0];

  page.on("response", (response) => {
    if (response.request().resourceType() !== "document") return;
    const responseUrl = response.url().split("#")[0];
    if (responseUrl !== targetUrl && !responseUrl.startsWith(`${targetUrl}/`)) return;
    capture.documentHeaders = { ...capture.documentHeaders, ...response.headers() };
  });

  page.on("requestfailed", (request) => {
    capture.networkIssues.push({
      severity: "WARNING",
      category: "Network",
      source,
      message: `Request failed: ${request.failure()?.errorText || "unknown error"}`,
      url: request.url()
    });
  });

  return capture;
}

async function closeCookieBanners(page: Page): Promise<void> {
  const selectors = [
    'button:has-text("Accept")',
    'button:has-text("Accept all")',
    'button:has-text("Agree")',
    'button:has-text("I agree")',
    'button:has-text("Got it")',
    '[aria-label*="accept" i]'
  ];

  for (const selector of selectors) {
    const button = page.locator(selector).first();
    if (await button.isVisible({ timeout: 1000 }).catch(() => false)) {
      await button.click({ timeout: 2000 }).catch(() => undefined);
      await page.waitForTimeout(500).catch(() => undefined);
      break;
    }
  }
}

async function unlockDevPasswordGate(page: Page): Promise<void> {
  const passwordInput = page
    .locator('input[type="password"], input[name="password"], input[placeholder*="password" i]')
    .first();

  if (!(await passwordInput.isVisible({ timeout: 2000 }).catch(() => false))) return;

  await passwordInput.fill(config.devPassword);

  const submitSelectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Submit")',
    'button:has-text("Enter")',
    'button:has-text("Visit")',
    'button:has-text("Unlock")'
  ];

  for (const selector of submitSelectors) {
    const button = page.locator(selector).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click().catch(() => undefined);
      break;
    }
  }

  await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => undefined);
}

async function loadProdPage(page: Page, url: string, capture: CaptureState): Promise<void> {
  await page
    .goto(ensureHttps(url), { waitUntil: "domcontentloaded", timeout: 60000 })
    .catch((error: Error) => {
      capture.networkIssues.push({
        severity: "FAIL",
        category: "Page load",
        source: "prod",
        message: error.message,
        url
      });
    });

  if (await isAccessDeniedPage(page)) {
    capture.networkIssues.push({
      severity: "FAIL",
      category: "Page load",
      source: "prod",
      message: "Access denied on live site",
      url
    });
    return;
  }

  await waitForProdPageContent(page);
  await closeCookieBanners(page);
}

async function loadAndExtract(page: Page, url: string, source: Source): Promise<ExtractedPage> {
  const capture = attachIssueCapture(page, source, url);
  const loadStartedAt = Date.now();

  if (source === "prod") {
    await loadProdPage(page, url, capture);
  } else {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }).catch((error: Error) => {
      capture.networkIssues.push({
        severity: "FAIL",
        category: "Page load",
        source: "dev",
        message: error.message,
        url
      });
    });

    const devHost = new URL(config.devBaseUrl).host;
    const pageHost = new URL(url).host;
    if (pageHost === devHost) {
      await unlockDevPasswordGate(page);
      if (page.url() !== url) {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }).catch((error: Error) => {
          capture.networkIssues.push({
            severity: "FAIL",
            category: "Page load",
            source: "dev",
            message: error.message,
            url
          });
        });
      }
    }

    await page.waitForTimeout(300);
    await closeCookieBanners(page);
  }

  if (moduleEnabled("pageSpeed")) {
    await page.waitForLoadState("load", { timeout: 15000 }).catch(() => undefined);
  }

  const pageSpeed = moduleEnabled("pageSpeed")
    ? await extractPageSpeed(page, Date.now() - loadStartedAt)
    : {
        wallClockMs: Date.now() - loadStartedAt,
        domContentLoadedMs: 0,
        loadCompleteMs: 0,
        ttfbMs: 0,
        transferSizeBytes: 0
      };

  const needHeadings = moduleEnabled("headings") || moduleEnabled("hTagHierarchy");
  const needTechStack = moduleEnabled("devTechnologies") || moduleEnabled("serverComparison");

  const [metadata, headings, textStyles, content, images, links, language, schema, embeds, techStack] =
    await Promise.all([
    moduleEnabled("metadata") ? extractMetadata(page) : Promise.resolve(emptyMetadata),
    needHeadings ? extractHeadings(page) : Promise.resolve([]),
    moduleEnabled("textStyle") ? extractTextStyles(page) : Promise.resolve([]),
    moduleEnabled("content") ? extractContent(page) : Promise.resolve({ text: "", length: 0 }),
    moduleEnabled("images") ? extractImages(page) : Promise.resolve([]),
    moduleEnabled("brokenLinks") ? extractLinks(page) : Promise.resolve([]),
    moduleEnabled("language") ? extractLanguage(page) : Promise.resolve({ htmlLang: "", hreflang: [], placeholders: [] }),
    moduleEnabled("schema") ? extractSchema(page) : Promise.resolve(emptySchemaData()),
    moduleEnabled("embeds") ? extractEmbeds(page) : Promise.resolve(emptyEmbedData()),
    needTechStack ? extractTechStack(page, capture.documentHeaders) : Promise.resolve(emptyTechStackData())
  ]);

  return {
    metadata,
    headings,
    textStyles,
    pageSpeed,
    content,
    images,
    links,
    language,
    schema,
    embeds,
    techStack,
    capture
  };
}

function buildSummary(results: PageReport[]): SummaryReport {
  const totals = {
    totalPages: new Set(results.map((result) => result.path)).size,
    totalBrowserRuns: results.length,
    passed: 0,
    failed: 0,
    warning: 0,
    skipped: 0
  };

  for (const result of results) {
    if (result.overallStatus === "PASS") totals.passed += 1;
    else if (result.overallStatus === "FAIL") totals.failed += 1;
    else if (result.overallStatus === "WARNING") totals.warning += 1;
    else totals.skipped += 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    totals,
    results,
    metadataSummary: buildMetadataSummary(results),
    brokenLinksSummary: buildBrokenLinksSummary(results)
  };
}

test.beforeAll(async () => {
  await loadPersistedSettings();

  if (!pageMappings.length) {
    throw new Error("No page mappings loaded. Check the selected sheet and spreadsheet columns.");
  }

  await ensureDir(config.reportsDir);
  logger.info(`Loaded ${pageMappings.length} page(s) for comparison`);
  if (process.env.AUTH_ALREADY_DONE === "true") {
    devStorageState = config.authStoragePath;
    logger.info("Using migration auth from run setup");
  } else {
    logger.info("Ensuring migration site authentication...");
    devStorageState = await ensureDevStorageState();
  }
  logger.info("Launching browsers...");
  sharedLiveBrowser = await launchLiveSiteBrowser();
  sharedDevBrowser = await launchDevSiteBrowser();
  logger.info("Browsers ready");
});

test.afterAll(async () => {
  const pageTotal = pageMappings.length;

  async function closeBrowserSafe(browser: Browser | null): Promise<void> {
    if (!browser) return;
    await Promise.race([
      browser.close(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("browser close timeout")), 15000))
    ]).catch(() => undefined);
  }

  if (pageTotal > 0) {
    emitRunProgress("finishing", pageTotal, pageTotal);
  }

  await closeBrowserSafe(sharedDevBrowser);
  sharedDevBrowser = null;
  await closeBrowserSafe(sharedLiveBrowser);
  sharedLiveBrowser = null;

  if (!runResults.length) return;

  const summary = buildSummary(runResults);
  await writeSummaryJson(summary);
  await writeSummaryHtml(summary);
  await writeSummaryCsv(summary);
  logger.info(`Wrote summary for ${runResults.length} browser run(s) to ${config.reportsDir}`);
});

for (const [index, mapping] of pageMappings.entries()) {
  const testLabel = `${String(index + 1).padStart(3, "0")} ${mapping.pageName} [${mapping.path}] migration comparison`;

  test(testLabel, async ({}, testInfo) => {
    if (!sharedLiveBrowser || !sharedDevBrowser) {
      throw new Error("Browsers are not ready.");
    }

    const pageNum = index + 1;
    const pageTotal = pageMappings.length;
    emitRunProgress("started", pageNum, pageTotal);

    const browserName = testInfo.project.name;
    const viewport = testInfo.project.use.viewport ?? { width: 1440, height: 1200 };
    const isMobile = Boolean(testInfo.project.use.isMobile);
    const hasTouch = Boolean(testInfo.project.use.hasTouch ?? isMobile);
    const pageDir = resolveReportPageDir(config.reportsDir, mapping.path);
    await ensureDir(pageDir);

    const prodScreenshot = path.join(pageDir, "prod.png");
    const devScreenshot = path.join(pageDir, "dev.png");
    const diffScreenshot = path.join(pageDir, "diff.png");

    const prodContext = await newProdContext(sharedLiveBrowser, { viewport, isMobile, hasTouch });
    const devContext = await newDevContext(sharedDevBrowser, devStorageState, viewport, { isMobile, hasTouch });
    const prodPage = await prodContext.newPage();
    const devPage = await devContext.newPage();

    try {
      const [prodData, devData] = await Promise.all([
        loadAndExtract(prodPage, mapping.prodUrl, "prod"),
        loadAndExtract(devPage, mapping.devUrl, "dev")
      ]);

      const categories: Record<string, CategoryResult> = {};

      if (moduleEnabled("metadata")) {
        categories.metadata = compareMetadata(prodData.metadata, devData.metadata);
      }
      if (moduleEnabled("schema")) {
        categories.schema = compareSchema(prodData.schema, devData.schema);
      }
      if (moduleEnabled("embeds")) {
        categories.embeds = compareEmbeds(prodData.embeds, devData.embeds);
      }
      if (moduleEnabled("devTechnologies")) {
        categories.devTechnologies = compareDevTechnologies(prodData.techStack, devData.techStack);
      }
      if (moduleEnabled("serverComparison")) {
        categories.serverComparison = compareServerStack(prodData.techStack, devData.techStack);
      }
      if (moduleEnabled("headings")) {
        categories.headings = compareHeadings(prodData.headings, devData.headings);
      }
      if (moduleEnabled("hTagHierarchy")) {
        categories.hTagHierarchy = compareHTagHierarchy(prodData.headings, devData.headings);
      }
      if (moduleEnabled("textStyle")) {
        categories.textStyle = compareTextStyles(prodData.textStyles, devData.textStyles);
      }
      if (moduleEnabled("pageSpeed")) {
        categories.pageSpeed = comparePageSpeed(prodData.pageSpeed, devData.pageSpeed);
      }
      if (moduleEnabled("content")) {
        categories.content = compareContent(prodData.content, devData.content);
      }
      if (moduleEnabled("images")) {
        categories.images = compareImages(prodData.images, devData.images);
      }
      if (moduleEnabled("brokenLinks")) {
        const brokenLinkIssues = (
          await Promise.all([
            checkBrokenLinks(prodData.links, prodContext.request, "prod", config.prodBaseUrl),
            checkBrokenLinks(devData.links, devContext.request, "dev", config.devBaseUrl)
          ])
        ).flat();
        categories.brokenLinks = categoryFromIssues("Broken links", brokenLinkIssues);
      }
      if (moduleEnabled("language")) {
        categories.language = compareLanguage(prodData.language, devData.language);
      }
      if (moduleEnabled("moduleSpacing")) {
        const spacingDir = path.join(pageDir, "spacing");
        const captured = await captureModuleSpacingScreenshots(prodPage, devPage, spacingDir);
        const prodSpacing = normalizeSpacingPaths(captured.prod, pageDir);
        const devSpacing = normalizeSpacingPaths(captured.dev, pageDir);
        categories.moduleSpacing = compareModuleSpacing(prodSpacing, devSpacing);
      }
      if (moduleEnabled("visual")) {
        await Promise.all([
          captureFullPageScreenshot(prodPage, prodScreenshot),
          captureFullPageScreenshot(devPage, devScreenshot)
        ]);
        categories.visual = await compareScreenshots(prodScreenshot, devScreenshot, diffScreenshot);
      }

      const allIssues = Object.values(categories).flatMap((category) => category.issues);
      const blockingIssues = allIssues.filter((issue) => issue.severity === "FAIL");
      const warnings = allIssues.filter((issue) => issue.severity === "WARNING");
      const overallStatus = combineOverall(Object.values(categories).map((category) => category.status));

      const report: PageReport = {
        pageName: mapping.pageName,
        prodUrl: mapping.prodUrl,
        devUrl: mapping.devUrl,
        path: mapping.path,
        browserName,
        overallStatus,
        testedAt: new Date().toISOString(),
        categories,
        issues: allIssues,
        blockingIssues,
        warnings,
        screenshots: {
          prod: prodScreenshot,
          dev: devScreenshot,
          diff: diffScreenshot
        },
        reportPaths: {
          html: path.join(pageDir, "index.html"),
          json: path.join(pageDir, "index.json"),
          pdf: path.join(pageDir, "index.pdf")
        },
        mapping,
        enabledModules: enabledModuleList
      };

      await Promise.all([writePageHtml(report), writePageJson(report)]);
      if (config.generatePdf) {
        try {
          await writePagePdf(report.reportPaths.html, report.reportPaths.pdf!);
        } catch (error) {
          logger.warn(`PDF generation skipped: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      runResults.push(report);
      emitRunProgress("completed", pageNum, pageTotal);
    } finally {
      await prodPage.close().catch(() => undefined);
      await devPage.close().catch(() => undefined);
      await prodContext.close().catch(() => undefined);
      await devContext.close().catch(() => undefined);
    }
  });
}
