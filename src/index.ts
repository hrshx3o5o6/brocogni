import type { Page } from "playwright";
import { captureRawPageState } from "./observer/cdpObserver.js";
import { axToSemanticNodes } from "./semantic/infer.js";
import type { SemanticPageState } from "./types/schema.js";

export async function observeSemanticState(page: Page): Promise<SemanticPageState> {
  const raw = await captureRawPageState(page);
  const nodes = axToSemanticNodes(raw.axTree);

  return {
    summary: {
      url: page.url(),
      title: await page.title(),
      capturedAt: new Date().toISOString(),
      nodeCount: nodes.length,
      actionableCount: nodes.filter((n) => n.enabled).length
    },
    nodes
  };
}

export * from "./types/schema.js";
export * from "./context/compiler.js";
export * from "./selector/rank.js";
export * from "./selector/generate.js";
export * from "./runtime/service.js";
