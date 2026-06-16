import { Page } from "@playwright/test";

export interface Metadata {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  keywords: string;
  openGraph: Record<string, string>;
  twitter: Record<string, string>;
  hreflang: Array<{ lang: string; href: string }>;
  allMeta: Array<{ key: string; value: string; content: string }>;
}

export async function extractMetadata(page: Page): Promise<Metadata> {
  return page.evaluate(() => {
    const metaContent = (selector: string) =>
      document.querySelector<HTMLMetaElement>(selector)?.content?.trim() || "";

    const mappedMeta = Array.from(document.querySelectorAll<HTMLMetaElement>("meta")).map((meta) => {
      const key =
        meta.getAttribute("name") ||
        meta.getAttribute("property") ||
        meta.getAttribute("http-equiv") ||
        meta.getAttribute("itemprop") ||
        "";
      return {
        key,
        value: meta.getAttribute("name") || meta.getAttribute("property") || meta.getAttribute("http-equiv") || meta.getAttribute("itemprop") || "",
        content: meta.content || ""
      };
    });

    const pickPrefix = (prefix: string) =>
      Object.fromEntries(
        mappedMeta
          .filter((meta) => meta.key.startsWith(prefix))
          .map((meta) => [meta.key.replace(`${prefix}:`, ""), meta.content])
      );

    return {
      title: document.title.trim(),
      description: metaContent('meta[name="description"]'),
      canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href || "",
      robots: metaContent('meta[name="robots"]'),
      keywords: metaContent('meta[name="keywords"]'),
      openGraph: pickPrefix("og"),
      twitter: pickPrefix("twitter"),
      hreflang: Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="alternate"][hreflang]')).map((link) => ({
        lang: link.hreflang,
        href: link.href
      })),
      allMeta: mappedMeta
    };
  });
}
