import { Page } from "@playwright/test";

export interface Heading {
  level: number;
  text: string;
  index: number;
  visible: boolean;
}

export async function extractHeadings(page: Page): Promise<Heading[]> {
  return page.evaluate(() => {
    const isVisible = (element: Element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    };

    return Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"))
      .map((heading, index) => ({
        level: Number(heading.tagName.slice(1)),
        text: (heading.textContent || "").replace(/\s+/g, " ").trim(),
        index,
        visible: isVisible(heading)
      }))
      .filter((heading) => heading.visible && heading.text);
  });
}
