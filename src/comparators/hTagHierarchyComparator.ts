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

  const prodMismatchIndexes = new Set<number>();
  const devMismatchIndexes = new Set<number>();
  const prodSkipIndexes = new Set<number>();
  const devSkipIndexes = new Set<number>();

  let previousProd = 0;
  for (const heading of prod) {
    if (previousProd && heading.level > previousProd + 1) {
      prodSkipIndexes.add(heading.index);
    }
    previousProd = heading.level;
  }

  let previousDev = 0;
  for (const heading of dev) {
    if (previousDev && heading.level > previousDev + 1) {
      devSkipIndexes.add(heading.index);
    }
    previousDev = heading.level;
  }

  const count = Math.min(prodLevels.length, devLevels.length);
  for (let index = 0; index < count; index += 1) {
    if (prodLevels[index] !== devLevels[index]) {
      prodMismatchIndexes.add(prod[index].index);
      devMismatchIndexes.add(dev[index].index);
    }
  }

  const prodIssueIndexes = new Set([...prodMismatchIndexes, ...prodSkipIndexes]);
  const devIssueIndexes = new Set([...devMismatchIndexes, ...devSkipIndexes]);

  const result = statusFromIssues(issues, "H tag hierarchy matches");
  return {
    ...result,
    details: {
      prod,
      dev,
      prodSequence: prodLevels.map((level) => `h${level}`),
      devSequence: devLevels.map((level) => `h${level}`),
      prodIssueIndexes: [...prodIssueIndexes],
      devIssueIndexes: [...devIssueIndexes]
    }
  };
}
