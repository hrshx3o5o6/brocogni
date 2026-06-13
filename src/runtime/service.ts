import type { Page } from "playwright";
import { observeSemanticState } from "../index.js";
import type { ContextMode } from "../context/compiler.js";
import { compileContext } from "../context/compiler.js";
import type { SemanticNode, SemanticPageState } from "../types/schema.js";
import type {
  FindTargetsRequest,
  FindTargetsResponse,
  ObservePageRequest,
  ObservePageResponse,
  SelectorPlanResponse,
  VerifyActionRequest,
  VerifyActionResponse,
  ObserveDeltaRequest,
  ObserveDeltaResponse
} from "./contracts.js";
import { computeDelta } from "./delta.js";

export interface FindTargetsQuery {
  role?: string;
  purpose?: string;
  nameIncludes?: string;
  onlyEnabled?: boolean;
}

export class BrowserCognitionService {
  private _lastObservedState: SemanticPageState | undefined;
  public async observePage(page: Page, request?: ObservePageRequest): Promise<ObservePageResponse> {
    const state = await observeSemanticState(page);
    this._lastObservedState = state;
    if (!request?.mode) return { state };
    return { state: compileContext(state, request.mode, request.budget ?? 200) };
  }

  public compile(state: SemanticPageState, mode: ContextMode, budget: number): SemanticPageState {
    return compileContext(state, mode, budget);
  }

  public findTargets(state: SemanticPageState, query: FindTargetsQuery): SemanticNode[] {
    const fragment = query.nameIncludes?.toLowerCase();
    return state.nodes.filter((node) => {
      if (query.role && node.role !== query.role) return false;
      if (query.purpose && node.purpose !== query.purpose) return false;
      if (query.onlyEnabled && !node.enabled) return false;
      if (fragment && !(node.name ?? "").toLowerCase().includes(fragment)) return false;
      return true;
    });
  }

  public findTargetsTool(state: SemanticPageState, request: FindTargetsRequest): FindTargetsResponse {
    const matches = this.findTargets(state, request);
    return { matches, count: matches.length };
  }

  public getSelectorPlan(state: SemanticPageState, nodeId: string): SelectorPlanResponse | undefined {
    const node = state.nodes.find((entry) => entry.id === nodeId);
    if (!node) return undefined;

    const selectors = node.selectors.map((selector) => ({
      kind: selector.kind,
      value: selector.value,
      score: selector.score,
      reason: selector.reason ?? "Fallback selector candidate."
    }));
    const fallbackChain = selectors.slice(1).map((selector) => selector.value);

    return { nodeId, selectors, fallbackChain };
  }

  public observeDelta(request: ObserveDeltaRequest): ObserveDeltaResponse {
    const oldState = request.oldState ?? this._lastObservedState;
    const newState = request.newState ?? this._lastObservedState;

    if (!oldState || !newState) {
      throw new Error("Cannot compute delta: insufficient state information. Ensure observePage has been called or provide both oldState and newState in the request.");
    }

    // Only update _lastObservedState if a new state was explicitly provided in the request
    if (request.newState) {
      this._lastObservedState = request.newState;
    }

    return computeDelta(oldState, newState);
  }

  public verifyAction(state: SemanticPageState, request: VerifyActionRequest): VerifyActionResponse {
    const node = state.nodes.find((entry) => entry.id === request.nodeId);
    if (!node) {
      return {
        nodeId: request.nodeId,
        action: request.action,
        canAct: false,
        preconditions: ["node_exists"],
        failedChecks: ["node_exists"]
      };
    }

    const preconditions = ["visible", "enabled", "has_selector_candidates"];
    const failedChecks: string[] = [];
    if (!node.visible) failedChecks.push("visible");
    if (!node.enabled) failedChecks.push("enabled");
    if (node.selectors.length === 0) failedChecks.push("has_selector_candidates");

    if (request.action === "fill" && node.role !== "textbox" && node.role !== "combobox") {
      failedChecks.push("supports_fill");
      preconditions.push("supports_fill");
    }

    if (request.action === "click" && node.role === "textbox") {
      failedChecks.push("supports_click_intent");
      preconditions.push("supports_click_intent");
    }

    return {
      nodeId: request.nodeId,
      action: request.action,
      canAct: failedChecks.length === 0,
      preconditions,
      failedChecks
    };
  }
}
