import { config } from "../config";
import { ContentData } from "../extractors/contentExtractor";
import { normalizeText, percentDifference } from "../utils/normalize";
import { CategoryResult, Issue } from "../utils/status";

function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const pairs = new Map<string, number>();
  for (let index = 0; index < a.length - 1; index += 1) {
    const pair = a.slice(index, index + 2);
    pairs.set(pair, (pairs.get(pair) || 0) + 1);
  }
  let intersection = 0;
  for (let index = 0; index < b.length - 1; index += 1) {
    const pair = b.slice(index, index + 2);
    const count = pairs.get(pair) || 0;
    if (count > 0) {
      pairs.set(pair, count - 1);
      intersection += 1;
    }
  }
  return (2 * intersection) / (a.length + b.length - 2);
}

function snippetsMissing(from: string, against: string): string[] {
  const sentences = from.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 40);
  return sentences.filter((sentence) => !normalizeText(against).includes(normalizeText(sentence).slice(0, 80))).slice(0, 5);
}

export function compareContent(prod: ContentData, dev: ContentData): CategoryResult {
  const similarity = diceCoefficient(normalizeText(prod.text), normalizeText(dev.text));
  const lengthDifference = percentDifference(prod.length, dev.length);
  const issues: Issue[] = [];

  if (!dev.length) {
    issues.push({ severity: "FAIL", category: "Content", source: "dev", message: "Dev page has empty main content" });
  }

  if (similarity < config.thresholds.contentSimilarityWarning) {
    issues.push({
      severity: "FAIL",
      category: "Content",
      source: "comparison",
      message: `Content similarity is below warning threshold (${Math.round(similarity * 100)}%)`,
      prodValue: `${prod.length} chars`,
      devValue: `${dev.length} chars`
    });
  } else if (similarity < config.thresholds.contentSimilarityPass) {
    issues.push({
      severity: "WARNING",
      category: "Content",
      source: "comparison",
      message: `Content similarity is below pass threshold (${Math.round(similarity * 100)}%)`,
      prodValue: `${prod.length} chars`,
      devValue: `${dev.length} chars`
    });
  }

  if (lengthDifference > 0.2) {
    issues.push({
      severity: "WARNING",
      category: "Content",
      source: "comparison",
      message: `Content length differs by ${Math.round(lengthDifference * 100)}%`,
      prodValue: `${prod.length}`,
      devValue: `${dev.length}`
    });
  }

  const status = issues.some((issue) => issue.severity === "FAIL") ? "FAIL" : issues.length ? "WARNING" : "PASS";
  return {
    status,
    summary: `Similarity ${Math.round(similarity * 100)}%, length delta ${Math.round(lengthDifference * 100)}%`,
    issues,
    details: {
      similarity,
      lengthDifference,
      missingSnippets: snippetsMissing(prod.text, dev.text),
      extraSnippets: snippetsMissing(dev.text, prod.text)
    }
  };
}
