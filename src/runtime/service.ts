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
  SelectorPlanResponse
} from "./contracts.js";

export interface FindTargetsQuery {
  role?: string;
  purpose?: string;
  nameIncludes?: string;
  onlyEnabled?: boolean;
}

export class BrowserCognitionService {
  public async observePage(page: Page, request?: ObservePageRequest): Promise<ObservePageResponse> {
    const state = await observeSemanticState(page);
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
}
