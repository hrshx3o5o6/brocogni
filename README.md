<p align="center">
  <img src="assets/brocogni_logo.png" alt="Brocogni logo" width="160">
</p>

<h1 align="center">Brocogni</h1>

<p align="center"><em>Making Playwright make sense to AI agents.</em></p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" alt="MIT license"></a>
  <a href="https://www.npmjs.com/package/browser-cognition-mcp"><img src="https://img.shields.io/badge/npm-browser--cognition--mcp-111111?style=flat-square" alt="npm"></a>
</p>

---

An AI agent with a browser is powerful. An AI agent that understands what it sees in the browser is unstoppable.

Brocogni is an open-source MCP server that sits between your AI agent and Playwright. Instead of dumping raw HTML into your agent's context (noisy, fragile, token-wasting), it compiles pages into a structured semantic map the agent can navigate, reason about, and act on in real time.

**Two modes:**

- **Agentic browsing loop** -- The agent calls Brocogni tools directly: navigate, observe, click, extract, diff. Each step feeds back into reasoning. The browser is the environment, the agent is the brain.
- **Self-healing script generation** -- The agent observes a page and generates vanilla Playwright code with automatic fallback selectors that survive frontend rebuilds.

No SaaS. No data leaves your machine. MIT.

[▶️ Watch the 15-second demo](https://raw.githubusercontent.com/hrshx3o5o6/brocogni/main/assets/demo.mp4)

---

## Before / After

**Before -- fragile selectors that break on every deploy:**

```ts
await page.click('.btn-primary');
await page.fill('.css-x83kf2 > input', 'hello');
```

Works today. Fails tomorrow when Tailwind classes rebuild.

**After -- semantic selectors with self-healing fallbacks:**

```ts
await page.click('role=button[name="Sign in"]');
await page.fill('role=textbox[name="Email"]', 'hello');
```

If the primary selector breaks, the fallback chain handles it:

```
role=button[name='Sign in']
  -> button:has-text('Sign in')
  -> xpath=//button[contains(text(),'Sign in')]
  -> css=div:has(> button) + button
```

The engine anchors unnamed elements to named siblings using relational XPath and CSS adjacent selectors. If a button has no accessible name but sits next to a labeled input, Brocogni finds it anyway.

---

## How it works

```
AI Agent
   |
   | MCP protocol (stdio)
   v
Brocogni MCP Server
   |
   | Playwright + CDP
   v
 AX Tree  -->  DOM Geometry  -->  Selector Engine
                                       |
                                       v
                         Self-healing selectors
                         (ARIA / CSS / XPath / relational)
```

The agent calls MCP tools in a loop: navigate to a URL, observe the page as structured semantic nodes, find targets by role or name, click to trigger new states, diff before/after to catch dynamic content. Actionable nodes carry role, name, bounding box, visibility, enabled state, and ranked selectors with fallback chains. The agent never sees raw HTML.

---

## Benchmark

Brocogni is **81% cheaper** than @playwright/mcp for the full workflow:
observe → act → export a working Playwright script.

### The ref iteration problem

@playwright/mcp returns a raw AX tree with temporary refs (`e5`, `e10`).
Refs work inside the MCP session. When the LLM wants to export a persistent script,
they expire.

```
@playwright/mcp                          Brocogni
──────────────                            ────────
Try 1: write ref-based script             Try 1: copy pre-computed selectors
       → refs expire, script broken              → #search-input works
Try 2: re-observe, guess getByRole               → One shot. Done.
       → 75% correct
Try 3: debug failed selectors
       → script finally works

Cost: $0.04 per script                    Cost: $0.01 per script
(3 attempts, trial & error)               (1 attempt, one-shot)
```

### Cost at scale

| Scripts/mo | @playwright/mcp | Brocogni |
|---|---|---|
| 50 | $1.78 | $0.33 |
| 200 | $7.11 | $1.33 |
| 1,000 | $35.53 | $6.64 |

Pricing based on Claude Sonnet 4 ($3/M input, $15/M output).

### Signal density

| What the LLM must parse | @playwright/mcp | Brocogni |
|---|---|---|
| Elements returned | 62–93 AX nodes | 9 semantic nodes |
| Actionable | mixed | 9 of 9 (100%) |
| LLM must filter | yes | no |
| Pre-computed selectors | no (refs) | yes (CSS/XPath/ARIA) |
| Bounding boxes | no | yes |
| Purpose inference | no | yes |
| Fallback chains | no | yes |
| Confidence scores | no | yes |

@playwright/mcp gives the LLM raw data and says "figure it out."
Brocogni gives the LLM understanding and says "here's what to do."

---

## Install

```bash
npx playwright install chromium
npx browser-cognition-mcp
```

Then connect your agent:

**Claude Code**
```bash
claude mcp add brocogni -- npx -y browser-cognition-mcp
```

**Cursor**
```
Settings -> Features -> MCP -> Add New
Name: brocogni  |  Type: stdio  |  Command: npx -y browser-cognition-mcp
```

**Claude Desktop**
```bash
npx browser-cognition-mcp install
```

**OpenCode**
Zero setup -- reads `opencode.json` automatically.

---

## MCP Tools

| Tool | What it does |
|---|---|
| `browser_navigate` | Open a URL |
| `browser_observe` | Compile page into semantic node map |
| `browser_find_targets` | Search by role, name, or purpose |
| `browser_get_selector_plan` | Get primary + fallback selectors |
| `browser_act` | Click, fill, or hover |
| `browser_verify` | Preflight: visible, enabled, compatible |
| `browser_delta` | Diff two page states |
| `browser_screenshot` | Capture viewport as PNG |
| `browser_evaluate` | Run JS in page context |
| `browser_save_cookies` | Persist session cookies |
| `browser_info` | Page URL, title, iframe count |

Also exposes a `write-robust-playwright-script` prompt that teaches agents how to use these tools effectively.

---

## Tests

```bash
npm test
```

Deterministic, no browser required. Covers semantic extraction, DOM fusion, selector ranking, relational fallbacks, delta computation, and action verification.

---

## FAQ

**Does it need API keys?** No. Every observation runs locally. No accounts, no telemetry, no data leaves your machine.

**Which agents does it work with?** Any MCP-compatible agent: Claude Code, Claude Desktop, Cursor, OpenCode, and others.

**Does it add runtime bloat to my project?** No. Brocogni is a dev-time MCP server. It generates vanilla Playwright code -- no runtime dependencies introduced.

**What happens when a selector fails?** The fallback chain activates automatically. ARIA -> text -> XPath -> relational sibling. The agent tries each one in order.

---

## Contributing

Bug reports, feature requests, and PRs welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md). Security issues? [SECURITY.md](./SECURITY.md).

---

## License

[MIT](./LICENSE). Go build something.
