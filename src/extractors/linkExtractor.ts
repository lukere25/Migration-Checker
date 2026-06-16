import { Page } from "@playwright/test";

export interface LinkData {
  text: string;
  href: string;
  target: string | null;
  rel: string | null;
  ariaLabel: string | null;
}

export async function extractLinks(page: Page): Promise<LinkData[]> {
  return page.evaluate(() => {
    const isVisible = (element: Element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    };

    return Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
      .filter(isVisible)
      .map((link) => ({
        text: (link.textContent || "").replace(/\s+/g, " ").trim(),
        href: link.href,
        target: link.getAttribute("target"),
        rel: link.getAttribute("rel"),
        ariaLabel: link.getAttribute("aria-label")
      }));
  });
}
