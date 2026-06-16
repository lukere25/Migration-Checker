import fs from "fs-extra";
import path from "path";

export async function ensureDir(dir: string): Promise<void> {
  await fs.ensureDir(dir);
}

export async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeJson(filePath, data, { spaces: 2 });
}

export async function writeText(filePath: string, data: string): Promise<void> {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, data, "utf8");
}

export function relativeFromReports(filePath: string): string {
  return path.relative("reports", filePath).replace(/\\/g, "/");
}
