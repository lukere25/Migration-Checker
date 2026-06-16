import fs from "fs-extra";
import { assertValidSpreadsheetBuffer } from "./spreadsheetFile";

/**
 * Normalizes common spreadsheet share URLs into a direct .xlsx download URL.
 */
export function normalizeSpreadsheetUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) throw new Error("Spreadsheet URL is required");

  const googleMatch = trimmed.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (googleMatch) {
    const sheetId = googleMatch[1];
    const gidMatch = trimmed.match(/[#&?]gid=(\d+)/);
    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
    return gidMatch ? `${exportUrl}&gid=${gidMatch[1]}` : exportUrl;
  }

  return trimmed;
}

export async function downloadSpreadsheet(url: string, destinationPath: string): Promise<void> {
  const normalized = normalizeSpreadsheetUrl(url);
  const response = await fetch(normalized, {
    headers: { "User-Agent": "netapp-migration-checker/1.0" },
    redirect: "follow"
  });

  if (!response.ok) {
    throw new Error(`Failed to download spreadsheet (${response.status} ${response.statusText})`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  assertValidSpreadsheetBuffer(buffer);
  await fs.writeFile(destinationPath, buffer);
}
