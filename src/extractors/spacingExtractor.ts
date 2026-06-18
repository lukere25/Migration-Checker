import { Page } from "@playwright/test";

export interface SpacingGapColor {
  border: string;
  fill: string;
  name: string;
}

export const SPACING_GAP_COLORS: SpacingGapColor[] = [
  { border: "#a855f7", fill: "rgba(168,85,247,0.2)", name: "Purple" },
  { border: "#eab308", fill: "rgba(234,179,8,0.2)", name: "Yellow" },
  { border: "#ec4899", fill: "rgba(236,72,153,0.2)", name: "Pink" },
  { border: "#38bdf8", fill: "rgba(56,189,248,0.2)", name: "Blue" },
  { border: "#f97316", fill: "rgba(249,115,22,0.2)", name: "Orange" },
  { border: "#22c55e", fill: "rgba(34,197,94,0.2)", name: "Green" },
  { border: "#ef4444", fill: "rgba(239,68,68,0.2)", name: "Red" },
  { border: "#8b5cf6", fill: "rgba(139,92,246,0.2)", name: "Violet" },
  { border: "#14b8a6", fill: "rgba(20,184,166,0.2)", name: "Teal" },
  { border: "#64748b", fill: "rgba(100,116,139,0.2)", name: "Slate" },
  { border: "#0ea5e9", fill: "rgba(14,165,233,0.2)", name: "Sky" },
  { border: "#d946ef", fill: "rgba(217,70,239,0.2)", name: "Fuchsia" },
  { border: "#84cc16", fill: "rgba(132,204,22,0.2)", name: "Lime" },
  { border: "#fb7185", fill: "rgba(251,113,133,0.2)", name: "Rose" },
  { border: "#06b6d4", fill: "rgba(6,182,212,0.2)", name: "Cyan" }
];

export function gapColorAt(index: number): SpacingGapColor {
  return SPACING_GAP_COLORS[index % SPACING_GAP_COLORS.length];
}

export interface ModuleBlock {
  index: number;
  label: string;
  tag: string;
  top: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

export interface ModuleSection {
  index: number;
  label: string;
  tag: string;
  top: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
  marginBottom: number;
  marginTop: number;
  paddingBottom: number;
  paddingTop: number;
  blocks: ModuleBlock[];
}

export interface ModuleGap {
  index: number;
  scope: "between-sections" | "inside-section";
  parentSectionLabel?: string;
  fromLabel: string;
  toLabel: string;
  gapPx: number;
  fromBottom: number;
  toTop: number;
  left: number;
  width: number;
  prodScreenshot?: string;
  devScreenshot?: string;
}

export interface ModuleSpacingData {
  wrapperLabel: string;
  sections: ModuleSection[];
  gaps: ModuleGap[];
  overviewProdScreenshot?: string;
  overviewDevScreenshot?: string;
}

export async function extractModuleSpacing(page: Page): Promise<ModuleSpacingData> {
  return page.evaluate(() => {
    function isVisible(element: Element): boolean {
      const htmlElement = element as HTMLElement;
      const style = window.getComputedStyle(htmlElement);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
        return false;
      }
      const rect = htmlElement.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    function isMeaningfulSection(element: Element): boolean {
      if (!isVisible(element)) return false;
      const rect = (element as HTMLElement).getBoundingClientRect();
      return rect.width > 80 && rect.height > 20;
    }

    function isMeaningfulInternalBlock(element: Element): boolean {
      if (!isVisible(element)) return false;
      const htmlElement = element as HTMLElement;
      const rect = htmlElement.getBoundingClientRect();
      const tag = htmlElement.tagName.toLowerCase();
      if (["script", "style", "noscript", "svg", "path", "br", "hr"].includes(tag)) return false;
      if (rect.width < 32 || rect.height < 10) return false;
      if (rect.width > 40 && rect.height > 10) return true;
      return false;
    }

    function blockLabel(element: Element): string {
      const tag = element.tagName.toLowerCase();
      if (tag === "img") {
        const alt = element.getAttribute("alt")?.trim();
        if (alt) return `img: ${alt}`.slice(0, 80);
        return "image";
      }
      if (tag === "button" || tag === "a") {
        const text = element.textContent?.replace(/\s+/g, " ").trim();
        if (text) return text.slice(0, 80);
      }

      const heading = element.querySelector(":scope > h1,:scope > h2,:scope > h3,:scope > h4,:scope > h5,:scope > h6");
      const headingText = heading?.textContent?.replace(/\s+/g, " ").trim();
      if (headingText) return headingText.slice(0, 80);

      const ownHeading = element.matches("h1,h2,h3,h4,h5,h6")
        ? element.textContent?.replace(/\s+/g, " ").trim()
        : "";
      if (ownHeading) return ownHeading.slice(0, 80);

      const aria = element.getAttribute("aria-label")?.trim();
      if (aria) return aria.slice(0, 80);

      const id = element.id?.trim();
      if (id) return `#${id}`.slice(0, 80);

      const className = element.className?.toString().trim().split(/\s+/).slice(0, 2).join(".");
      if (className) return `${tag}.${className}`.slice(0, 80);

      return tag;
    }

    function dedupeNested(elements: HTMLElement[]): HTMLElement[] {
      const result: HTMLElement[] = [];
      for (const element of elements) {
        if (result.some((existing) => existing.contains(element) || element.contains(existing))) continue;
        result.push(element);
      }
      return result;
    }

    function isWrapperLike(element: HTMLElement): boolean {
      const tag = element.tagName.toLowerCase();
      if (tag !== "div" && tag !== "main" && tag !== "section" && tag !== "article") return false;
      const className = element.className?.toString().toLowerCase() || "";
      return (
        /wrapper|container|content|layout|page|grid|inner|main|body|row|col|stack|group|hero|banner/.test(className) ||
        element.children.length >= 2
      );
    }

    function rectMetrics(element: HTMLElement) {
      const rect = element.getBoundingClientRect();
      return {
        top: Math.round(rect.top + window.scrollY),
        bottom: Math.round(rect.bottom + window.scrollY),
        left: Math.round(rect.left + window.scrollX),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      };
    }

    function blockFromElement(element: HTMLElement, index: number) {
      const metrics = rectMetrics(element);
      return {
        index,
        label: blockLabel(element),
        tag: element.tagName.toLowerCase(),
        ...metrics
      };
    }

    function collectSectionElements(root: HTMLElement): HTMLElement[] {
      const blockTags = new Set(["section", "article", "header", "footer", "aside", "nav", "div", "main"]);

      let candidates = Array.from(root.children).filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement && blockTags.has(element.tagName.toLowerCase()) && isMeaningfulSection(element)
      );

      if (candidates.length === 1 && isWrapperLike(candidates[0])) {
        const inner = Array.from(candidates[0].children).filter(
          (element): element is HTMLElement =>
            element instanceof HTMLElement &&
            blockTags.has(element.tagName.toLowerCase()) &&
            isMeaningfulSection(element)
        );
        if (inner.length >= 2) candidates = inner;
      }

      if (candidates.length < 2) {
        const nested = Array.from(
          root.querySelectorAll<HTMLElement>(
            ":scope > section, :scope > article, :scope > div > section, :scope > div > article"
          )
        ).filter(isMeaningfulSection);
        if (nested.length >= 2) candidates = dedupeNested(nested);
      }

      return dedupeNested(candidates).sort(
        (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top
      );
    }

    function collectInternalBlockElements(sectionEl: HTMLElement): HTMLElement[] {
      const inlineTags = new Set([
        "span",
        "strong",
        "em",
        "b",
        "i",
        "small",
        "label",
        "time",
        "br",
        "svg",
        "path"
      ]);

      function directBlocks(parent: HTMLElement): HTMLElement[] {
        return Array.from(parent.children).filter((element): element is HTMLElement => {
          if (!(element instanceof HTMLElement)) return false;
          const tag = element.tagName.toLowerCase();
          if (inlineTags.has(tag)) return false;
          return isMeaningfulInternalBlock(element);
        });
      }

      let blocks = directBlocks(sectionEl);

      let unwrapGuard = 0;
      while (blocks.length === 1 && isWrapperLike(blocks[0]) && unwrapGuard < 4) {
        const inner = directBlocks(blocks[0]);
        if (inner.length >= 2) {
          blocks = inner;
          unwrapGuard += 1;
        } else {
          break;
        }
      }

      if (blocks.length < 2) {
        const deeper = Array.from(sectionEl.querySelectorAll<HTMLElement>(":scope > * > *")).filter(
          isMeaningfulInternalBlock
        );
        const deduped = dedupeNested(deeper);
        if (deduped.length >= 2) blocks = deduped;
      }

      if (blocks.length < 2) {
        const visual = Array.from(
          sectionEl.querySelectorAll<HTMLElement>(
            "img, picture, button, a, h1, h2, h3, h4, h5, h6, p, ul, ol, form, table, figure, video, blockquote"
          )
        ).filter(isMeaningfulInternalBlock);
        const deduped = dedupeNested(visual);
        if (deduped.length >= 2) blocks = deduped;
      }

      return dedupeNested(blocks).sort(
        (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top
      );
    }

    function buildInternalGaps(
      sectionLabel: string,
      sectionTop: number,
      sectionLeft: number,
      sectionWidth: number,
      blocks: ReturnType<typeof blockFromElement>[]
    ) {
      const internalGaps: Array<{
        scope: "inside-section";
        parentSectionLabel: string;
        fromLabel: string;
        toLabel: string;
        gapPx: number;
        fromBottom: number;
        toTop: number;
        left: number;
        width: number;
      }> = [];

      if (!blocks.length) return internalGaps;

      if (blocks[0].top > sectionTop + 3) {
        internalGaps.push({
          scope: "inside-section",
          parentSectionLabel: sectionLabel,
          fromLabel: `${sectionLabel} top`,
          toLabel: blocks[0].label,
          gapPx: Math.max(0, blocks[0].top - sectionTop),
          fromBottom: sectionTop,
          toTop: blocks[0].top,
          left: Math.min(sectionLeft, blocks[0].left),
          width: Math.max(sectionWidth, blocks[0].width)
        });
      }

      blocks.slice(0, -1).forEach((block, blockIndex) => {
        const following = blocks[blockIndex + 1];
        if (!following) return;
        internalGaps.push({
          scope: "inside-section",
          parentSectionLabel: sectionLabel,
          fromLabel: block.label,
          toLabel: following.label,
          gapPx: Math.max(0, following.top - block.bottom),
          fromBottom: block.bottom,
          toTop: following.top,
          left: Math.min(block.left, following.left),
          width: Math.max(block.width, following.width)
        });
      });

      return internalGaps;
    }

    function findMainWrapper(): { element: HTMLElement; label: string } {
      const selectors = [
        "main",
        '[role="main"]',
        "#content",
        "#main-content",
        ".main-content",
        ".page-content",
        ".content-area",
        "#main",
        ".main",
        "article"
      ];

      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element instanceof HTMLElement && isMeaningfulSection(element)) {
          return { element, label: selector };
        }
      }

      return { element: document.body, label: "body" };
    }

    const { element: wrapper, label: wrapperLabel } = findMainWrapper();
    const sectionElements = collectSectionElements(wrapper);

    const sectionPairs = sectionElements
      .map((element) => {
        const metrics = rectMetrics(element);
        const style = window.getComputedStyle(element);
        const internalElements = collectInternalBlockElements(element);
        const blocks = internalElements
          .map((blockEl, blockIndex) => blockFromElement(blockEl, blockIndex))
          .sort((a, b) => a.top - b.top)
          .map((block, blockIndex) => ({ ...block, index: blockIndex }));

        return {
          label: blockLabel(element),
          tag: element.tagName.toLowerCase(),
          ...metrics,
          marginBottom: Math.round(parseFloat(style.marginBottom) || 0),
          marginTop: Math.round(parseFloat(style.marginTop) || 0),
          paddingBottom: Math.round(parseFloat(style.paddingBottom) || 0),
          paddingTop: Math.round(parseFloat(style.paddingTop) || 0),
          blocks
        };
      })
      .sort((a, b) => a.top - b.top)
      .map((section, index) => ({ ...section, index }));

    const gaps: ModuleGap[] = [];
    const wrapperRect = wrapper.getBoundingClientRect();
    const wrapperTop = Math.round(wrapperRect.top + window.scrollY);
    const wrapperLeft = Math.round(wrapperRect.left + window.scrollX);
    const wrapperWidth = Math.round(wrapperRect.width);

    const pushGap = (gap: Omit<ModuleGap, "index">) => {
      gaps.push({ ...gap, index: gaps.length });
    };

    if (sectionPairs.length > 0 && sectionPairs[0].top > wrapperTop + 3) {
      pushGap({
        scope: "between-sections",
        fromLabel: "Top of main content",
        toLabel: sectionPairs[0].label,
        gapPx: Math.max(0, sectionPairs[0].top - wrapperTop),
        fromBottom: wrapperTop,
        toTop: sectionPairs[0].top,
        left: Math.min(wrapperLeft, sectionPairs[0].left),
        width: Math.max(wrapperWidth, sectionPairs[0].width)
      });
    }

    sectionPairs.forEach((section, sectionIndex) => {
      const internalGaps = buildInternalGaps(
        section.label,
        section.top,
        section.left,
        section.width,
        section.blocks
      );

      internalGaps.forEach((gap) => pushGap(gap));

      const following = sectionPairs[sectionIndex + 1];
      if (!following) return;

      pushGap({
        scope: "between-sections",
        fromLabel: section.label,
        toLabel: following.label,
        gapPx: Math.max(0, following.top - section.bottom),
        fromBottom: section.bottom,
        toTop: following.top,
        left: Math.min(section.left, following.left),
        width: Math.max(section.width, following.width)
      });
    });

    return { wrapperLabel, sections: sectionPairs, gaps };
  });
}

export function emptyModuleSpacingData(): ModuleSpacingData {
  return { wrapperLabel: "", sections: [], gaps: [] };
}

export async function drawSpacingGapMarkers(
  page: Page,
  data: ModuleSpacingData,
  palette: SpacingGapColor[]
): Promise<void> {
  await page.evaluate(
    ({ payload, colors }) => {
      document.getElementById("sync-scope-spacing-overlay")?.remove();

      const overlay = document.createElement("div");
      overlay.id = "sync-scope-spacing-overlay";
      overlay.style.cssText = "position:absolute;left:0;top:0;z-index:2147483646;pointer-events:none;";

      payload.gaps.forEach((gap, index) => {
        const color = colors[index % colors.length];
        const gapHeight = Math.max(4, gap.toTop - gap.fromBottom);
        const borderStyle = gap.scope === "inside-section" ? "dashed" : "solid";
        const band = document.createElement("div");
        band.style.cssText = [
          "position:absolute",
          `left:${gap.left}px`,
          `top:${gap.fromBottom}px`,
          `width:${Math.max(48, gap.width)}px`,
          `height:${gapHeight}px`,
          `border:2px ${borderStyle} ${color.border}`,
          `background:${color.fill}`,
          "box-sizing:border-box"
        ].join(";");

        const tag = document.createElement("div");
        tag.textContent = `${gap.gapPx}px`;
        tag.style.cssText = [
          "position:absolute",
          "right:0",
          "top:50%",
          "transform:translate(calc(100% + 6px),-50%)",
          `background:${color.border}`,
          "color:#fff",
          "font:700 11px/1.2 sans-serif",
          "padding:3px 7px",
          "border-radius:4px",
          "white-space:nowrap",
          "box-shadow:0 1px 3px rgba(0,0,0,0.25)"
        ].join(";");
        band.appendChild(tag);
        overlay.appendChild(band);
      });

      document.body.appendChild(overlay);
    },
    { payload: data, colors: palette }
  );
}

export async function removeSpacingOverlay(page: Page): Promise<void> {
  await page.evaluate(() => document.getElementById("sync-scope-spacing-overlay")?.remove());
}
