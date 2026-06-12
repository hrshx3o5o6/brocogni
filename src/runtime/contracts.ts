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

export interface GetSelectorPlanRequest {
  state: SemanticPageState;
  nodeId: string;
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

export interface ScreenshotRequest {
  fullPage?: boolean;
}

export interface ScreenshotResponse {
  screenshot: string; // Base64 encoded PNG string
}

export interface VerifyActionRequest {
  nodeId: string;
  action: "click" | "fill" | "press" | "select" | "hover";
}

export interface VerifyActionResponse {
  nodeId: string;
  action: "click" | "fill" | "press" | "select" | "hover";
  canAct: boolean;
  preconditions: string[];
  failedChecks: string[];
}

export interface ObserveDeltaRequest {
  oldState: SemanticPageState;
  newState: SemanticPageState;
}

export interface ObserveDeltaResponse {
  added: SemanticNode[];
  removed: SemanticNode[];
  modified: SemanticNode[];
}
