# Browser Cognition Framework (SDK & MCP)

An intelligent semantic observation and self-healing selector engine that bridges the gap between fragile web layouts and robust browser automation. Built to eliminate the manual DevTools inspection bottleneck for developers and AI agents.

---

## 💡 The Vision

Most browser automation scripts (written in Playwright, Selenium, or Puppeteer) are incredibly fragile. When a developer or AI assistant writes code to scrape a page or click a button, they rely on highly specific class names (e.g. `.btn-primary`, `.css-x83kf2`, Tailwind utility classes) or structural selectors. The moment the frontend builds again or classes shift, **the script breaks**, requiring human engineers to inspect the page and manually rewrite the selectors.

**Browser Cognition** provides an **intelligence and selector-healing layer** that translates noisy DOM layouts into a logical, human-like representation. Instead of scraping hardcoded classes, it dynamically analyzes accessibility trees, solves lazy-rendering states (menus/hover-cards), and builds self-healing selector plans on the fly.

---

## 🚀 Key Capabilities

1. **Logical Accessibility-Tree Observation (`browser_observe`)**
   * Bypasses thousands of lines of messy DOM div-noise.
   * Compiles layouts into clean, logical semantic nodes containing accessible names, roles, visibility scores, and physical geometries.

2. **Phase 2 Selector Healing Engine**
   * Computes a hierarchy of fallback selectors ranging from highly specific semantic locators to **relative relational sibling locators** (e.g. XPath `preceding-sibling`, `following-sibling`, and relative CSS `+`).
   * If a target element has no direct accessible name, the engine automatically anchors it to a nearby named parent or sibling element.

3. **Lazy-Rendering Discovery**
   * Standard accessibility trees omit lazily rendered dropdown menus and cards while they are collapsed.
   * Detects collapsed states (`"expanded": "false"`) and provides an agentic hover heuristic to expand, capture, and compare state deltas (`browser_delta`).

4. **Zero-Dependency stdio MCP Server (`browser-cognition-mcp`)**
   * Exposes our service capabilities natively to AI coding agents (Claude, Cursor, OpenCode, Gemini CLI).
   * Runs instantly over Standard I/O via `npx` with zero heavy dependencies.

---

## 📦 Developer SDK Usage

You can import the core intelligence layer directly into your existing Playwright codebase to write robust, zero-maintenance scrapers:

```typescript
import { chromium } from "playwright";
import { BrowserCognitionService } from "browser-cognition-prototype";

async function runRobustScraper() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://github.com/login");

  // 1. Initialize the cognition service
  const cognition = new BrowserCognitionService();

  // 2. Observe the page semantically (bypasses raw HTML strings)
  const { state } = await cognition.observePage(page);

  // 3. Locate elements how a human would (by Role and Name, not CSS classes)
  const target = cognition.findTargetsTool(state, {
    role: "button",
    nameIncludes: "Sign in"
  });

  if (target.count > 0) {
    const targetNode = target.matches[0];
    console.log(`✅ Found: ${targetNode.name} (Node ID: ${targetNode.id})`);

    // 4. Generate an ordered, self-healing selector plan
    const plan = cognition.getSelectorPlan(state, targetNode.id);
    
    console.log("Primary Selector:", plan.selectors[0].value); 
    // Output: role=button[name='Sign in']
    
    console.log("Fallback Chains:", plan.fallbackChain);
    // Dynamic relational XPaths if semantic tags fail!
  }

  await browser.close();
}
```

---

## 🛠️ Model Context Protocol (MCP) Server Integration

This framework exposes standard MCP tools for integration into developer interfaces.

### Exposed Tools
* `browser_navigate`: Opens a browser and points the active tab to a URL.
* `browser_observe`: Returns the simplified semantic JSON layout of the active tab.
* `browser_delta`: Compares two semantic layouts to pinpoint dynamic/revealed changes.
* `browser_verify`: Runs preflight interaction safety validations on a semantic node.
* `browser_act`: Executes mouse actions (`click`, `fill`, `hover`) using selector-healing plans.

### Interactive Local Test Client
To test standard input/output JSON-RPC channels instantly in your terminal:
```bash
node examples/test_mcp_client.js
```

### Visual Web Inspector
To test the tools visually via a mock browser page:
```bash
npx -y @modelcontextprotocol/inspector node dist/src/runtime/mcp.js
```
*Open the `http://localhost:5173` URL printed in the console, navigate to the **Tools** tab, and execute operations visually!*

### Hooking up to Claude Desktop
Add this to your local settings file (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "browser-cognition": {
      "command": "node",
      "args": [
        "/Users/harsha/Downloads/ventures_hacks_projects_backup/playwright-ext/dist/src/runtime/mcp.js"
      ]
    }
  }
}
```
*Restart Claude Desktop, and you will see your new custom browser-navigation and selector-healing tools inside the chat hammer!*

---

## 📚 Running the Codebase Demos

We have prepared three separate standalone examples in the `examples/` folder to highlight the package features:

1. **Basic Observation Demo:**
   ```bash
   npm run build
   npx tsx examples/demo.ts https://example.com
   ```
2. **Library API & Verification Demo:**
   ```bash
   npx tsx examples/end_user_test.ts
   ```
3. **Dynamic Lazy-Rendering & Selector-Healing Scraper Demo:**
   ```bash
   npx tsx examples/scraper_helper.ts
   ```

---

## 🧪 Running Tests
Verify structural fusion, selector ranking, shadow trees, relative XPaths, and action preflights:
```bash
npm test
```
*Runs all deterministic Mocha/Node assertions. All checks currently pass!*
