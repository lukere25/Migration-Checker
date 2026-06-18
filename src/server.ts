import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs-extra";
import {
  applyRequestSettings,
  getAppSettings,
  loadPersistedSettings,
  saveAppSettings
} from "./baseUrls";
import { COMPARISON_MODULES, parseEnabledModulesInput, serializeEnabledModules } from "./comparisonModules";
import { getJob, getActiveJob, getJobWithProgress, isJobInProgress, listRecentRuns, previewSpreadsheet, refreshRunProgress, startRun } from "./runJob";
import { isSpreadsheetFilename } from "./spreadsheetFile";
import { parseHeadlessInput } from "./headless";
import { writePagePdf } from "./reporters/pdfReporter";
import { normalizePath } from "./utils/normalize";

delete process.env.SHEET_NAME;
delete process.env.START_INDEX;

const app = express();
const port = Number(process.env.PORT || 3000);
const uploadRoot = path.join(process.cwd(), ".runs", "uploads");
const reportsRoot = path.join(process.cwd(), "reports");

function toReportPublicUrl(absolutePath: string | undefined): string | undefined {
  if (!absolutePath) return undefined;
  const relative = path.relative(reportsRoot, absolutePath).replace(/\\/g, "/");
  if (!relative || relative.startsWith("..")) return undefined;
  return `/reports/${relative}`;
}

const upload = multer({
  dest: uploadRoot,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!isSpreadsheetFilename(file.originalname)) {
      cb(new Error("Only .xlsx and .xls files are supported"));
      return;
    }
    cb(null, true);
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, _res, next) => {
  if (req.body === undefined) req.body = {};
  next();
});
app.use(express.static(path.join(process.cwd(), "public")));

app.get(/^\/reports\/(.+\/pages\/.+\/report\.pdf)$/, async (req, res, next) => {
  try {
    const relativePath = req.params[0];
    const pdfPath = path.join(process.cwd(), "reports", relativePath);
    const htmlPath = pdfPath.replace(/\.pdf$/, ".html");

    if (!pdfPath.startsWith(path.join(process.cwd(), "reports"))) {
      res.status(403).send("Forbidden");
      return;
    }

    if (await fs.pathExists(pdfPath)) {
      res.sendFile(pdfPath);
      return;
    }

    if (!(await fs.pathExists(htmlPath))) {
      res.status(404).send("Report not found");
      return;
    }

    await writePagePdf(htmlPath, pdfPath);
    res.sendFile(pdfPath);
  } catch (error) {
    next(error);
  }
});

app.use("/reports", express.static(path.join(process.cwd(), "reports")));

function parseOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseEnabledModulesField(body: Record<string, unknown> | undefined): string[] {
  const fields = body ?? {};
  const raw = fields.enabledModules;

  if (raw === undefined || raw === null || raw === "") {
    return parseEnabledModulesInput(undefined);
  }

  const parsed = parseEnabledModulesInput(raw);
  const explicitValues = Array.isArray(raw)
    ? raw.map(String).map((value) => value.trim()).filter(Boolean)
    : String(raw)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

  if (!explicitValues.length || !parsed.length) {
    throw new Error("Select at least one comparison module.");
  }

  return parsed;
}

function parseRunFields(body: Record<string, unknown> | undefined) {
  const fields = body ?? {};
  const rawPageAlias = typeof fields.pageAlias === "string" ? fields.pageAlias.trim() : "";
  const pageAlias = rawPageAlias ? normalizePath(rawPageAlias) || rawPageAlias : "";

  return {
    maxPages: parseOptionalNumber(fields.maxPages),
    headless: parseHeadlessInput(fields.headless),
    liveBaseUrl: typeof fields.liveBaseUrl === "string" ? fields.liveBaseUrl.trim() : "",
    migrationBaseUrl: typeof fields.migrationBaseUrl === "string" ? fields.migrationBaseUrl.trim() : "",
    migrationPassword: typeof fields.migrationPassword === "string" ? fields.migrationPassword : "",
    pageAlias,
    enabledModules: parseEnabledModulesField(body)
  };
}

function applyRunSettings(fields: ReturnType<typeof parseRunFields>): void {
  applyRequestSettings(fields);
}

function handleMulterUpload(fieldName: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    upload.single(fieldName)(req, res, (error) => {
      if (error) {
        handleUploadError(error, res);
        return;
      }

      if (req.body === undefined) req.body = {};
      next();
    });
  };
}

function handleUploadError(error: unknown, res: express.Response): boolean {
  if (error instanceof multer.MulterError) {
    res.status(400).json({ error: error.message });
    return true;
  }

  if (error instanceof Error) {
    res.status(400).json({ error: error.message });
    return true;
  }

  return false;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/modules", (_req, res) => {
  res.json({ modules: COMPARISON_MODULES });
});

app.get("/api/settings", (_req, res) => {
  res.json(getAppSettings());
});

app.put("/api/settings", async (req, res) => {
  try {
    const body = req.body ?? {};
    const current = getAppSettings();
    const patch: Partial<typeof current> = {};

    if (typeof body.liveBaseUrl === "string") patch.liveBaseUrl = body.liveBaseUrl.trim();
    if (typeof body.migrationBaseUrl === "string") patch.migrationBaseUrl = body.migrationBaseUrl.trim();
    if (typeof body.migrationPassword === "string") patch.migrationPassword = body.migrationPassword;
    if (typeof body.jiraAtlassianDomain === "string") {
      patch.jiraAtlassianDomain = body.jiraAtlassianDomain.trim();
    }
    if (typeof body.jiraProjectId === "string") patch.jiraProjectId = body.jiraProjectId.trim();
    if (typeof body.jiraIssueTypeId === "string") patch.jiraIssueTypeId = body.jiraIssueTypeId.trim();
    if (body.enabledModules !== undefined) {
      patch.enabledModules = parseEnabledModulesInput(body.enabledModules);
    }

    const updatingMigration =
      patch.liveBaseUrl !== undefined ||
      patch.migrationBaseUrl !== undefined ||
      patch.migrationPassword !== undefined;

    if (updatingMigration) {
      const liveBaseUrl = patch.liveBaseUrl ?? current.liveBaseUrl;
      const migrationBaseUrl = patch.migrationBaseUrl ?? current.migrationBaseUrl;
      const migrationPassword = patch.migrationPassword ?? current.migrationPassword;

      if (!liveBaseUrl.trim() || !migrationBaseUrl.trim()) {
        res.status(400).json({ error: "Live URL and Migration URL are required" });
        return;
      }

      if (!migrationPassword.trim()) {
        res.status(400).json({ error: "Migration password is required" });
        return;
      }

      patch.liveBaseUrl = liveBaseUrl;
      patch.migrationBaseUrl = migrationBaseUrl;
      patch.migrationPassword = migrationPassword;
    }

    if (!Object.keys(patch).length) {
      res.status(400).json({ error: "No settings provided" });
      return;
    }

    const settings = await saveAppSettings(patch);
    res.json(settings);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/preview", handleMulterUpload("spreadsheet"), async (req, res) => {
  try {
    await fs.ensureDir(uploadRoot);
    const fields = parseRunFields(req.body);
    applyRunSettings(fields);

    if (req.file) {
      const preview = await previewSpreadsheet({
        spreadsheetPath: req.file.path
      });
      await fs.remove(req.file.path).catch(() => undefined);
      res.json(preview);
      return;
    }

    if (fields.pageAlias) {
      const preview = await previewSpreadsheet({ pageAlias: fields.pageAlias });
      res.json(preview);
      return;
    }

    res.status(400).json({ error: "Upload a spreadsheet or enter a page path" });
  } catch (error) {
    if (req.file) await fs.remove(req.file.path).catch(() => undefined);
    if (!handleUploadError(error, res)) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
});

app.post("/api/runs", handleMulterUpload("spreadsheet"), async (req, res) => {
  try {
    await fs.ensureDir(uploadRoot);
    const fields = parseRunFields(req.body);
    applyRunSettings(fields);

    const job = req.file
      ? await startRun({
          uploadedFilePath: req.file.path,
          uploadedFileName: req.file.originalname,
          ...fields
        })
      : fields.pageAlias
        ? await startRun(fields)
        : null;

    if (!job) {
      res.status(400).json({ error: "Upload a spreadsheet or enter a page path" });
      return;
    }

    res.status(202).json({
      id: job.id,
      status: job.status,
      reportsDir: job.reportsDir
    });
  } catch (error) {
    if (req.file) await fs.remove(req.file.path).catch(() => undefined);
    if (handleUploadError(error, res)) return;
    res.status(409).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/runs/active", async (_req, res) => {
  const activeJob = getActiveJob();
  if (!activeJob) {
    res.json({ active: false });
    return;
  }

  await refreshRunProgress(activeJob);

  res.json({
    active: isJobInProgress(activeJob),
    id: activeJob.id,
    status: activeJob.status,
    pageCount: activeJob.pageCount,
    pagesCompleted: activeJob.pagesCompleted ?? 0,
    activePage: activeJob.activePage ?? 0,
    startedAt: activeJob.startedAt,
    summaryUrl: `/reports/${activeJob.id}/summary.html`
  });
});

app.get("/api/runs", async (req, res) => {
  const rawLimit = req.query.limit;
  const limit =
    rawLimit === "all"
      ? 50
      : Math.min(Math.max(Number(rawLimit) || 5, 1), 50);

  const runs = await listRecentRuns(limit);
  res.json(runs);
});

app.get("/api/runs/:id/results", async (req, res) => {
  const summaryPath = path.join(reportsRoot, req.params.id, "summary.json");

  if (!(await fs.pathExists(summaryPath))) {
    res.status(404).json({ error: "Results not ready yet" });
    return;
  }

  try {
    const summary = await fs.readJson(summaryPath);
    const results = (summary.results ?? []).map(
      (result: {
        pageName: string;
        path: string;
        browserName: string;
        overallStatus: string;
        reportPaths?: { html?: string; pdf?: string };
      }) => {
        const htmlUrl = toReportPublicUrl(result.reportPaths?.html);
        const pdfUrl =
          toReportPublicUrl(result.reportPaths?.pdf) ||
          (htmlUrl ? htmlUrl.replace(/index\.html$/, "index.pdf") : undefined);

        return {
          pageName: result.pageName,
          path: result.path,
          browserName: result.browserName,
          overallStatus: result.overallStatus,
          htmlUrl,
          pdfUrl
        };
      }
    );

    res.json({
      generatedAt: summary.generatedAt,
      totals: summary.totals,
      summaryUrl: `/reports/${req.params.id}/summary.html`,
      results
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/runs/:id", async (req, res) => {
  const job = await getJobWithProgress(req.params.id);
  if (!job) {
    res.status(404).json({ error: "Run not found" });
    return;
  }

  res.json({
    id: job.id,
    status: job.status,
    spreadsheetSource: job.spreadsheetSource,
    sheetName: job.sheetName,
    pageCount: job.pageCount,
    pagesCompleted: job.pagesCompleted ?? 0,
    activePage: job.activePage ?? 0,
    maxPages: job.maxPages,
    startIndex: job.startIndex,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    exitCode: job.exitCode,
    error: job.error,
    summaryUrl: `/reports/${job.id}/summary.html`,
    logs: job.logs
  });
});

app.get("/api/runs/:id/events", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "Run not found" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let cursor = 0;
  let lastStatusSignature = "";

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const buildStatusPayload = () => ({
    status: job.status,
    pageCount: job.pageCount,
    pagesCompleted: job.pagesCompleted ?? 0,
    activePage: job.activePage ?? 0,
    error: job.error,
    summaryUrl: `/reports/${job.id}/summary.html`
  });

  const sendStatusIfChanged = () => {
    const payload = buildStatusPayload();
    const signature = JSON.stringify(payload);
    if (signature === lastStatusSignature) return;
    lastStatusSignature = signature;
    sendEvent("status", payload);
  };

  const pushLogs = async () => {
    await refreshRunProgress(job);
    while (cursor < job.logs.length) {
      sendEvent("log", { line: job.logs[cursor] });
      cursor += 1;
    }
    sendStatusIfChanged();
  };

  void pushLogs();
  sendStatusIfChanged();

  const interval = setInterval(() => {
    void pushLogs().then(() => {
      if (job.status === "completed" || job.status === "failed") {
        clearInterval(interval);
        res.end();
      }
    });
  }, 500);

  req.on("close", () => clearInterval(interval));
});

app.listen(port, async () => {
  delete process.env.SHEET_NAME;
  await loadPersistedSettings();
  console.log(`Sync Scope UI running at http://localhost:${port}`);
  console.log("Spreadsheet mode: uploaded file only, first sheet, row 1");
});
