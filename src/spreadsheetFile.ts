import fs from "fs-extra";

export function assertValidSpreadsheetBuffer(buffer: Buffer): void {
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    const preview = buffer.slice(0, 300).toString("utf8");
    if (preview.includes("<!DOCTYPE") || preview.includes("<html")) {
      throw new Error(
        'Spreadsheet URL returned a web page instead of Excel. For Google Sheets, share the file as "Anyone with the link can view".'
      );
    }
    throw new Error("File is not a valid Excel (.xlsx) workbook");
  }
}

export async function assertValidSpreadsheetFile(filePath: string): Promise<void> {
  const buffer = await fs.readFile(filePath);
  assertValidSpreadsheetBuffer(buffer);
}

export function isSpreadsheetFilename(filename: string): boolean {
  return /\.xlsx?$/i.test(filename);
}
