#!/usr/bin/env node
import * as readline from "node:readline";
import { chromium, Browser, BrowserContext, Page } from "playwright";
import { BrowserCognitionService } from "./service.js";
import { observeSemanticState } from "../index.js";

const service = new BrowserCognitionService();

let browserInstance: Browser | null = null;
let contextInstance: BrowserContext | null = null;
let pageInstance: Page | null = null;

async function getOrCreatePage(): Promise<Page> {
  if (!browserInstance) {
    try {
      browserInstance = await chromium.launch({ headless: false });
    } catch {
      browserInstance = await chromium.launch({ headless: true });
    }
  }
  if (!contextInstance) {
    contextInstance = await browserInstance.newContext();
  }
  if (!pageInstance) {
    pageInstance = await contextInstance.newPage();
  }
  return pageInstance;
}

async function cleanup() {
  if (pageInstance) await pageInstance.close().catch(() => {});
  if (contextInstance) await contextInstance.close().catch(() => {});
  if (browserInstance) await browserInstance.close().catch(() => {});
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

const TOOLS = [
  {
    name: "browser_navigate",
    description: "Launch the browser and navigate to a URL, or navigate the active tab to a new URL.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to navigate to." }
      },
      required: ["url"]
    }
  },
  {
    name: "browser_observe",
    description: "Observe and extract the structured semantic state of the current active page, filtering out DOM noise. Note: If you see dropdowns/menus with `expanded: false`, you must hover them to reveal contents, then observe again.",
    inputSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["action", "extract", "debug"], description: "Context compilation mode." },
        budget: { type: "number", description: "Maximum node budget for token optimization." }
      }
    }
  },
  {
    name: "browser_delta",
    description: "Compute the difference between a previous semantic state and a new semantic state (useful to identify dropdown listings/updates after interaction).",
    inputSchema: {
      type: "object",
      properties: {
        oldState: { type: "object", description: "The previous SemanticPageState." },
        newState: { type: "object", description: "The current SemanticPageState." }
      },
      required: ["oldState", "newState"]
    }
  },
  {
    name: "browser_verify",
    description: "Run safety action verification on a semantic node to confirm if it supports click/fill and is interactable.",
    inputSchema: {
      type: "object",
      properties: {
        state: { type: "object", description: "The current SemanticPageState." },
        nodeId: { type: "string", description: "The ID of the semantic node to verify." },
        action: { type: "string", enum: ["click", "fill", "press", "select"], description: "The action intent." }
      },
      required: ["state", "nodeId", "action"]
    }
  },
  {
    name: "browser_act",
    description: "Execute an action (click, fill) on a node using its ID. Ensures high stability using pre-baked selector fallback chains.",
    inputSchema: {
      type: "object",
      properties: {
        state: { type: "object", description: "The current SemanticPageState to locate the node and its selector fallback chain." },
        nodeId: { type: "string", description: "The ID of the semantic node." },
        action: { type: "string", enum: ["click", "fill"], description: "The action to execute." },
        text: { type: "string", description: "The text value to fill (required if action is 'fill')." }
      },
      required: ["state", "nodeId", "action"]
    }
  }
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on("line", async (line) => {
  if (!line.trim()) return;

  let request: any;
  try {
    request = JSON.parse(line);
  } catch (err) {
    sendError(null, -32700, "Parse error");
    return;
  }

  if (request.jsonrpc !== "2.0") {
    sendError(request.id, -32600, "Invalid Request");
    return;
  }

  try {
    const result = await handleRequest(request.method, request.params);
    sendResult(request.id, result);
  } catch (err: any) {
    sendError(request.id, -32603, err?.message || String(err));
  }
});

async function handleRequest(method: string, params: any): Promise<any> {
  switch (method) {
    case "initialize":
      return {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: "browser-cognition-mcp",
          version: "0.1.0"
        }
      };

    case "tools/list":
      return { tools: TOOLS };

    case "tools/call": {
      const { name, arguments: args } = params || {};
      const resultText = await executeTool(name, args);
      return {
        content: [{ type: "text", text: resultText }]
      };
    }

    default:
      throw new Error(`Method not found: ${method}`);
  }
}

async function executeTool(name: string, args: any): Promise<string> {
  switch (name) {
    case "browser_navigate": {
      const page = await getOrCreatePage();
      await page.goto(args.url, { waitUntil: "domcontentloaded" });
      return JSON.stringify({ success: true, url: page.url() });
    }

    case "browser_observe": {
      const page = await getOrCreatePage();
      const response = await service.observePage(page, args);
      return JSON.stringify(response.state);
    }

    case "browser_delta": {
      const response = service.observeDelta(args);
      return JSON.stringify(response);
    }

    case "browser_verify": {
      const response = service.verifyAction(args.state, { nodeId: args.nodeId, action: args.action });
      return JSON.stringify(response);
    }

    case "browser_act": {
      const { state, nodeId, action, text } = args;
      const page = await getOrCreatePage();

      const plan = service.getSelectorPlan(state, nodeId);
      if (!plan || plan.selectors.length === 0) {
        throw new Error(`No selector plan found for node ID: ${nodeId}`);
      }

      // Preflight verify action
      const preflight = service.verifyAction(state, { nodeId, action });
      if (!preflight.canAct) {
        throw new Error(`Preflight check failed: ${preflight.failedChecks.join(", ")}`);
      }

      let success = false;
      let errorMsg = "";

      for (const selector of plan.selectors) {
        try {
          let locator;
          if (selector.kind === "aria") {
            const match = selector.value.match(/role=(\w+)\[name='(.*)'\]/);
            if (match) {
              const [, role, nameVal] = match;
              locator = page.getByRole(role as any, { name: nameVal });
            } else {
              locator = page.locator(selector.value);
            }
          } else {
            locator = page.locator(selector.value);
          }

          await locator.waitFor({ timeout: 3000 });
          if (action === "click") {
            await locator.click();
          } else if (action === "fill") {
            await locator.fill(text ?? "");
          }
          success = true;
          break;
        } catch (e: any) {
          errorMsg = e?.message || String(e);
        }
      }

      if (!success) {
        throw new Error(`Action execution failed across all selectors in plan: ${errorMsg}`);
      }

      return JSON.stringify({ success: true, message: `Successfully executed ${action} on node ${nodeId}` });
    }

    default:
      throw new Error(`Tool not found: ${name}`);
  }
}

function sendResult(id: string | number | null, result: any) {
  if (id === null) return;
  console.log(JSON.stringify({
    jsonrpc: "2.0",
    id,
    result
  }));
}

function sendError(id: string | number | null, code: number, message: string) {
  console.log(JSON.stringify({
    jsonrpc: "2.0",
    id,
    error: { code, message }
  }));
}
