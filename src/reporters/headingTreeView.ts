import { Heading } from "../extractors/headingExtractor";
import { escapeReportHtml } from "./pageReportLayout";

export interface HeadingTreeNode {
  level: number;
  text: string;
  index: number;
  hasIssue: boolean;
  children: HeadingTreeNode[];
}

export function buildHeadingTree(headings: Heading[], issueIndexes: Set<number> = new Set()): HeadingTreeNode[] {
  const roots: HeadingTreeNode[] = [];
  const stack: HeadingTreeNode[] = [];

  for (const heading of headings) {
    const node: HeadingTreeNode = {
      level: heading.level,
      text: heading.text,
      index: heading.index,
      hasIssue: issueIndexes.has(heading.index),
      children: []
    };

    while (stack.length && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  }

  return roots;
}

function renderHeadingTreeNodes(nodes: HeadingTreeNode[]): string {
  if (!nodes.length) {
    return `<li class="heading-tree-empty">No visible headings</li>`;
  }

  return nodes
    .map((node) => {
      const children = node.children.length
        ? `<ul class="heading-tree">${renderHeadingTreeNodes(node.children)}</ul>`
        : "";

      return `<li class="heading-tree-item level-${node.level}${node.hasIssue ? " has-issue" : ""}">
        <div class="heading-tree-row">
          <span class="heading-tree-tag">h${node.level}</span>
          <span class="heading-tree-text">${escapeReportHtml(node.text)}</span>
        </div>
        ${children}
      </li>`;
    })
    .join("");
}

export function renderHeadingTree(headings: Heading[], issueIndexes: Set<number> = new Set()): string {
  const tree = buildHeadingTree(headings, issueIndexes);
  return `<ul class="heading-tree">${renderHeadingTreeNodes(tree)}</ul>`;
}

export const headingTreeCss = `
  .heading-tree-columns {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  .heading-tree-panel {
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg-elevated);
    overflow: hidden;
    min-width: 0;
  }

  .heading-tree-panel-title {
    margin: 0;
    padding: 10px 12px;
    font-size: 13px;
    font-weight: 700;
    background: var(--table-head);
    border-bottom: 1px solid var(--border);
    color: var(--text);
  }

  .heading-tree-scroll {
    max-height: 520px;
    overflow: auto;
    padding: 12px 14px;
  }

  .heading-tree,
  .heading-tree ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .heading-tree > .heading-tree-item {
    margin: 0;
  }

  .heading-tree ul {
    margin-left: 14px;
    padding-left: 12px;
    border-left: 1px solid var(--border);
  }

  .heading-tree-item {
    margin: 0 0 8px;
  }

  .heading-tree-item:last-child {
    margin-bottom: 0;
  }

  .heading-tree-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    line-height: 1.4;
  }

  .heading-tree-tag {
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--accent);
    background: var(--accent-soft);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 2px 7px;
    margin-top: 1px;
  }

  .heading-tree-item.level-1 > .heading-tree-row .heading-tree-tag { color: #60a5fa; }
  .heading-tree-item.level-2 > .heading-tree-row .heading-tree-tag { color: #34d399; }
  .heading-tree-item.level-3 > .heading-tree-row .heading-tree-tag { color: #fbbf24; }
  .heading-tree-item.level-4 > .heading-tree-row .heading-tree-tag,
  .heading-tree-item.level-5 > .heading-tree-row .heading-tree-tag,
  .heading-tree-item.level-6 > .heading-tree-row .heading-tree-tag { color: #a78bfa; }

  .heading-tree-text {
    font-size: 13px;
    color: var(--text);
    word-break: break-word;
  }

  .heading-tree-item.has-issue > .heading-tree-row {
    background: var(--row-fail);
    border-radius: 6px;
    padding: 4px 6px;
    margin: -4px -6px;
  }

  .heading-tree-item.has-issue > .heading-tree-row .heading-tree-tag {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.35);
  }

  .heading-tree-empty {
    color: var(--muted);
    font-size: 13px;
    font-style: italic;
  }

  @media (max-width: 900px) {
    .heading-tree-columns {
      grid-template-columns: 1fr;
    }
  }
`;
