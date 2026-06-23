export interface ComparisonModule {
  id: string;
  label: string;
  description: string;
}

export const COMPARISON_MODULES: ComparisonModule[] = [
  { id: "metadata", label: "Metadata", description: "Meta tags and SEO fields" },
  { id: "schema", label: "Schema", description: "JSON-LD structured data comparison" },
  { id: "embeds", label: "Iframe & embeds", description: "Iframe, embed, and embedded widget comparison" },
  { id: "devTechnologies", label: "Development technologies", description: "Frameworks, libraries, programming languages, and CMS detection" },
  { id: "serverComparison", label: "Server comparison", description: "Server, hosting, and response header comparison" },
  { id: "language", label: "Language", description: "HTML lang attribute" },
  { id: "brokenLinks", label: "Broken links", description: "HTTP status on internal links" },
  { id: "headings", label: "Headings", description: "Heading structure and text" },
  { id: "hTagHierarchy", label: "H tag hierarchy", description: "Heading order and level skips" },
  { id: "textStyle", label: "Text style match", description: "Font, size, weight, and color" },
  { id: "pageSpeed", label: "Page speed match", description: "Load timing vs live site" },
  { id: "content", label: "Content", description: "Body text similarity" },
  { id: "images", label: "Images", description: "Image sources and alt text" },
  { id: "moduleSpacing", label: "Module spacing", description: "Full-page screenshots with module and gap marks" },
  { id: "visual", label: "Visual comparison", description: "Screenshots and pixel diff" },
  { id: "navigation", label: "Navigation", description: "Header navigation links and hover/dropdown menus" },
  { id: "footer", label: "Footer", description: "Footer links, social links, legal links, and copyright text" },
  { id: "visualLanguages", label: "Visual – all languages", description: "Screenshot pixel diff for every hreflang language variant of the page" }
];

export const DEFAULT_ENABLED_MODULE_IDS = COMPARISON_MODULES.map((module) => module.id);

const moduleIdSet = new Set(DEFAULT_ENABLED_MODULE_IDS);

export function isValidModuleId(id: string): boolean {
  return moduleIdSet.has(id);
}

export function normalizeEnabledModuleIds(ids: string[] | undefined): string[] {
  const legacyAliases: Record<string, string> = {
    programmingLanguages: "devTechnologies",
    cms: "devTechnologies"
  };

  if (!ids?.length) return [...DEFAULT_ENABLED_MODULE_IDS];

  const normalized = [
    ...new Set(
      ids
        .map((id) => id.trim())
        .map((id) => legacyAliases[id] || id)
        .filter((id) => isValidModuleId(id))
    )
  ];
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
