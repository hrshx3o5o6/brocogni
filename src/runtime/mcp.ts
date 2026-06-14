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

  function getClaudeConfigPath() {
    const platform = process.platform;
    if (platform === "darwin") {
      return expandHome("~/Library/Application Support/Claude/claude_desktop_config.json");
    } else if (platform === "win32") {
      const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
      return path.join(appData, "Claude", "claude_desktop_config.json");
    }
    return null;
  }

  console.log("\x1b[36m%s\x1b[0m", "⚙️  Browser Cognition MCP Installer");
  console.log("-----------------------------------------");

  const configPath = getClaudeConfigPath();
  if (!configPath) {
    console.error("\x1b[31m%s\x1b[0m", "❌ Error: Claude Desktop is only supported on macOS and Windows.");
    process.exit(1);
  }

  console.log(`📂 Target Config File: ${configPath}`);

  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let config: any = {};
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, "utf8");
      config = JSON.parse(raw);
    } catch {
      console.warn("\x1b[33m%s\x1b[0m", "⚠️  Warning: Existing config file could not be parsed. Initializing new one.");
    }
  }

  if (!config.mcpServers) {
    config.mcpServers = {};
  }

  let serverBlock = {};
  if (isLocalDev) {
    // Local dev setup
    const localMcpPath = path.resolve("./dist/src/runtime/mcp.js");
    console.log(`🔧 Local Dev Mode active. Pointing to: ${localMcpPath}`);
    serverBlock = {
      command: "node",
      args: [localMcpPath]
    };
  } else {
    // Production npx setup
    console.log("📦 Production mode active. Configuring to run via global NPX wrapper...");
    serverBlock = {
      command: "npx",
      args: ["-y", "browser-cognition-mcp"]
    };
  }

  config.mcpServers["browser-cognition"] = serverBlock;

  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
    console.log("\x1b[32m%s\x1b[0m", "✅ Success! Browser Cognition MCP registered successfully.");
    console.log("");
    console.log("👉 Next steps:");
    console.log("   1. Close and completely restart your Claude Desktop app.");
    console.log("   2. Verify that Playwright browsers are installed locally:");
    console.log("      \x1b[36mnpx playwright install chromium\x1b[0m");
    console.log("   3. Open a chat and verify the browser tools are available.");
    console.log("");
    process.exit(0);
  } catch (err: any) {
    console.error("\x1b[31m%s\x1b[0m", `❌ Error writing configuration file: ${err.message}`);
    process.exit(1);
  }
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
