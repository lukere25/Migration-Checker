import { FooterData } from "../extractors/footerExtractor";
import { LanguageData } from "../extractors/languageExtractor";
import { NavigationData } from "../extractors/navigationExtractor";
import { normalizeInternalHref, normalizeText } from "../utils/normalize";
import { CategoryResult, Issue, statusFromIssues } from "../utils/status";
import { compareLinks } from "./linkComparator";

export function compareNavigation(prod: NavigationData, dev: NavigationData): CategoryResult {
  const issues: Issue[] = [...compareLinks(prod.links, dev.links, "Header/navigation").issues];
  const prodMenus = new Map(prod.hoverMenus.map((menu) => [normalizeText(menu.label), menu]));
  const devMenus = new Map(dev.hoverMenus.map((menu) => [normalizeText(menu.label), menu]));

  for (const [label, prodMenu] of prodMenus) {
    const devMenu = devMenus.get(label);
    if (!devMenu) {
      issues.push({ severity: "FAIL", category: "Header/navigation", source: "dev", message: "Missing top-level hover menu", prodValue: prodMenu.label });
      continue;
    }
    if (prodMenu.opened && !devMenu.opened) {
      issues.push({ severity: "FAIL", category: "Header/navigation", source: "dev", message: "Hover menu did not open", prodValue: prodMenu.label, devValue: devMenu.label });
    }
    const prodDropdownLinks = new Set(prodMenu.links.map((link) => normalizeInternalHref(link.href)));
    const devDropdownLinks = new Set(devMenu.links.map((link) => normalizeInternalHref(link.href)));
    for (const href of prodDropdownLinks) {
      if (!devDropdownLinks.has(href)) {
        issues.push({ severity: "FAIL", category: "Header/navigation", source: "dev", message: "Missing dropdown link", prodValue: href });
      }
    }
  }

  const result = statusFromIssues(issues, "Header/navigation matches");
  return { ...result, details: { prod, dev } };
}

export function compareFooter(prod: FooterData, dev: FooterData): CategoryResult {
  const linkResult = compareLinks(prod.links, dev.links, "Footer");
  const issues: Issue[] = [...linkResult.issues];

  if (normalizeText(prod.copyrightText) !== normalizeText(dev.copyrightText)) {
    issues.push({
      severity: "WARNING",
      category: "Footer",
      source: "comparison",
      message: "Copyright text differs",
      prodValue: prod.copyrightText,
      devValue: dev.copyrightText
    });
  }

  const socialResult = compareLinks(prod.socialLinks, dev.socialLinks, "Footer social links");
  const legalResult = compareLinks(prod.legalLinks, dev.legalLinks, "Footer legal links");
  issues.push(...socialResult.issues, ...legalResult.issues);

  const result = statusFromIssues(issues, "Footer matches");
  return { ...result, details: { prod, dev } };
}

export function compareLanguage(prod: LanguageData, dev: LanguageData): CategoryResult {
  const issues: Issue[] = [];
  if (normalizeText(prod.htmlLang) !== normalizeText(dev.htmlLang)) {
    issues.push({
      severity: "WARNING",
      category: "Language",
      source: "comparison",
      message: "html lang differs",
      prodValue: prod.htmlLang,
      devValue: dev.htmlLang
    });
  }

  const devHreflang = new Set(dev.hreflang.map((item) => item.lang));
  for (const item of prod.hreflang) {
    if (!devHreflang.has(item.lang)) {
      issues.push({ severity: "WARNING", category: "Language", source: "dev", message: `Missing hreflang ${item.lang}` });
    }
  }

  for (const placeholder of dev.placeholders) {
    issues.push({
      severity: /undefined|null|\[object Object\]|\{\{|\}\}/i.test(placeholder) ? "FAIL" : "WARNING",
      category: "Language",
      source: "dev",
      message: `Placeholder or untranslated text found: ${placeholder}`
    });
  }

  const result = statusFromIssues(issues, "Language checks pass");
  return { ...result, details: { prod, dev } };
}
