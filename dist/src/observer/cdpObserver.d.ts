import type { Page } from "playwright";
import type { RawCapture } from "../types/schema.js";
export declare function captureRawPageState(page: Page): Promise<RawCapture>;
