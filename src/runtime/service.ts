import type { Page } from "playwright";
import { observeSemanticState } from "../index.js";
import type { ContextMode } from "../context/compiler.js";
import { compileContext } from "../context/compiler.js";
import type { SemanticNode, SemanticPageState } from "../types/schema.js";

export interface FindTargetsQuery {
  role?: string;
  purpose?: string;
  nameIncludes?: string;
  onlyEnabled?: boolean;
}

export class BrowserCognitionService {
  public async observePage(page: Page): Promise<SemanticPageState> {
    return observeSemanticState(page);
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

  public getSelectorPlan(state: SemanticPageState, nodeId: string): SemanticNode | undefined {
    return state.nodes.find((node) => node.id === nodeId);
  }
}
