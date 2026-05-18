function byMode(nodes, mode) {
    if (mode === "debug")
        return nodes;
    if (mode === "extract")
        return nodes.filter((n) => n.role !== "button");
    return nodes.filter((n) => n.enabled);
}
export function compileContext(state, mode, budget = 200) {
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
