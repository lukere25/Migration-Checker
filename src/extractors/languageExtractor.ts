import { Page } from "@playwright/test";

export interface LanguageData {
  htmlLang: string;
  hreflang: Array<{ lang: string; href: string }>;
  placeholders: string[];
}

const placeholderPatterns = [
  "undefined",
  "null",
  "[object Object]",
  "{{",
  "}}",
  "lorem ipsum",
  "TODO",
  "TBD"
];

export async function extractLanguage(page: Page): Promise<LanguageData> {
  return page.evaluate((patterns) => {
    const bodyText = (document.body?.innerText || "").replace(/\s+/g, " ");
    return {
      htmlLang: document.documentElement.lang || "",
      hreflang: Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="alternate"][hreflang]')).map((link) => ({
        lang: link.hreflang,
        href: link.href
      })),
      placeholders: patterns.filter((pattern) => bodyText.toLowerCase().includes(pattern.toLowerCase()))
    };
  }, placeholderPatterns);
}
