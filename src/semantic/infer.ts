import type { SemanticNode } from "../types/schema.js";
import { generateSelectorCandidates } from "../selector/generate.js";

const ACTIONABLE_ROLES = new Set([
  "button",
  "link",
  "textbox",
  "combobox",
  "checkbox",
  "radio",
  "menuitem",
  "tab"
]);

function inferPurpose(role: string, name?: string): string | undefined {
  const n = (name ?? "").toLowerCase();
  if (role === "button" && /submit|save|confirm|continue/.test(n)) return "form_submission";
  if (role === "textbox" && /search/.test(n)) return "search_input";
  if (role === "link") return "navigation";
  return undefined;
}

function inferShadowTree(node: any): boolean {
  if (node?.isInShadowTree === true) return true;
  return (node?.properties ?? []).some((p: any) => {
    const key = String(p?.name ?? "").toLowerCase();
    return key.includes("shadow") && p?.value?.value === true;
  });
}

export function axToSemanticNodes(axTree: any): SemanticNode[] {
  const nodes = Array.isArray(axTree?.nodes) ? axTree.nodes : [];
  const semantic: SemanticNode[] = [];

  for (const node of nodes) {
    const role = node?.role?.value as string | undefined;
    if (!role || !ACTIONABLE_ROLES.has(role)) continue;

    const name = node?.name?.value as string | undefined;
    const id = String(node?.nodeId ?? crypto.randomUUID());
    const disabled = (node?.properties ?? []).some(
      (p: any) => p?.name === "disabled" && p?.value?.value === true
    );

    const attributes: Record<string, string> = {};
    if (node?.backendDOMNodeId !== undefined) {
      attributes.backendDOMNodeId = String(node.backendDOMNodeId);
    }
    for (const prop of node?.properties ?? []) {
      const k = prop?.name;
      const v = prop?.value?.value;
      if (k && v !== undefined) attributes[String(k)] = String(v);
    }

    const semanticNode: SemanticNode = {
      id,
      role,
      name,
      purpose: inferPurpose(role, name),
      visible: attributes.hidden !== "true",
      enabled: !disabled,
      confidence: name ? 0.82 : 0.7,
      bbox: undefined,
      selectors: [],
      attributes,
      frameId: node?.frameId ? String(node.frameId) : undefined,
      inShadowTree: inferShadowTree(node),
      source: "ax"
    };

    semantic.push(semanticNode);
  }

  // Second pass to generate selector candidates with context of structural neighbors
  for (let i = 0; i < semantic.length; i++) {
    semantic[i].selectors = generateSelectorCandidates(semantic[i], semantic, i);
  }

  return semantic;
}
