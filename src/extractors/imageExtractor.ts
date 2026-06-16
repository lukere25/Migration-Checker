import { Page } from "@playwright/test";

export interface ImageData {
  src: string;
  currentSrc: string;
  alt: string;
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
  loading: string | null;
  role: string | null;
  ariaLabel: string | null;
  isBackground: boolean;
}

export async function extractImages(page: Page): Promise<ImageData[]> {
  return page.evaluate(() => {
    const isVisible = (element: Element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    };

    const imgData = Array.from(document.querySelectorAll<HTMLImageElement>("img"))
      .filter(isVisible)
      .map((img) => ({
        src: img.src || img.getAttribute("src") || "",
        currentSrc: img.currentSrc || "",
        alt: img.alt || "",
        width: Math.round(img.getBoundingClientRect().width),
        height: Math.round(img.getBoundingClientRect().height),
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        loading: img.getAttribute("loading"),
        role: img.getAttribute("role"),
        ariaLabel: img.getAttribute("aria-label"),
        isBackground: false
      }));

    const backgroundData = Array.from(document.querySelectorAll<HTMLElement>("main [style], section, div"))
      .filter(isVisible)
      .map((element) => {
        const background = window.getComputedStyle(element).backgroundImage;
        const match = background.match(/url\(["']?(.+?)["']?\)/);
        if (!match) return null;
        const rect = element.getBoundingClientRect();
        return {
          src: match[1],
          currentSrc: match[1],
          alt: "",
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          naturalWidth: 0,
          naturalHeight: 0,
          loading: null,
          role: element.getAttribute("role"),
          ariaLabel: element.getAttribute("aria-label"),
          isBackground: true
        };
      })
      .filter(Boolean) as ImageData[];

    return [...imgData, ...backgroundData];
  });
}
