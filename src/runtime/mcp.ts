#!/usr/bin/env node
import * as readline from "node:readline";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { chromium, Browser, BrowserContext, Page } from "playwright";
import { BrowserCognitionService } from "./service.js";
import { observeSemanticState, SemanticPageState } from "../index.js";
import { AGENT_INSTRUCTIONS } from "./prompts/instructions.js";

// Automatic installer/configurator command
if (process.argv.includes("install") || process.argv.includes("configure") || process.argv.includes("--configure")) {
  const isLocalDev = process.argv.includes("--local");

  function expandHome(filepath: string) {
    if (filepath.startsWith("~")) {
      return path.join(os.homedir(), filepath.slice(1));
    }
    return filepath;
  }

  const serverBlock = isLocalDev
    ? { command: "node", args: [path.resolve("./dist/src/runtime/mcp.js")] }
    : { command: "npx", args: ["-y", "browser-cognition-mcp"] };

  // Try configuring Claude Desktop if available
  const platform = process.platform;
  const configPath = (platform === "darwin")
    ? expandHome("~/Library/Application Support/Claude/claude_desktop_config.json")
    : (platform === "win32")
      ? path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "Claude", "claude_desktop_config.json")
      : null;

  if (configPath) {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    let config: any = {};
    if (fs.existsSync(configPath)) {
      try { config = JSON.parse(fs.readFileSync(configPath, "utf8")); }
      catch { console.warn("  Existing config malformed, creating new one."); }
    }
    if (!config.mcpServers) config.mcpServers = {};
    config.mcpServers["brocogni"] = serverBlock;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
    console.log("  Configured for Claude Desktop: " + configPath);
  } else {
    console.log("  Claude Desktop config path not found on this platform.");
  }

  console.log("");
  console.log("Brocogni registered. To connect it to your MCP client:");
  console.log("");
  console.log("  Claude Desktop    Restart the app (already configured)");
  console.log("  Claude Code       claude mcp add brocogni -- npx -y browser-cognition-mcp");
  console.log("  Cursor            Settings -> Features -> MCP -> Add New");
  console.log("                    Name: brocogni | Type: stdio | Cmd: npx -y browser-cognition-mcp");
  console.log("  OpenCode          Auto-detected via opencode.json in project root");
  console.log("");
  console.log("Make sure Playwright browsers are installed:");
  console.log("  npx playwright install chromium");
  console.log("");
  process.exit(0);
}

const service = new BrowserCognitionService();

let browserInstance: Browser | null = null;
let contextInstance: BrowserContext | null = null;
let pageInstance: Page | null = null;
let lastState: SemanticPageState | null = null;
let previousState: SemanticPageState | null = null;

async function getOrCreatePage(): Promise<Page> {
  try {
    if (!browserInstance) {
      try {
        browserInstance = await chromium.launch({ headless: false });
      } catch {
        try {
          browserInstance = await chromium.launch({ headless: true });
        } catch (err: any) {
          console.error("\n🚨 [Browser Cognition] Failed to launch Playwright Chromium.");
          console.error("   Please ensure Playwright browser binaries are installed by running:");
          console.error("   npx playwright install chromium\n");
          throw err;
        }
      }
    }
    if (!contextInstance) {
      contextInstance = await browserInstance.newContext();
    }
    if (!pageInstance) {
      pageInstance = await contextInstance.newPage();
    }
    return pageInstance;
  } catch (e: any) {
    throw new Error(`Failed to initialize browser session: ${e?.message || String(e)}. Make sure to run 'npx playwright install chromium' first.`);
  }
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
    description: "Compute the difference between two semantic states. Optional: pass parameters if querying offline; otherwise defaults to comparing the last two observed page states in memory.",
    inputSchema: {
      type: "object",
      properties: {
        oldState: { type: "object", description: "The previous SemanticPageState (optional, falls back to server-side cache)." },
        newState: { type: "object", description: "The current SemanticPageState (optional, falls back to server-side cache)." }
      }
    }
  },
  {
    name: "browser_verify",
    description: "Run safety action verification on a semantic node to confirm if it supports click/fill/hover and is interactable. Optional: pass 'state' if querying offline; otherwise defaults to last observed state.",
    inputSchema: {
      type: "object",
      properties: {
        state: { type: "object", description: "The current SemanticPageState (optional, falls back to server-side cache)." },
        nodeId: { type: "string", description: "The ID of the semantic node to verify." },
        action: { type: "string", enum: ["click", "fill", "press", "select", "hover"], description: "The action intent." }
      },
      required: ["nodeId", "action"]
    }
  },
  {
    name: "browser_act",
    description: "Execute an action (click, fill, hover) on a node using its ID. Optional: pass 'state' if querying offline; otherwise defaults to last observed state.",
    inputSchema: {
      type: "object",
      properties: {
        state: { type: "object", description: "The current SemanticPageState (optional, falls back to server-side cache)." },
        nodeId: { type: "string", description: "The ID of the semantic node." },
        action: { type: "string", enum: ["click", "fill", "hover"], description: "The action to execute." },
        text: { type: "string", description: "The text value to fill (required if action is 'fill')." }
      },
      required: ["nodeId", "action"]
    }
  },
  {
    name: "browser_get_selector_plan",
    description: "Retrieve the pre-computed selector plan (primary + healed fallback locators) for a specific semantic node. Optional: pass 'state' if querying offline; otherwise defaults to last observed state.",
    inputSchema: {
      type: "object",
      properties: {
        state: { type: "object", description: "The current SemanticPageState (optional, falls back to server-side cache)." },
        nodeId: { type: "string", description: "The ID of the semantic node." }
      },
      required: ["nodeId"]
    }
  },
  {
    name: "browser_find_targets",
    description: "Search the last observed page state for nodes matching specific criteria (role, name content, enabled state). Extremely fast and token-efficient.",
    inputSchema: {
      type: "object",
      properties: {
        role: { type: "string", description: "Filter by accessibility role (e.g. 'button', 'textbox')." },
        nameIncludes: { type: "string", description: "Filter by substring in the accessible name." },
        onlyEnabled: { type: "boolean", description: "Filter to only enabled/interactable elements." }
      }
    }
  },
  {
    name: "browser_screenshot",
    description: "Take a screenshot of the current page viewport and return it as a base64 encoded PNG string (useful for visual validation).",
    inputSchema: {
      type: "object",
      properties: {
        fullPage: { type: "boolean", description: "Take a screenshot of the full scrollable page." }
      }
    }
  },
  {
    name: "browser_evaluate",
    description: "Execute arbitrary JavaScript code in the page context and return the result. Fast and direct.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "JavaScript function body to execute in the page context." }
      },
      required: ["code"]
    }
  },
  {
    name: "browser_save_cookies",
    description: "Save page cookies to a file for session persistence.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to save cookies to (default: session_cookies.json)." }
      }
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
          tools: {},
          prompts: {}
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

    case "prompts/list":
      return {
        prompts: [
          {
            name: "write-robust-playwright-script",
            description: "Guidelines and prompts instructing agents on how to write resilient Playwright scripts using Browser Cognition."
          }
        ]
      };

    case "prompts/get": {
      const { name } = params || {};
      if (name === "write-robust-playwright-script") {
        return {
          description: "Instructions for writing resilient Playwright automation scripts.",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: AGENT_INSTRUCTIONS
              }
            }
          ]
        };
      }
      throw new Error(`Prompt not found: ${name}`);
    }

    default:
      throw new Error(`Method not found: ${method}`);
  }
}

async function executeTool(name: string, args: any): Promise<string> {
  switch (name) {
    case "browser_navigate": {
      const page = await getOrCreatePage();
      await page.goto(args.url, { waitUntil: "networkidle", timeout: 30000 });
      // Wait a bit for JS rendering
      await page.waitForTimeout(3000);
      return JSON.stringify({ success: true, url: page.url() });
    }

    case "browser_observe": {
      const page = await getOrCreatePage();
      const response = await service.observePage(page, args);
      previousState = lastState;
      lastState = response.state;
      return JSON.stringify({ success: true, message: "Page observed and state cached." });
    }

    case "browser_delta": {
      const oldState = args.oldState || previousState;
      const newState = args.newState || lastState;
      if (!oldState || !newState) {
        throw new Error("Cannot compute delta: must have at least two observed states cached. Please run browser_observe before and after your page interaction.");
      }
      const response = service.observeDelta({ oldState, newState });
      return JSON.stringify(response);
    }

    case "browser_verify": {
      const state = args.state || lastState;
      if (!state) {
        throw new Error("No page state available. Please run browser_observe first.");
      }
      const response = service.verifyAction(state, { nodeId: args.nodeId, action: args.action });
      return JSON.stringify(response);
    }

    case "browser_act": {
      const { nodeId, action, text } = args;
      const state = args.state || lastState;
      if (!state) {
        throw new Error("No page state available. Please run browser_observe first.");
      }
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

          await locator.waitFor({ timeout: 10000 });
          if (action === "click") {
            await locator.click({ timeout: 10000 });
          } else if (action === "fill") {
            await locator.fill(text ?? "");
          } else if (action === "hover") {
            await locator.hover();
          }
          success = true;
          break;
        } catch (e: any) {
          errorMsg = e?.message || String(e);
          // Fallback: try force click via JS evaluation
          try {
            const el = await page.locator(selector.value).elementHandle();
            if (el) {
              await page.evaluate((el) => el.scrollIntoView({ block: "center" }), el);
              await el.click();
              success = true;
              break;
            }
          } catch (_) {
            // continue to next selector
          }
        }
      }

      if (!success) {
        throw new Error(`Action execution failed across all selectors in plan: ${errorMsg}`);
      }

      return JSON.stringify({ success: true, message: `Successfully executed ${action} on node ${nodeId}` });
    }

    case "browser_get_selector_plan": {
      const state = args.state || lastState;
      if (!state) {
        throw new Error("No page state available. Please run browser_observe first.");
      }
      const plan = service.getSelectorPlan(state, args.nodeId);
      if (!plan) {
        throw new Error(`Node ID not found: ${args.nodeId}`);
      }
      return JSON.stringify(plan);
    }

    case "browser_find_targets": {
      const state = args.state || lastState;
      if (!state) {
        throw new Error("No page state available. Please run browser_observe first.");
      }
      const response = service.findTargetsTool(state, args);
      return JSON.stringify(response);
    }

    case "browser_screenshot": {
      const page = await getOrCreatePage();
      const buffer = await page.screenshot({ fullPage: args.fullPage ?? false });
      const base64 = buffer.toString("base64");
      return JSON.stringify({ screenshot: base64 });
    }

    case "browser_info": {
      const page = await getOrCreatePage();
      const info = await page.evaluate(() => ({
        url: location.href,
        title: document.title,
        bodyText: document.body?.innerText?.substring(0, 500) ?? "",
        iframeCount: document.querySelectorAll("iframe").length,
        mainElementCount: document.querySelectorAll("main, [role='main'], article, section").length,
      }));
      return JSON.stringify(info);
    }

    case "browser_evaluate": {
      const page = await getOrCreatePage();
      const result = await page.evaluate((fnBody: string) => {
        const fn = new Function(fnBody);
        return fn();
      }, args.code);
      return JSON.stringify({ success: true, result });
    }

    case "browser_save_cookies": {
      const page = await getOrCreatePage();
      const cookies = await page.context().cookies();
      const fs = await import("fs");
      fs.writeFileSync(args.path ?? "session_cookies.json", JSON.stringify(cookies, null, 2));
      return JSON.stringify({ success: true, count: cookies.length });
    }

    case "browser_run_script": {
      const page = await getOrCreatePage();
      const cdp = await page.context().newCDPSession(page);
      const result = await page.evaluate(args.code);
      return JSON.stringify({ success: true, result });
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
