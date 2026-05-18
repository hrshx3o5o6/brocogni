import type { SelectorCandidate } from "../types/schema.js";
export interface RankFeatures {
    semantic: number;
    stability: number;
    uniqueness: number;
    resilience: number;
}
export declare function rankSelector(features: RankFeatures): number;
export declare function sortSelectors(candidates: SelectorCandidate[]): SelectorCandidate[];
