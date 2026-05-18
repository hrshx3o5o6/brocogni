import type { Page } from "playwright";
import type { SemanticPageState } from "./types/schema.js";
export declare function observeSemanticState(page: Page): Promise<SemanticPageState>;
export * from "./types/schema.js";
export * from "./context/compiler.js";
export * from "./selector/rank.js";
