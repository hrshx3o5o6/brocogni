export function rankSelector(features) {
    return (0.35 * features.semantic +
        0.3 * features.stability +
        0.2 * features.resilience +
        0.15 * features.uniqueness);
}
export function sortSelectors(candidates) {
    return [...candidates].sort((a, b) => b.score - a.score);
}
