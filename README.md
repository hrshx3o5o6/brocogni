# Browser Cognition MCP: Agent-First Browser Observability & Self-Healing

An intelligent semantic page observer and self-healing selector engine that bridges the gap between fragile web layouts and robust browser automation. Built to enable AI coding agents (Claude Code, Cursor, OpenCode, Antigravity) to write bulletproof, zero-dependency Playwright scripts.

---

## 💡 The Vision

Most browser automation scripts are incredibly fragile. When an AI assistant or a developer writes code to scrape a page or click a button, they rely on highly specific class names (e.g. `.btn-primary`, `.css-x83kf2`, Tailwind utility classes) or structural selectors. The moment the frontend builds again or classes shift, **the script breaks**.

**Browser Cognition** provides an **intelligence and selector-healing layer** that translates noisy DOM layouts into a logical, accessibility-first representation. Instead of scraping hardcoded classes, it dynamically analyzes accessibility trees, solves lazy-rendering states, and builds self-healing selector plans on the fly.

Instead of introducing another heavy runtime dependency to your production code, **Browser Cognition runs during development as a copilot for your AI coding agents.** The agent uses this MCP server to explore the page, find robust relational locators, and then generates standard, vanilla Playwright code.

---

## 🚀 Key Capabilities

1. **Logical Accessibility-Tree Observation (`browser_observe`)**
   * Bypasses thousands of lines of messy DOM div-noise.
   * Compiles layouts into clean, logical semantic nodes containing accessible names, roles, visibility scores, and physical geometries.

2. **Self-Healing Selector Engine (`browser_get_selector_plan`)**
   * Computes a hierarchy of fallback selectors ranging from highly specific semantic locators to **relative relational sibling locators** (e.g. XPath `preceding-sibling`, `following-sibling`, and relative CSS `+`).
   * If a target element has no direct accessible name, the engine automatically anchors it to a nearby named parent or sibling element.

3. **Lazy-Rendering Discovery (`browser_delta`)**
   * Detects collapsed states (`"expanded": "false"`) and provides an agentic hover/click heuristic to expand, capture, and compare state deltas.

4. **Agent Action Verification (`browser_verify`)**
   * Pre-flights automation interactions before code generation (checks visibility, enablement, and role-action compatibility).

---

## 🛠️ Model Context Protocol (MCP) Server Integration

This framework exposes standard MCP tools for integration into developer interfaces.

### Exposed Tools
* `browser_navigate`: Opens a browser and points the active tab to a URL.
* `browser_observe`: Analyzes the page and caches the semantic state server-side.
* `browser_find_targets`: Searches the cached state using server-side filtering (token-efficient; prevents line truncation).
* `browser_get_selector_plan`: Retrieves the pre-computed selector plan (primary + fallback locators) for a specific semantic node.
* `browser_act`: Executes mouse actions (`click`, `fill`, `hover`) using selector-healing plans.
* `browser_verify`: Runs preflight interaction safety validations on a semantic node.
* `browser_screenshot`: Takes a screenshot of the current page viewport and returns it as a base64 encoded PNG.
* `browser_evaluate`: Evaluates arbitrary JavaScript inside the page context.
* `browser_save_cookies`: Saves current context cookies to a file for session persistence.
* `browser_info`: Returns general page metrics (URL, title, iframe count, main element selectors).

### Exposed Prompts
* `write-robust-playwright-script`: Instructs the AI agent on how to use the cognition tools to write resilient, zero-dependency Playwright scripts.

---

## 🔌 Hooking up to AI Coding Agents

Ensure you have Playwright browsers installed locally:
```bash
npx playwright install chromium
```

### 🖥️ Claude Desktop (Automatic Setup)
You can configure Claude Desktop automatically by running:
```bash
# Register the published package
npx browser-cognition-mcp install

# (Or in local dev folder)
npm run configure -- --local
```

### 🤖 Claude Code (CLI)
Install the server directly into Claude Code:
```bash
claude mcp add browser-cognition -- npx -y browser-cognition-mcp
```

### 🚀 Cursor
1. Navigate to **Settings** -> **Features** -> **MCP**.
2. Click **+ Add New MCP Server**.
3. Choose **stdio**, name it `browser-cognition`, set command to `npx`, and arguments to `-y browser-cognition-mcp`.

### 🌐 OpenCode
OpenCode integrates **natively**! When you open this repository, it automatically reads the [opencode.json](./opencode.json) file and starts the server in the background with zero developer setup required.

---

## 📚 Running the Codebase Demos

We have prepared three separate standalone examples in the `examples/` folder to highlight the package features:

1. **Dynamic E-Commerce Scraper & Sibling Selector Demo:**
   ```bash
   npx tsx examples/project1_ecommerce_scraper.ts
   ```
2. **Interactive Form Filler & Pre-flight Verifier Demo:**
   ```bash
   npx tsx examples/project2_form_verifier.ts
   ```
3. **Self-Healing Regression Guard Demo:**
   ```bash
   npx tsx examples/project3_self_healing_test.ts
   ```

---

## 🧪 Running Tests
Verify structural fusion, selector ranking, shadow trees, relative XPaths, and action preflights:
```bash
npm test
```
