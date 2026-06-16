export interface ComparisonModule {
  id: string;
  label: string;
  description: string;
}

export const COMPARISON_MODULES: ComparisonModule[] = [
  { id: "metadata", label: "Metadata", description: "Meta tags and SEO fields" },
  { id: "language", label: "Language", description: "HTML lang attribute" },
  { id: "brokenLinks", label: "Broken links", description: "HTTP status on internal links" },
  { id: "headings", label: "Headings", description: "Heading structure and text" },
  { id: "hTagHierarchy", label: "H tag hierarchy", description: "Heading order and level skips" },
  { id: "textStyle", label: "Text style match", description: "Font, size, weight, and color" },
  { id: "pageSpeed", label: "Page speed match", description: "Load timing vs live site" },
  { id: "content", label: "Content", description: "Body text similarity" },
  { id: "images", label: "Images", description: "Image sources and alt text" },
  { id: "visual", label: "Visual comparison", description: "Screenshots and pixel diff" }
];

export const DEFAULT_ENABLED_MODULE_IDS = COMPARISON_MODULES.map((module) => module.id);

const moduleIdSet = new Set(DEFAULT_ENABLED_MODULE_IDS);

export function isValidModuleId(id: string): boolean {
  return moduleIdSet.has(id);
}

export function normalizeEnabledModuleIds(ids: string[] | undefined): string[] {
  if (!ids?.length) return [...DEFAULT_ENABLED_MODULE_IDS];

  const normalized = [...new Set(ids.map((id) => id.trim()).filter((id) => isValidModuleId(id)))];
  return normalized.length ? normalized : [...DEFAULT_ENABLED_MODULE_IDS];
}

export function parseEnabledModulesInput(value: unknown): string[] {
  if (Array.isArray(value)) {
    return normalizeEnabledModuleIds(value.map(String));
  }

  if (typeof value === "string" && value.trim()) {
    return normalizeEnabledModuleIds(value.split(",").map((part) => part.trim()));
  }

  return [...DEFAULT_ENABLED_MODULE_IDS];
}

export function serializeEnabledModules(ids: string[]): string {
  return normalizeEnabledModuleIds(ids).join(",");
}

export function readEnabledModulesFromEnv(env: NodeJS.ProcessEnv = process.env): Set<string> {
  return new Set(parseEnabledModulesInput(env.ENABLED_MODULES));
}

export function isModuleEnabled(moduleId: string, enabled?: Set<string>): boolean {
  const active = enabled ?? readEnabledModulesFromEnv();
  return active.has(moduleId);
}

export function skippedCategoryResult(label: string) {
  return {
    status: "SKIPPED" as const,
    summary: `${label} skipped (module disabled)`,
    issues: []
  };
}
