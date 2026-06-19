import fs from "fs-extra";
import path from "path";
import * as XLSX from "xlsx";
import { createPageMapping } from "./urlMapper";

export interface SinglePageInput {
  pageAlias?: string;
  livePageUrl?: string;
  migrationPageUrl?: string;
  pageName?: string;
}

function resolveSinglePageMapping(input: SinglePageInput) {
  const live = input.livePageUrl?.trim();
  const migration = input.migrationPageUrl?.trim();

  if (live && migration) {
    return createPageMapping({
      prodUrl: live,
      devUrl: migration,
      pageName: input.pageName
    });
  }

  const alias = input.pageAlias?.trim();
  if (!alias) return null;

  return createPageMapping({ path: alias, pageName: input.pageName });
}

export async function writeSinglePageSpreadsheet(
  filePath: string,
  input: SinglePageInput | string,
  pageName?: string
): Promise<void> {
  const options: SinglePageInput =
    typeof input === "string" ? { pageAlias: input, pageName } : input;

  const mapping = resolveSinglePageMapping(options);
  if (!mapping) {
    const live = options.livePageUrl?.trim();
    const migration = options.migrationPageUrl?.trim();
    if (live || migration) {
      throw new Error("Enter both a live page URL/path and a migration page URL/path.");
    }
    throw new Error(`Invalid page path or URL: "${options.pageAlias || ""}"`);
  }

  const live = options.livePageUrl?.trim();
  const migration = options.migrationPageUrl?.trim();
  const worksheet =
    live && migration
      ? XLSX.utils.aoa_to_sheet([
          ["Page", "Live URL", "Migration URL"],
          [mapping.pageName, mapping.prodUrl, mapping.devUrl]
        ])
      : XLSX.utils.aoa_to_sheet([
          ["Page", "URL Alias"],
          [mapping.pageName, mapping.path]
        ]);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Pages");
  await fs.ensureDir(path.dirname(filePath));
  XLSX.writeFile(workbook, filePath);
}

export function previewSinglePageMapping(input: SinglePageInput) {
  const mapping = resolveSinglePageMapping(input);
  if (!mapping) {
    const live = input.livePageUrl?.trim();
    const migration = input.migrationPageUrl?.trim();
    if (live || migration) {
      throw new Error("Enter both a live page URL/path and a migration page URL/path.");
    }
    throw new Error(`Invalid page path or URL: "${input.pageAlias || ""}"`);
  }
  return mapping;
}
