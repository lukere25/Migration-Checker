import fs from "fs-extra";
import path from "path";
import * as XLSX from "xlsx";
import { createPageMapping } from "./urlMapper";

export async function writeSinglePageSpreadsheet(
  filePath: string,
  pageAlias: string,
  pageName?: string
): Promise<void> {
  const mapping = createPageMapping({ path: pageAlias, pageName });
  if (!mapping) {
    throw new Error(`Invalid page path or URL: "${pageAlias}"`);
  }

  const worksheet = XLSX.utils.aoa_to_sheet([
    ["Page", "URL Alias"],
    [mapping.pageName, mapping.path]
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Pages");
  await fs.ensureDir(path.dirname(filePath));
  XLSX.writeFile(workbook, filePath);
}
