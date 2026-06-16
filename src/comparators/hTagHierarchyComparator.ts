import { Heading } from "../extractors/headingExtractor";
import { CategoryResult, Issue, statusFromIssues } from "../utils/status";

function hierarchyIssues(headings: Heading[], source: "prod" | "dev"): Issue[] {
  const issues: Issue[] = [];
  let previous = 0;

  for (const heading of headings) {
    if (previous && heading.level > previous + 1) {
      issues.push({
        severity: "FAIL",
        category: "H tag hierarchy",
        source,
        message: `Heading hierarchy jumps from h${previous} to h${heading.level}`,
        prodValue: source === "prod" ? heading.text : undefined,
        devValue: source === "dev" ? heading.text : undefined
      });
    }
    previous = heading.level;
  }

  return issues;
}

export function compareHTagHierarchy(prod: Heading[], dev: Heading[]): CategoryResult {
  const issues: Issue[] = [
    ...hierarchyIssues(prod, "prod"),
    ...hierarchyIssues(dev, "dev")
  ];

  const prodLevels = prod.map((heading) => heading.level);
  const devLevels = dev.map((heading) => heading.level);

  if (prodLevels.length !== devLevels.length) {
    issues.push({
      severity: "WARNING",
      category: "H tag hierarchy",
      source: "comparison",
      message: "Visible heading count differs",
      prodValue: String(prodLevels.length),
      devValue: String(devLevels.length)
    });
  }

  const count = Math.min(prodLevels.length, devLevels.length);
  for (let index = 0; index < count; index += 1) {
    if (prodLevels[index] !== devLevels[index]) {
      issues.push({
        severity: "FAIL",
        category: "H tag hierarchy",
        source: "comparison",
        message: `Heading level differs at position ${index + 1}`,
        prodValue: `h${prodLevels[index]} ${prod[index].text}`,
        devValue: `h${devLevels[index]} ${dev[index].text}`
      });
    }
  }

  const result = statusFromIssues(issues, "H tag hierarchy matches");
  return {
    ...result,
    details: {
      prodSequence: prodLevels.map((level) => `h${level}`),
      devSequence: devLevels.map((level) => `h${level}`)
    }
  };
}
