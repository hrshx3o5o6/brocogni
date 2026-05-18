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
function inferPurpose(role, name) {
    const n = (name ?? "").toLowerCase();
    if (role === "button" && /submit|save|confirm|continue/.test(n))
        return "form_submission";
    if (role === "textbox" && /search/.test(n))
        return "search_input";
    if (role === "link")
        return "navigation";
    return undefined;
}
export function axToSemanticNodes(axTree) {
    const nodes = Array.isArray(axTree?.nodes) ? axTree.nodes : [];
    const semantic = [];
    for (const node of nodes) {
        const role = node?.role?.value;
        if (!role || !ACTIONABLE_ROLES.has(role))
            continue;
        const name = node?.name?.value;
        const id = String(node?.nodeId ?? crypto.randomUUID());
        const disabled = (node?.properties ?? []).some((p) => p?.name === "disabled" && p?.value?.value === true);
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
