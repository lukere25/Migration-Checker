import { Page } from "@playwright/test";
import { normalizeWhitespace } from "../utils/normalize";

export interface ContentData {
  text: string;
  length: number;
}

export async function extractContent(page: Page): Promise<ContentData> {
  const text = await page.evaluate(() => {
    const root =
      document.querySelector("main") ||
      document.querySelector("article") ||
      document.querySelector('[role="main"]') ||
      document.body;
    const clone = root.cloneNode(true) as HTMLElement;

    clone.querySelectorAll("script,style,noscript,svg,nav,footer,[hidden],[aria-hidden='true'],.cookie,.cookies,[id*='cookie' i],[class*='cookie' i]").forEach((node) => node.remove());

    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT);
    const hidden: Element[] = [];
    while (walker.nextNode()) {
      const element = walker.currentNode as Element;
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") hidden.push(element);
    }
    hidden.forEach((element) => element.remove());

    return clone.textContent || "";
  });

  const normalized = normalizeWhitespace(text);
  return {
    text: normalized,
    length: normalized.length
  };
}
