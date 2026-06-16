/** Headless unless PLAYWRIGHT_HEADLESS=false */
export function isPlaywrightHeadless(): boolean {
  return process.env.PLAYWRIGHT_HEADLESS !== "false";
}

export function parseHeadlessInput(value: unknown): boolean {
  if (value === "false" || value === false || value === "0" || value === "off") return false;
  if (value === "true" || value === true || value === "on" || value === "1") return true;
  return true;
}
