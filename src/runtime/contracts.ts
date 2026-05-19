import type { ContextMode } from "../context/compiler.js";
import type { SemanticNode, SemanticPageState } from "../types/schema.js";

export interface ObservePageRequest {
  mode?: ContextMode;
  budget?: number;
}

export interface ObservePageResponse {
  state: SemanticPageState;
}

export interface FindTargetsRequest {
  role?: string;
  purpose?: string;
  nameIncludes?: string;
  onlyEnabled?: boolean;
}

export interface FindTargetsResponse {
  matches: SemanticNode[];
  count: number;
}

export interface SelectorPlanResponse {
  nodeId: string;
  selectors: Array<{
    kind: "aria" | "css" | "xpath";
    value: string;
    score: number;
    reason: string;
  }>;
  fallbackChain: string[];
}

export interface VerifyActionRequest {
  nodeId: string;
  action: "click" | "fill" | "press" | "select";
}

export interface VerifyActionResponse {
  nodeId: string;
  action: "click" | "fill" | "press" | "select";
  canAct: boolean;
  preconditions: string[];
  failedChecks: string[];
}
