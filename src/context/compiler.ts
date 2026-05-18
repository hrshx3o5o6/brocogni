import type { SemanticNode, SemanticPageState } from "../types/schema.js";

export type ContextMode = "action" | "extract" | "debug";

function byMode(nodes: SemanticNode[], mode: ContextMode): SemanticNode[] {
  if (mode === "debug") return nodes;
  if (mode === "extract") return nodes.filter((n) => n.role !== "button");
  return nodes.filter((n) => n.enabled);
}

export function compileContext(state: SemanticPageState, mode: ContextMode, budget = 200): SemanticPageState {
  const filtered = byMode(state.nodes, mode).slice(0, budget);
  return {
    summary: {
      ...state.summary,
      nodeCount: filtered.length,
      actionableCount: filtered.filter((n) => n.enabled).length
    },
    nodes: filtered
  };
}
