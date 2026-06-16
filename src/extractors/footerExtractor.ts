import { Page } from "@playwright/test";
import { LinkData } from "./linkExtractor";

export interface FooterData {
  text: string;
  links: LinkData[];
  socialLinks: LinkData[];
  legalLinks: LinkData[];
  copyrightText: string;
}

export async function extractFooter(page: Page): Promise<FooterData> {
  return page.evaluate(() => {
    const footer = document.querySelector("footer") || document.body;
    const isVisible = (element: Element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    };

    const links = Array.from(footer.querySelectorAll<HTMLAnchorElement>("a[href]"))
      .filter(isVisible)
      .map((link) => ({
        text: (link.textContent || "").replace(/\s+/g, " ").trim(),
        href: link.href,
        target: link.getAttribute("target"),
        rel: link.getAttribute("rel"),
        ariaLabel: link.getAttribute("aria-label")
      }));

    const text = (footer.textContent || "").replace(/\s+/g, " ").trim();
    const socialPattern = /(facebook|twitter|x\.com|linkedin|youtube|instagram)/i;
    const legalPattern = /(privacy|terms|cookie|legal|accessibility|copyright)/i;

    return {
      text,
      links,
      socialLinks: links.filter((link) => socialPattern.test(`${link.text} ${link.href} ${link.ariaLabel || ""}`)),
      legalLinks: links.filter((link) => legalPattern.test(`${link.text} ${link.href} ${link.ariaLabel || ""}`)),
      copyrightText: text.match(/©[^.]+|copyright[^.]+/i)?.[0] || ""
    };
  });
}
