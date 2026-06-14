# Browser Cognition MCP

Give your AI agent a browser that it can actually understand.

Browser Cognition is an open-source MCP server that bridges AI reasoning engines with live web browsers. Instead of dumping raw HTML into your agent's context (noisy, fragile, token-wasting), it compiles pages into a structured semantic map the agent can navigate, reason about, and act on in real time.

**Two ways to use it:**

1. **Agentic browsing loop** -- The agent uses MCP tools directly: navigate, observe, find targets, click, extract. It iterates, re-reasons, and adapts based on what the page shows. The browser is the environment, the agent is the brain.

2. **Self-healing script generation** -- The agent observes a page, understands its structure, and generates vanilla Playwright selectors with automatic fallback chains. Your test suite survives frontend rebuilds.

No SaaS. No data leaves your machine. MIT license.

---

## How it works

```
Your AI Agent
     |
     | MCP protocol (stdio)
     v
Browser Cognition MCP Server
     |
     | Chrome DevTools Protocol via Playwright
     v
   +---------+     +----------+     +-------------+
   |   AX    | --> |   Fuse   | --> |   Selector  |
   |  Tree   |     | DOM Geo  |     |   Engine    |
   +---------+     +----------+     +-------------+
                                          |
                                          v
                              Self-healing selectors
                              (ARIA / CSS / XPath / relational)
```

The agent calls MCP tools in a loop: navigate to a URL, observe the page as structured semantic nodes, find specific targets by role or name, extract data, click to trigger new states, diff the before/after to detect dynamic content. Each step feeds back into the agent's reasoning -- it decides what to do next based on what the page actually shows.

Actionable nodes carry role, name, bounding box, visibility, enabled state, and a ranked list of locators with fallback chains. The agent never sees raw HTML.

---

## Quickstart

```bash
# Install Playwright browsers if you haven't
npx playwright install chromium

# Run the server (no install needed)
npx browser-cognition-mcp
```

Then connect your AI coding agent:

### Claude Code
```bash
claude mcp add browser-cognition -- npx -y browser-cognition-mcp
```

### Cursor
Settings -> Features -> MCP -> Add New MCP Server
- Name: `browser-cognition`
- Type: `stdio`
- Command: `npx -y browser-cognition-mcp`

### Claude Desktop
```bash
npx browser-cognition-mcp install
```

### OpenCode
OpenCode reads `opencode.json` automatically -- zero setup.

---

## Before & After

**Before -- fragile selectors that break on every deploy:**
```ts
// Works today, fails tomorrow when Tailwind classes rebuild
await page.click('.btn-primary');
await page.fill('.css-x83kf2 > input', 'hello');
```

**After -- semantic selectors with self-healing fallbacks:**
```ts
// Agent uses browser_observe to understand the page,
// then generates standard Playwright locators that survive layout changes
await page.click('role=button[name="Sign in"]');
await page.fill('role=textbox[name="Email"]', 'hello');

// If the primary selector fails, the fallback chain kicks in:
// role=button[name='Sign in']
//   -> button:has-text('Sign in')
//   -> xpath=//button[contains(text(),'Sign in')]
//   -> css=div:has(> button) + button
```

The self-healing engine anchors unnamed elements to nearby named siblings using relational selectors (XPath preceding-sibling, following-sibling, CSS adjacent `+`). If a button has no accessible name but sits next to a labeled input, the engine finds it anyway.

---

## Why Open Source

- **Local-first.** Every observation runs on your machine. No data is sent to any server -- no API keys, no accounts, no telemetry.
- **Agnostic.** Works with any MCP-compatible agent. Not tied to a single vendor or platform.
- **Auditable.** MIT license. You can read every line of code, modify it, and ship it.
- **Light dependency.** Only depends on Playwright. No heavy frameworks, no external APIs.

---

## MCP Tools

| Tool | Purpose |
|---|---|
| `browser_navigate` | Open a URL in the browser |
| `browser_observe` | Compile page into semantic node map |
| `browser_find_targets` | Search cached state by role, name, or purpose |
| `browser_get_selector_plan` | Get primary + fallback locators for a node |
| `browser_act` | Click, fill, or hover using selector-healing plans |
| `browser_verify` | Preflight check: visible, enabled, action-compatible |
| `browser_delta` | Diff two page states (detects lazy-rendered content) |
| `browser_screenshot` | Capture viewport as base64 PNG |
| `browser_evaluate` | Run arbitrary JS in page context |
| `browser_save_cookies` | Persist session cookies to disk |
| `browser_info` | Page metadata (URL, title, iframe count) |

The server also exposes a `write-robust-playwright-script` prompt that teaches AI agents how to use these tools effectively.

---

## Demos

```bash
# E-commerce scraper with lazy-rendered reviews
npx tsx examples/project1_ecommerce_scraper.ts

# Form filler with action preflight verification
npx tsx examples/project2_form_verifier.ts

# Self-healing across UI refactors (v1 -> v2 with mangled classes)
npx tsx examples/project3_self_healing_test.ts
```

---

## Tests

```bash
npm test
```

Deterministic unit tests -- no browser required. Covers semantic extraction, DOM fusion, selector ranking, relational fallbacks, delta computation, and action verification.

---

## Contributing

Bug reports, feature requests, and PRs are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md).

Security issues? See [SECURITY.md](./SECURITY.md).

---

## License

MIT -- go build something.
