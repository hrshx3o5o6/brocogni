import type { SelectorCandidate } from "../types/schema.js";

export interface RankFeatures {
  semantic: number;
  stability: number;
  uniqueness: number;
  resilience: number;
}

export function rankSelector(features: RankFeatures): number {
  return (
    0.35 * features.semantic +
    0.3 * features.stability +
    0.2 * features.resilience +
    0.15 * features.uniqueness
  );
}

export function sortSelectors(candidates: SelectorCandidate[]): SelectorCandidate[] {
  return [...candidates].sort((a, b) => b.score - a.score);
}
