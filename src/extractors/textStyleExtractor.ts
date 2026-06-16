import { Page } from "@playwright/test";

export interface TextStyleSample {
  key: string;
  tag: string;
  text: string;
  styles: {
    fontFamily: string;
    fontSize: string;
    fontWeight: string;
    lineHeight: string;
    color: string;
    letterSpacing: string;
    textTransform: string;
  };
}

function normalizeStyleValue(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function normalizeFontFamily(value: string): string {
  return normalizeStyleValue(value).split(",")[0]?.replace(/['"]/g, "") || "";
}

export async function extractTextStyles(page: Page): Promise<TextStyleSample[]> {
  return page.evaluate(() => {
    const isVisible = (element: Element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    };

    const readStyles = (element: Element) => {
      const style = window.getComputedStyle(element);
      return {
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        color: style.color,
        letterSpacing: style.letterSpacing,
        textTransform: style.textTransform
      };
    };

    const samples: TextStyleSample[] = [];
    const headingNodes = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).filter(isVisible);
    headingNodes.forEach((element, index) => {
      const text = (element.textContent || "").replace(/\s+/g, " ").trim();
      if (!text) return;
      samples.push({
        key: `${element.tagName.toLowerCase()}-${index + 1}`,
        tag: element.tagName.toLowerCase(),
        text,
        styles: readStyles(element)
      });
    });

    const paragraphNodes = Array.from(document.querySelectorAll("main p, article p, body p"))
      .filter(isVisible)
      .slice(0, 8);

    paragraphNodes.forEach((element, index) => {
      const text = (element.textContent || "").replace(/\s+/g, " ").trim();
      if (!text) return;
      samples.push({
        key: `p-${index + 1}`,
        tag: "p",
        text: text.slice(0, 120),
        styles: readStyles(element)
      });
    });

    return samples;
  });
}

export function styleSignature(sample: TextStyleSample): string {
  const styles = sample.styles;
  return [
    normalizeFontFamily(styles.fontFamily),
    normalizeStyleValue(styles.fontSize),
    normalizeStyleValue(styles.fontWeight),
    normalizeStyleValue(styles.lineHeight),
    normalizeStyleValue(styles.color),
    normalizeStyleValue(styles.letterSpacing),
    normalizeStyleValue(styles.textTransform)
  ].join("|");
}
