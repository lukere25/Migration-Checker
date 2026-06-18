import { Page } from "@playwright/test";

export type EmbedKind = "iframe" | "embed" | "object" | "video" | "audio" | "widget";

export interface EmbeddedItem {
  index: number;
  kind: EmbedKind;
  src: string;
  srcdocPreview: string;
  title: string;
  label: string;
  width: string;
  height: string;
  sandbox: string;
  allow: string;
  type: string;
  visible: boolean;
  dataSrc: string;
}

export interface EmbedData {
  items: EmbeddedItem[];
}

export async function extractEmbeds(page: Page): Promise<EmbedData> {
  return page.evaluate(() => {
    function truncate(value: string, max = 180): string {
      const trimmed = value.trim();
      if (trimmed.length <= max) return trimmed;
      return `${trimmed.slice(0, max - 3)}...`;
    }

    function readMediaSrc(element: Element): string {
      const direct = element.getAttribute("src")?.trim() || "";
      if (direct) return direct;

      const source = element.querySelector("source[src]");
      return source?.getAttribute("src")?.trim() || "";
    }

    function isVisible(element: Element): boolean {
      const htmlElement = element as HTMLElement;
      const style = window.getComputedStyle(htmlElement);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
        return false;
      }
      const rect = htmlElement.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    function widgetLabel(element: Element): string {
      return (
        element.getAttribute("data-embed") ||
        element.getAttribute("data-module") ||
        element.getAttribute("data-widget") ||
        element.getAttribute("data-component") ||
        element.getAttribute("data-video-id") ||
        element.id ||
        element.className.split(/\s+/).slice(0, 2).join(" ") ||
        "widget"
      );
    }

    const items: EmbeddedItem[] = [];
    let index = 0;

    const pushItem = (entry: Omit<EmbeddedItem, "index">) => {
      items.push({ index, ...entry });
      index += 1;
    };

    document.querySelectorAll("iframe").forEach((element) => {
      pushItem({
        kind: "iframe",
        src: element.getAttribute("src")?.trim() || "",
        srcdocPreview: truncate(element.getAttribute("srcdoc") || ""),
        title: element.getAttribute("title")?.trim() || "",
        label: element.getAttribute("title")?.trim() || element.getAttribute("name")?.trim() || element.id || `iframe ${index + 1}`,
        width: element.getAttribute("width")?.trim() || "",
        height: element.getAttribute("height")?.trim() || "",
        sandbox: element.getAttribute("sandbox")?.trim() || "",
        allow: element.getAttribute("allow")?.trim() || "",
        type: "",
        visible: isVisible(element),
        dataSrc: element.getAttribute("data-src")?.trim() || ""
      });
    });

    document.querySelectorAll("embed").forEach((element) => {
      pushItem({
        kind: "embed",
        src: element.getAttribute("src")?.trim() || "",
        srcdocPreview: "",
        title: element.getAttribute("title")?.trim() || "",
        label: element.getAttribute("title")?.trim() || element.id || `embed ${index + 1}`,
        width: element.getAttribute("width")?.trim() || "",
        height: element.getAttribute("height")?.trim() || "",
        sandbox: "",
        allow: "",
        type: element.getAttribute("type")?.trim() || "",
        visible: isVisible(element),
        dataSrc: ""
      });
    });

    document.querySelectorAll("object").forEach((element) => {
      pushItem({
        kind: "object",
        src: element.getAttribute("data")?.trim() || "",
        srcdocPreview: "",
        title: element.getAttribute("title")?.trim() || "",
        label: element.getAttribute("title")?.trim() || element.id || `object ${index + 1}`,
        width: element.getAttribute("width")?.trim() || "",
        height: element.getAttribute("height")?.trim() || "",
        sandbox: "",
        allow: "",
        type: element.getAttribute("type")?.trim() || "",
        visible: isVisible(element),
        dataSrc: ""
      });
    });

    document.querySelectorAll("video, audio").forEach((element) => {
      const tag = element.tagName.toLowerCase();
      const src = readMediaSrc(element);
      if (!src) return;
      pushItem({
        kind: tag as "video" | "audio",
        src,
        srcdocPreview: "",
        title: element.getAttribute("title")?.trim() || "",
        label: element.getAttribute("title")?.trim() || element.id || `${tag} ${index + 1}`,
        width: element.getAttribute("width")?.trim() || "",
        height: element.getAttribute("height")?.trim() || "",
        sandbox: "",
        allow: "",
        type: element.getAttribute("type")?.trim() || "",
        visible: isVisible(element),
        dataSrc: ""
      });
    });

    const widgetSelector = [
      "[data-embed]",
      "[data-iframe]",
      "[data-video-id]",
      "[data-module*='embed' i]",
      "[data-widget]",
      ".embed-code",
      ".embedded-content",
      ".iframe-embed"
    ].join(", ");

    document.querySelectorAll(widgetSelector).forEach((element) => {
      if (element.closest("iframe, embed, object, video, audio")) return;
      if (element.querySelector("iframe, embed, object, video, audio")) return;

      const dataSrc =
        element.getAttribute("data-src")?.trim() ||
        element.getAttribute("data-url")?.trim() ||
        element.getAttribute("data-video-id")?.trim() ||
        "";

      pushItem({
        kind: "widget",
        src: dataSrc,
        srcdocPreview: truncate(element.innerHTML || ""),
        title: element.getAttribute("title")?.trim() || "",
        label: widgetLabel(element),
        width: "",
        height: "",
        sandbox: "",
        allow: "",
        type: element.getAttribute("data-module")?.trim() || element.tagName.toLowerCase(),
        visible: isVisible(element),
        dataSrc
      });
    });

    return { items };
  });
}

export function emptyEmbedData(): EmbedData {
  return { items: [] };
}
