import type { SemanticNode } from "../types/schema.js";

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

    semantic.push({
      id,
      role,
      name,
      purpose: inferPurpose(role, name),
      visible: true,
      enabled: !disabled,
      confidence: 0.7,
      bbox: undefined,
      selectors: [],
      attributes: {}
    });
  }

  return semantic;
}
