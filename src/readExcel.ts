import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { config } from "./config";
import { createPageMapping, dedupeMappings, looksLikePathOrUrl, PageMapping } from "./urlMapper";
import { logger } from "./utils/logger";

const columnAliases = {
  pageName: ["page", "page name", "name", "title", "page title"],
  path: [
    "path",
    "slug",
    "url path",
    "url alias",
    "alias",
    "url",
    "page url",
    "page path",
    "link",
    "route",
    "pathname",
    "page alias",
    "relative url",
    "relative path",
    "site path",
    "web path",
    "uri",
    "address",
    "page link",
    "hyperlink",
    "path alias",
    "url slug"
  ],
  prodUrl: ["prod url", "production url", "production", "prod", "live url", "live"],
  devUrl: ["dev url", "development url", "development", "dev", "migration url", "migration", "staging url", "staging"]
};

const allKnownHeaders = [
  ...columnAliases.pageName,
  ...columnAliases.path,
  ...columnAliases.prodUrl,
  ...columnAliases.devUrl
];

function normalizeHeader(header: string): string {
  return String(header)
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function findColumnExact(headers: string[], aliases: string[]): string | undefined {
  const normalizedAliases = aliases.map(normalizeHeader);
  return headers.find((header) => normalizedAliases.includes(normalizeHeader(header)));
}

function findColumnFuzzy(headers: string[], aliases: string[]): string | undefined {
  const normalizedAliases = [...aliases.map(normalizeHeader)].sort((a, b) => b.length - a.length);

  for (const alias of normalizedAliases) {
    const match = headers.find((header) => {
      const normalized = normalizeHeader(header);
      return normalized.includes(alias) || alias.includes(normalized);
    });
    if (match) return match;
  }

  return undefined;
}

function findColumn(headers: string[], aliases: string[], usedColumns: Set<string>): string | undefined {
  const available = headers.filter((header) => !usedColumns.has(header));
  const exact = findColumnExact(available, aliases);
  if (exact) return exact;
  return findColumnFuzzy(available, aliases);
}

function headerScore(cell: string): number {
  const normalized = normalizeHeader(cell);
  if (!normalized) return 0;

  if (allKnownHeaders.includes(normalized)) return 4;

  if (allKnownHeaders.some((alias) => normalized.includes(alias) || alias.includes(normalized))) {
    return 3;
  }

  if (/url|path|alias|page|link|slug|route|uri|address/i.test(normalized)) return 2;
  return 0;
}

function extractSheetRows(worksheet: XLSX.WorkSheet): {
  headers: string[];
  rows: Record<string, unknown>[];
  headerRowIndex: number;
} {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "" }) as unknown[][];
  if (!matrix.length) return { headers: [], rows: [], headerRowIndex: 0 };

  let headerRowIndex = 0;
  let bestScore = -1;

  for (let index = 0; index < Math.min(matrix.length, 20); index += 1) {
    const row = matrix[index].map((cell) => String(cell ?? "").trim());
    const score = row.reduce((sum, cell) => sum + headerScore(cell), 0);
    if (score > bestScore) {
      bestScore = score;
      headerRowIndex = index;
    }
  }

  if (bestScore <= 0) {
    const firstRow = matrix[0].map((cell) => String(cell ?? "").trim());
    const filled = firstRow.filter(Boolean);
    const pathLikeCount = filled.filter((value) => looksLikePathOrUrl(value)).length;

    if (filled.length && pathLikeCount / filled.length >= 0.5) {
      const width = Math.max(...matrix.map((row) => row.length));
      const headers = Array.from({ length: width }, (_, index) => `Column ${index + 1}`);
      const rows = matrix
        .filter((row) => row.some((cell) => String(cell ?? "").trim()))
        .map((row) => {
          const record: Record<string, unknown> = {};
          headers.forEach((header, index) => {
            record[header] = row[index] ?? "";
          });
          return record;
        });

      return { headers, rows, headerRowIndex: -1 };
    }

    headerRowIndex = 0;
  }

  const headers = matrix[headerRowIndex].map((cell, index) => {
    const label = String(cell ?? "").trim();
    return label || `Column ${index + 1}`;
  });

  const rows = matrix
    .slice(headerRowIndex + 1)
    .filter((row) => row.some((cell) => String(cell ?? "").trim()))
    .map((row) => {
      const record: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        record[header] = row[index] ?? "";
      });
      return record;
    });

  return { headers, rows, headerRowIndex };
}

function inferPathColumn(headers: string[], rows: Record<string, unknown>[], usedColumns: Set<string>): string | undefined {
  const candidates = headers.filter((header) => !usedColumns.has(header));

  let bestHeader: string | undefined;
  let bestScore = 0;

  for (const header of candidates) {
    const values = rows.map((row) => String(row[header] ?? "").trim()).filter(Boolean);
    if (!values.length) continue;

    const pathLikeCount = values.filter((value) => looksLikePathOrUrl(value)).length;
    const score = pathLikeCount / values.length;
    if (score > bestScore) {
      bestScore = score;
      bestHeader = header;
    }
  }

  if (bestHeader && bestScore >= 0.3) return bestHeader;

  if (candidates.length === 1) return candidates[0];

  for (const header of candidates) {
    const values = rows.map((row) => String(row[header] ?? "").trim()).filter(Boolean);
    if (values.some((value) => looksLikePathOrUrl(value))) return header;
  }

  for (const header of candidates) {
    if (rows.some((row) => String(row[header] ?? "").trim())) return header;
  }

  return undefined;
}

export interface SpreadsheetParseInfo {
  sheetName: string;
  headerRowIndex: number;
  headers: string[];
  pathColumn?: string;
  pageNameColumn?: string;
  dataRowCount: number;
  mappedRowCount: number;
}

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths.map((candidate) => path.normalize(candidate)))];
}

/** Resolve EXCEL_PATH or the configured default workbook to an absolute file path. */
export function resolveSpreadsheetPath(explicitPath?: string): string {
  const fromEnv = (explicitPath ?? process.env.EXCEL_PATH)?.trim();
  if (fromEnv) {
    const base = path.basename(fromEnv);
    const candidates = uniquePaths([
      fromEnv,
      path.resolve(fromEnv),
      path.resolve(process.cwd(), fromEnv),
      path.resolve(process.cwd(), base),
      path.join(process.cwd(), base),
      path.join(process.env.HOME || "", "Downloads", base),
      path.join(process.env.HOME || "", "Downloads", fromEnv)
    ]);

    const found = candidates.find((candidate) => fs.existsSync(candidate));
    if (found) return found;

    throw new Error(
      [
        `Spreadsheet not found at "${fromEnv}".`,
        "Checked:",
        ...candidates.map((candidate) => `  - ${candidate}`),
        "",
        "Use an absolute path, put the file in the project folder, or run from the UI:",
        "  npm start  → upload/select your spreadsheet in the browser"
      ].join("\n")
    );
  }

  return resolveExcelPath();
}

export function resolveExcelPath(): string {
  const candidates = uniquePaths([
    config.excelPath,
    path.join(process.cwd(), config.excelPath),
    path.join(process.cwd(), "..", config.excelPath),
    path.join(process.cwd(), "public", "sample-spreadsheet.xlsx"),
    path.join(process.env.HOME || "", "Downloads", config.excelPath),
    path.join(process.env.HOME || "", "Downloads", path.basename(config.excelPath))
  ]);

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(
      [
        "No spreadsheet file found.",
        "Checked:",
        ...candidates.map((candidate) => `  - ${candidate}`),
        "",
        "Set EXCEL_PATH to your .xlsx file, or start the UI:",
        "  npm start"
      ].join("\n")
    );
  }
  return found;
}

export interface ReadMappingsOptions {
  startIndex?: number;
  maxPages?: number;
}

function readWorkbookFile(excelPath: string): XLSX.WorkBook {
  return XLSX.readFile(excelPath, { bookVBA: false, cellDates: false });
}

function listReadableSheetNames(workbook: XLSX.WorkBook): string[] {
  return workbook.SheetNames.filter((name) => Boolean(workbook.Sheets[name]));
}

/** First sheet tab that actually exists in the workbook (ignores stale SheetNames metadata). */
export function resolveSheetName(workbook: XLSX.WorkBook): string {
  const readable = listReadableSheetNames(workbook);
  if (readable.length) return readable[0];

  const sheetKeys = Object.keys(workbook.Sheets).filter((name) => !name.startsWith("!"));
  if (sheetKeys.length) return sheetKeys[0];

  throw new Error("Workbook has no readable sheets");
}

function parseWorkbook(workbook: XLSX.WorkBook): { mappings: PageMapping[]; info: SpreadsheetParseInfo } {
  const sheetName = resolveSheetName(workbook);
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error(
      `Workbook has no readable sheets. Available: ${listReadableSheetNames(workbook).join(", ")}`
    );
  }

  const { headers, rows, headerRowIndex } = extractSheetRows(worksheet);
  if (!rows.length) {
    return {
      mappings: [],
      info: {
        sheetName,
        headerRowIndex,
        headers,
        dataRowCount: 0,
        mappedRowCount: 0
      }
    };
  }

  const usedColumns = new Set<string>();
  const pageNameColumn = findColumn(headers, columnAliases.pageName, usedColumns);
  if (pageNameColumn) usedColumns.add(pageNameColumn);

  let pathColumn = findColumn(headers, columnAliases.path, usedColumns);
  if (pathColumn) {
    usedColumns.add(pathColumn);
  } else {
    pathColumn = inferPathColumn(headers, rows, usedColumns);
    if (pathColumn) usedColumns.add(pathColumn);
  }

  const prodUrlColumn = findColumn(headers, columnAliases.prodUrl, usedColumns);
  if (prodUrlColumn) usedColumns.add(prodUrlColumn);

  const devUrlColumn = findColumn(headers, columnAliases.devUrl, usedColumns);
  if (devUrlColumn) usedColumns.add(devUrlColumn);

  const mappings: PageMapping[] = [];

  rows.forEach((row, index) => {
    const raw = {
      pageName: pageNameColumn ? String(row[pageNameColumn] || "") : "",
      path: pathColumn ? String(row[pathColumn] || "") : "",
      prodUrl: prodUrlColumn ? String(row[prodUrlColumn] || "") : "",
      devUrl: devUrlColumn ? String(row[devUrlColumn] || "") : ""
    };

    const mapping = createPageMapping(raw);
    if (!mapping) {
      const excelRowNumber = headerRowIndex >= 0 ? headerRowIndex + index + 2 : index + 1;
      logger.warn(`Skipped empty or unmappable Excel row ${excelRowNumber}`);
      return;
    }

    mappings.push(mapping);
  });

  const deduped = dedupeMappings(mappings);
  if (deduped.length !== mappings.length) {
    logger.warn(`Skipped ${mappings.length - deduped.length} duplicate URL mapping(s)`);
  }

  return {
    mappings: deduped,
    info: {
      sheetName,
      headerRowIndex,
      headers,
      pathColumn,
      pageNameColumn,
      dataRowCount: rows.length,
      mappedRowCount: deduped.length
    }
  };
}

function sliceMappings(mappings: PageMapping[], options?: ReadMappingsOptions): PageMapping[] {
  const startIndex = options?.startIndex ?? config.startIndex;
  const maxPages = options?.maxPages ?? config.maxPages;
  const start = Math.max(startIndex - 1, 0);
  const end = maxPages ? start + maxPages : undefined;
  return mappings.slice(start, end);
}

export function describeSpreadsheetParse(excelPath: string): string {
  const workbook = readWorkbookFile(excelPath);
  const { info } = parseWorkbook(workbook);

  const parts = [
    `Sheet "${info.sheetName}"`,
    info.headerRowIndex >= 0 ? `header row ${info.headerRowIndex + 1}` : "no header row detected",
    `columns: ${info.headers.join(", ") || "(none)"}`,
    `data rows: ${info.dataRowCount}`,
    info.pathColumn ? `path column: "${info.pathColumn}"` : "path column: not detected"
  ];

  return parts.join("; ");
}

export function readPageMappingsFromFile(excelPath: string, options?: ReadMappingsOptions): PageMapping[] {
  const workbook = readWorkbookFile(excelPath);
  const sheetName = resolveSheetName(workbook);
  logger.info(`Reading spreadsheet "${excelPath}" sheet "${sheetName}"`);
  const { mappings } = parseWorkbook(workbook);
  return sliceMappings(mappings, options);
}

export function listWorkbookSheets(excelPath: string): string[] {
  const workbook = readWorkbookFile(excelPath);
  return listReadableSheetNames(workbook);
}

export function readWorkbookSheetNames(excelPath: string): {
  sheetNames: string[];
  sheetName: string;
} {
  const workbook = readWorkbookFile(excelPath);
  const sheetName = resolveSheetName(workbook);
  return {
    sheetNames: listWorkbookSheets(excelPath),
    sheetName
  };
}

export function readPageMappings(): PageMapping[] {
  const excelPath = resolveExcelPath();
  return readPageMappingsFromFile(excelPath);
}
