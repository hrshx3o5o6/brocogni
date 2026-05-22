import type { SelectorCandidate, SemanticNode } from "../types/schema.js";
import { rankSelector } from "./rank.js";

const ROLE_TO_TAG: Record<string, string> = {
  button: "button",
  link: "a",
  textbox: "input",
  combobox: "select",
  checkbox: "input",
  radio: "input"
};

function cssEscape(value: string): string {
  return value.replace(/'/g, "\\'");
}

function fromRoleName(node: SemanticNode): SelectorCandidate[] {
  const out: SelectorCandidate[] = [];

  if (node.name) {
    out.push({
      kind: "aria",
      value: `role=${node.role}[name='${cssEscape(node.name)}']`,
      score: rankSelector({ semantic: 0.95, stability: 0.85, uniqueness: 0.6, resilience: 0.8 }),
      reason: "Primary semantic selector derived from role+accessible name."
    });
  }

  if (node.role === "button" && node.name) {
    out.push({
      kind: "xpath",
      value: `//button[normalize-space(text())='${cssEscape(node.name)}']`,
      score: rankSelector({ semantic: 0.7, stability: 0.5, uniqueness: 0.5, resilience: 0.4 }),
      reason: "Text-based fallback for button interaction when role locator fails."
    });
  }

  return out;
}

function generateRelationalSelectors(
  node: SemanticNode,
  allNodes: SemanticNode[],
  index: number
): SelectorCandidate[] {
  const out: SelectorCandidate[] = [];
  const currentTag = ROLE_TO_TAG[node.role] || "input";

  // 1. Sibling immediately before (Previous Sibling Positional Healing)
  if (index > 0) {
    const prevNode = allNodes[index - 1];
    if (
      prevNode &&
      prevNode.name &&
      prevNode.frameId === node.frameId &&
      prevNode.inShadowTree === node.inShadowTree
    ) {
      const prevTag = ROLE_TO_TAG[prevNode.role] || "*";
      const escapedPrevName = cssEscape(prevNode.name);

      // Playwright relative CSS sibling (+)
      out.push({
        kind: "css",
        value: `${prevTag}:has-text('${escapedPrevName}') + ${currentTag}`,
        score: rankSelector({ semantic: 0.6, stability: 0.6, uniqueness: 0.5, resilience: 0.7 }),
        reason: `Relational fallback: immediately follows named sibling <${prevTag}> "${prevNode.name}".`
      });

      // Relative XPath sibling
      out.push({
        kind: "xpath",
        value: `//${prevTag}[normalize-space()='${escapedPrevName}']/following-sibling::${currentTag}[1]`,
        score: rankSelector({ semantic: 0.55, stability: 0.55, uniqueness: 0.5, resilience: 0.65 }),
        reason: `XPath Relational fallback: immediately follows sibling "${prevNode.name}".`
      });
    }
  }

  // 2. Sibling immediately after (Next Sibling Positional Healing)
  if (index < allNodes.length - 1) {
    const nextNode = allNodes[index + 1];
    if (
      nextNode &&
      nextNode.name &&
      nextNode.frameId === node.frameId &&
      nextNode.inShadowTree === node.inShadowTree
    ) {
      const nextTag = ROLE_TO_TAG[nextNode.role] || "*";
      const escapedNextName = cssEscape(nextNode.name);

      // Relative XPath preceding sibling
      out.push({
        kind: "xpath",
        value: `//${nextTag}[normalize-space()='${escapedNextName}']/preceding-sibling::${currentTag}[1]`,
        score: rankSelector({ semantic: 0.55, stability: 0.55, uniqueness: 0.5, resilience: 0.65 }),
        reason: `XPath Relational fallback: immediately precedes sibling "${nextNode.name}".`
      });
    }
  }

  return out;
}

export function generateSelectorCandidates(
  node: SemanticNode,
  allNodes?: SemanticNode[],
  index?: number
): SelectorCandidate[] {
  const candidates = fromRoleName(node);

  if (allNodes && typeof index === "number") {
    const relational = generateRelationalSelectors(node, allNodes, index);
    candidates.push(...relational);
  }

  return candidates.sort((a, b) => b.score - a.score);
}
