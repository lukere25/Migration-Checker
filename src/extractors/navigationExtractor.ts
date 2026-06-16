import { Page } from "@playwright/test";
import { LinkData } from "./linkExtractor";

export interface NavigationData {
  links: LinkData[];
  hoverMenus: Array<{
    label: string;
    href: string;
    opened: boolean;
    text: string;
    links: LinkData[];
    screenshotPath?: string;
  }>;
}

async function visibleLinks(locatorPage: Page, selector: string): Promise<LinkData[]> {
  return locatorPage.evaluate((rootSelector) => {
    const root = document.querySelector(rootSelector) || document.querySelector("header") || document.querySelector("nav") || document.body;
    const isVisible = (element: Element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    };

    return Array.from(root.querySelectorAll<HTMLAnchorElement>("a[href]"))
      .filter(isVisible)
      .map((link) => ({
        text: (link.textContent || "").replace(/\s+/g, " ").trim(),
        href: link.href,
        target: link.getAttribute("target"),
        rel: link.getAttribute("rel"),
        ariaLabel: link.getAttribute("aria-label")
      }));
  }, selector);
}

export async function extractNavigation(page: Page, screenshotDir?: string, source?: "prod" | "dev"): Promise<NavigationData> {
  const links = await visibleLinks(page, "header");
  const topLinks = links.filter((link) => link.text).slice(0, 6);
  const hoverMenus: NavigationData["hoverMenus"] = [];

  for (const [index, link] of topLinks.entries()) {
    try {
      if (page.isClosed()) break;

      const locator = page.locator("header a", { hasText: link.text }).first();
      if (!(await locator.isVisible({ timeout: 1000 }).catch(() => false))) continue;

      await locator.hover({ timeout: 2000 }).catch(() => undefined);
      await page.waitForTimeout(300).catch(() => undefined);

      const visibleMenu = page.locator('[role="menu"], [class*="mega" i], [class*="dropdown" i], header nav').last();
      const opened = await visibleMenu.isVisible({ timeout: 1000 }).catch(() => false);
      const text = opened ? ((await visibleMenu.innerText({ timeout: 2000 }).catch(() => "")) || "").replace(/\s+/g, " ").trim() : "";
      const menuLinks = opened ? await visibleLinks(page, "header").catch(() => []) : [];
      const screenshotPath = opened && screenshotDir ? `${screenshotDir}/${source || "page"}-hover-${index + 1}.png` : undefined;

      if (screenshotPath) {
        await page.screenshot({ path: screenshotPath, fullPage: false, timeout: 5000 }).catch(() => undefined);
      }

      hoverMenus.push({
        label: link.text,
        href: link.href,
        opened,
        text,
        links: menuLinks,
        screenshotPath
      });
    } catch {
      hoverMenus.push({
        label: link.text,
        href: link.href,
        opened: false,
        text: "",
        links: []
      });
    }
  }

  return { links, hoverMenus };
}
