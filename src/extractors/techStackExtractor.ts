import { Page } from "@playwright/test";

export interface StackSignal {
  name: string;
  evidence: string;
}

export interface TechStackData {
  serverHeader: string;
  poweredBy: string;
  platform: string;
  contentType: string;
  via: string;
  technologies: StackSignal[];
  programmingLanguages: StackSignal[];
  cmsPlatforms: StackSignal[];
  serverSignals: StackSignal[];
}

const SERVER_HEADER_KEYS = [
  "server",
  "x-powered-by",
  "x-aspnet-version",
  "x-aspnetmvc-version",
  "x-runtime",
  "x-generator",
  "via",
  "cf-ray",
  "x-vercel-id",
  "x-netlify",
  "x-amz-cf-id",
  "x-azure-ref",
  "x-served-by",
  "x-drupal-cache",
  "x-pingback"
] as const;

function normalizeHeaderKey(key: string): string {
  return key.toLowerCase();
}

function readHeader(headers: Record<string, string>, key: string): string {
  const target = key.toLowerCase();
  for (const [headerKey, value] of Object.entries(headers)) {
    if (normalizeHeaderKey(headerKey) === target) return String(value || "").trim();
  }
  return "";
}

function uniqueSignals(signals: StackSignal[]): StackSignal[] {
  const seen = new Set<string>();
  const output: StackSignal[] = [];
  for (const signal of signals) {
    const key = signal.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(signal);
  }
  return output;
}

function pushSignal(bucket: StackSignal[], name: string, evidence: string): void {
  if (!name.trim() || !evidence.trim()) return;
  bucket.push({ name, evidence });
}

function detectFromHeaders(headers: Record<string, string>): {
  technologies: StackSignal[];
  programmingLanguages: StackSignal[];
  cmsPlatforms: StackSignal[];
  serverSignals: StackSignal[];
} {
  const technologies: StackSignal[] = [];
  const programmingLanguages: StackSignal[] = [];
  const cmsPlatforms: StackSignal[] = [];
  const serverSignals: StackSignal[] = [];

  const server = readHeader(headers, "server");
  const poweredBy = readHeader(headers, "x-powered-by");
  const platform = readHeader(headers, "platform");
  const via = readHeader(headers, "via");
  const generator = readHeader(headers, "x-generator");

  if (server) pushSignal(serverSignals, "Server", server);
  if (poweredBy) pushSignal(serverSignals, "X-Powered-By", poweredBy);
  if (platform) pushSignal(serverSignals, "Platform", platform);
  if (via) pushSignal(serverSignals, "Via", via);
  if (readHeader(headers, "cf-ray")) pushSignal(serverSignals, "Cloudflare", readHeader(headers, "cf-ray"));
  if (readHeader(headers, "x-vercel-id")) pushSignal(serverSignals, "Vercel", "x-vercel-id present");
  if (readHeader(headers, "x-netlify")) pushSignal(serverSignals, "Netlify", readHeader(headers, "x-netlify") || "present");

  if (/nginx/i.test(server)) pushSignal(serverSignals, "Nginx", server);
  if (/apache/i.test(server)) pushSignal(serverSignals, "Apache", server);
  if (/cloudflare/i.test(server)) pushSignal(serverSignals, "Cloudflare", server);
  if (/microsoft-iis/i.test(server)) pushSignal(serverSignals, "IIS", server);
  if (/gws/i.test(server)) pushSignal(serverSignals, "Google Frontend", server);

  if (/php/i.test(poweredBy)) pushSignal(programmingLanguages, "PHP", poweredBy);
  if (/asp\.net/i.test(poweredBy)) pushSignal(programmingLanguages, "ASP.NET", poweredBy);
  if (/express/i.test(poweredBy)) pushSignal(programmingLanguages, "Node.js", poweredBy);
  if (/next\.js/i.test(poweredBy)) pushSignal(technologies, "Next.js", poweredBy);

  if (/wordpress/i.test(generator)) pushSignal(cmsPlatforms, "WordPress", generator);

  for (const key of SERVER_HEADER_KEYS) {
    const value = readHeader(headers, key);
    if (!value) continue;
    if (key === "x-drupal-cache") pushSignal(cmsPlatforms, "Drupal", value);
    if (key === "x-pingback" && /xmlrpc\.php/i.test(value)) pushSignal(cmsPlatforms, "WordPress", value);
  }

  return {
    technologies: uniqueSignals(technologies),
    programmingLanguages: uniqueSignals(programmingLanguages),
    cmsPlatforms: uniqueSignals(cmsPlatforms),
    serverSignals: uniqueSignals(serverSignals)
  };
}

export async function extractTechStack(page: Page, headers: Record<string, string> = {}): Promise<TechStackData> {
  const fromHeaders = detectFromHeaders(headers);
  const domSignals = await page.evaluate(() => {
    const technologies: Array<{ name: string; evidence: string }> = [];
    const programmingLanguages: Array<{ name: string; evidence: string }> = [];
    const cmsPlatforms: Array<{ name: string; evidence: string }> = [];
    const serverSignals: Array<{ name: string; evidence: string }> = [];

    const push = (
      bucket: Array<{ name: string; evidence: string }>,
      name: string,
      evidence: string
    ) => {
      if (!name.trim() || !evidence.trim()) return;
      bucket.push({ name, evidence });
    };

    const html = document.documentElement.outerHTML.slice(0, 250000).toLowerCase();
    const generator = document.querySelector('meta[name="generator"]')?.getAttribute("content")?.trim() || "";
    if (generator) push(cmsPlatforms, "Generator meta", generator);

    const scriptSrcs = Array.from(document.querySelectorAll("script[src]"))
      .map((script) => script.getAttribute("src") || "")
      .filter(Boolean);
    const linkHrefs = Array.from(document.querySelectorAll("link[href]"))
      .map((link) => link.getAttribute("href") || "")
      .filter(Boolean);
    const assetUrls = [...scriptSrcs, ...linkHrefs].join(" ").toLowerCase();

    const checks: Array<{ bucket: typeof technologies; name: string; patterns: RegExp; evidence: string }> = [
      { bucket: technologies, name: "React", patterns: /react(\.|-|\/)|__react/, evidence: "react asset or global" },
      { bucket: technologies, name: "Vue.js", patterns: /vue(\.|-|\/)|__vue__/, evidence: "vue asset or global" },
      { bucket: technologies, name: "Angular", patterns: /angular(\.|-|\/)|ng-version/, evidence: "angular asset or attribute" },
      { bucket: technologies, name: "Next.js", patterns: /\/_next\//, evidence: "/_next/ assets" },
      { bucket: technologies, name: "Nuxt", patterns: /\/_nuxt\//, evidence: "/_nuxt/ assets" },
      { bucket: technologies, name: "Gatsby", patterns: /gatsby/, evidence: "gatsby asset" },
      { bucket: technologies, name: "jQuery", patterns: /jquery(\.|-|\/)|jquery\.min\.js/, evidence: "jquery asset" },
      { bucket: technologies, name: "Bootstrap", patterns: /bootstrap(\.|-|\/)|bootstrap\.min/, evidence: "bootstrap asset" },
      { bucket: technologies, name: "Google Tag Manager", patterns: /googletagmanager\.com/, evidence: "GTM script" },
      { bucket: technologies, name: "Google Analytics", patterns: /google-analytics\.com|googletagmanager\.com\/gtag/, evidence: "GA script" },
      { bucket: technologies, name: "Adobe Launch", patterns: /assets\.adobedtm\.com|launch-/, evidence: "Adobe DTM/Launch" },
      { bucket: technologies, name: "Webpack", patterns: /webpack/, evidence: "webpack asset" },
      { bucket: technologies, name: "Vercel", patterns: /\/_vercel\/|vercel\.app/, evidence: "vercel asset or host" },
      { bucket: technologies, name: "Netlify", patterns: /netlify/, evidence: "netlify asset or host" }
    ];

    for (const check of checks) {
      if (check.patterns.test(assetUrls) || check.patterns.test(html)) {
        push(check.bucket, check.name, check.evidence);
      }
    }

    if ((window as unknown as { __NEXT_DATA__?: unknown }).__NEXT_DATA__) push(technologies, "Next.js", "__NEXT_DATA__ present");
    if ((window as unknown as { __NUXT__?: unknown }).__NUXT__) push(technologies, "Nuxt", "__NUXT__ present");
    if ((window as unknown as { React?: unknown }).React) push(technologies, "React", "window.React present");
    if ((window as unknown as { Vue?: unknown }).Vue) push(technologies, "Vue.js", "window.Vue present");
    if ((window as unknown as { angular?: unknown }).angular) push(technologies, "Angular", "window.angular present");
    if ((window as unknown as { dataLayer?: unknown[] }).dataLayer) push(technologies, "Google Tag Manager", "window.dataLayer present");

    const cmsChecks: Array<{ name: string; pattern: RegExp; evidence: string }> = [
      { name: "WordPress", pattern: /wp-content|wp-includes|xmlrpc\.php/, evidence: "WordPress paths/assets" },
      { name: "Drupal", pattern: /drupal|sites\/default|drupal\.settings/, evidence: "Drupal paths/assets" },
      { name: "Joomla", pattern: /\/media\/jui\/|joomla!|option=com_/, evidence: "Joomla paths/assets" },
      { name: "Sitecore", pattern: /\/sitecore\/|sc_sitecore/, evidence: "Sitecore paths/assets" },
      { name: "Adobe Experience Manager", pattern: /\/etc\.clientlibs\/|cq\.|granite\.|aem/, evidence: "AEM paths/assets" },
      { name: "Contentful", pattern: /contentful/, evidence: "contentful asset/reference" },
      { name: "Shopify", pattern: /cdn\.shopify\.com|shopify\./, evidence: "Shopify assets" },
      { name: "HubSpot CMS", pattern: /hs-scripts\.com|hubspot/, evidence: "HubSpot assets" },
      { name: "Wix", pattern: /static\.wixstatic\.com|wix\.com/, evidence: "Wix assets" },
      { name: "Squarespace", pattern: /squarespace/, evidence: "Squarespace assets" }
    ];

    for (const cms of cmsChecks) {
      if (cms.pattern.test(assetUrls) || cms.pattern.test(html) || cms.pattern.test(generator.toLowerCase())) {
        push(cmsPlatforms, cms.name, cms.evidence);
      }
    }

    if (/wordpress/i.test(generator)) push(cmsPlatforms, "WordPress", generator);
    if (/drupal/i.test(generator)) push(cmsPlatforms, "Drupal", generator);

    const languageChecks: Array<{ name: string; pattern: RegExp; evidence: string }> = [
      { name: "PHP", pattern: /\.php(?:[?#"'/]|$)|x-powered-by:\s*php/i, evidence: "PHP URL or header hint" },
      { name: "ASP.NET", pattern: /\.aspx(?:[?#"'/]|$)|__viewstate|x-aspnet/i, evidence: "ASP.NET URL or markers" },
      { name: "Java", pattern: /\.jsp(?:[?#"'/]|$)|jsessionid=|x-powered-by:\s*servlet/i, evidence: "Java/JSP markers" },
      { name: "Ruby", pattern: /x-runtime:|ruby|rack/i, evidence: "Ruby runtime markers" },
      { name: "Python", pattern: /wsgi|python|django|flask/i, evidence: "Python framework markers" },
      { name: "Node.js", pattern: /express|node\.js|x-powered-by:\s*express/i, evidence: "Node.js markers" }
    ];

    for (const language of languageChecks) {
      if (language.pattern.test(assetUrls) || language.pattern.test(html)) {
        push(programmingLanguages, language.name, language.evidence);
      }
    }

    const bodyClass = document.body?.className?.toLowerCase() || "";
    if (bodyClass.includes("wp-")) push(cmsPlatforms, "WordPress", `body class: ${document.body.className}`);
    if (bodyClass.includes("drupal")) push(cmsPlatforms, "Drupal", `body class: ${document.body.className}`);

    return { technologies, programmingLanguages, cmsPlatforms, serverSignals };
  });

  const technologies = uniqueSignals([...fromHeaders.technologies, ...domSignals.technologies]);
  const programmingLanguages = uniqueSignals([...fromHeaders.programmingLanguages, ...domSignals.programmingLanguages]);
  const cmsPlatforms = uniqueSignals([...fromHeaders.cmsPlatforms, ...domSignals.cmsPlatforms]);
  const serverSignals = uniqueSignals([...fromHeaders.serverSignals, ...domSignals.serverSignals]);

  return {
    serverHeader: readHeader(headers, "server"),
    poweredBy: readHeader(headers, "x-powered-by"),
    platform: readHeader(headers, "platform"),
    contentType: readHeader(headers, "content-type"),
    via: readHeader(headers, "via"),
    technologies,
    programmingLanguages,
    cmsPlatforms,
    serverSignals
  };
}

export function emptyTechStackData(): TechStackData {
  return {
    serverHeader: "",
    poweredBy: "",
    platform: "",
    contentType: "",
    via: "",
    technologies: [],
    programmingLanguages: [],
    cmsPlatforms: [],
    serverSignals: []
  };
}

export type TechStackModuleId = "devTechnologies" | "programmingLanguages" | "cms" | "serverComparison";

export function getStackSignals(data: TechStackData, moduleId: TechStackModuleId): StackSignal[] {
  switch (moduleId) {
    case "devTechnologies":
      return data.technologies;
    case "programmingLanguages":
      return data.programmingLanguages;
    case "cms":
      return data.cmsPlatforms;
    case "serverComparison":
      return data.serverSignals;
    default:
      return [];
  }
}
