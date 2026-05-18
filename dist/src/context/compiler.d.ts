import type { SemanticPageState } from "../types/schema.js";
export type ContextMode = "action" | "extract" | "debug";
export declare function compileContext(state: SemanticPageState, mode: ContextMode, budget?: number): SemanticPageState;
