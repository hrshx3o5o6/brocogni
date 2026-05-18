import type { SelectorCandidate, SemanticNode } from "../types/schema.js";
import { rankSelector } from "./rank.js";

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

export function generateSelectorCandidates(node: SemanticNode): SelectorCandidate[] {
  return fromRoleName(node).sort((a, b) => b.score - a.score);
}
